#!/usr/bin/env node
// Sets up the hosted project's sign-in emails in one go, through the Supabase Management API:
//   - sends them through Resend's SMTP (from your verified domain, not Supabase's test sender)
//   - the code-based templates in supabase/templates (the apps ask for a 6-digit code, not a link)
//   - 6-digit codes that last an hour, one email a minute per address, 100 emails an hour in all
//   - the Site URL and redirect URLs, if you give them
// It also checks that the sending domain is verified in Resend, and adds it there if it's missing.
//
// Usage (Node 18+, from the repo root):
//   SUPABASE_ACCESS_TOKEN=sbp_…   # supabase.com/dashboard/account/tokens
// No domain yet? Leave out RESEND_API_KEY and MAIL_FROM: the code templates and limits still go on, and
// Supabase's test sender keeps delivering (only to the project's team, a few an hour).
//   RESEND_API_KEY=re_…           # resend.com/api-keys (Sending access is enough for SMTP; Full access lets
//                                 # this script check and add the domain)
//   MAIL_FROM=hello@yourdomain.com
//   node supabase/scripts/setup-auth.mjs [--dry-run]
// Optional: PROJECT_REF (default: the packpass project), MAIL_NAME (default: PackPass),
//   SITE_URL (e.g. the partner dashboard's URL), REDIRECT_URLS (comma separated).
// Nothing secret is printed or written to disk.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const templates = path.resolve(here, '../templates');
const env = process.env;
const dry = process.argv.includes('--dry-run');
const ref = env.PROJECT_REF || 'qovbpxvpnslsjzunxutk';

const need = (k) => {
  if (!env[k]) { console.error(`Set ${k} (see the top of this file).`); process.exit(1); }
  return env[k];
};
const token = dry ? env.SUPABASE_ACCESS_TOKEN : need('SUPABASE_ACCESS_TOKEN');
// The sender only matters with Resend; without it, Supabase's own test sender stays (templates still apply).
const from = env.RESEND_API_KEY ? need('MAIL_FROM') : env.MAIL_FROM ?? '';
const domain = from.split('@')[1];

// ---- Resend: is the sending domain verified? ------------------------------------------------------
async function checkResendDomain() {
  if (!env.RESEND_API_KEY) return console.log('· RESEND_API_KEY not set: skipping SMTP.');
  const r = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` } });
  if (r.status === 401 || r.status === 403) {
    return console.log(`· Can't list Resend domains with this key (sending-only?). Check ${domain} shows "Verified" at resend.com/domains.`);
  }
  if (!r.ok) throw new Error(`Resend: ${r.status} ${await r.text()}`);
  const found = ((await r.json()).data ?? []).find((d) => d.name === domain);
  if (found?.status === 'verified') return console.log(`✓ Resend: ${domain} is verified.`);
  let d = found;
  if (!d && !dry) {
    const c = await fetch('https://api.resend.com/domains', {
      method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: domain }),
    });
    if (!c.ok) throw new Error(`Resend: couldn't add ${domain}: ${c.status} ${await c.text()}`);
    d = await c.json();
    console.log(`+ Resend: added ${domain}.`);
  }
  console.log(`! ${domain} isn't verified in Resend yet. Add these DNS records where the domain is registered, then press Verify at resend.com/domains:`);
  for (const rec of d?.records ?? []) console.log(`    ${rec.type.padEnd(5)} ${rec.name}  →  ${rec.value}${rec.priority ? `  (priority ${rec.priority})` : ''}`);
  console.log('  Emails from an unverified domain are rejected, so sign-up codes won\'t arrive until it is.');
}

// ---- Supabase Auth settings ------------------------------------------------------------------------
const read = (f) => fs.readFileSync(path.join(templates, f), 'utf8');
const config = {
  external_email_enabled: true,
  mailer_autoconfirm: false,
  mailer_otp_length: 6,
  mailer_otp_exp: 3600,
  password_min_length: 8,
  smtp_max_frequency: 60,
  mailer_subjects_confirmation: 'Your PackPass code: {{ .Token }}',
  mailer_templates_confirmation_content: read('confirmation.html'),
  mailer_subjects_recovery: 'Reset your PackPass password',
  mailer_templates_recovery_content: read('recovery.html'),
  mailer_subjects_invite: 'You\'re on PackPass Partner',
  mailer_templates_invite_content: read('invite.html'),
  mailer_subjects_magic_link: 'Your PackPass sign-in code',
  mailer_templates_magic_link_content: read('magic_link.html'),
  mailer_subjects_email_change: 'Confirm your new email for PackPass',
  mailer_templates_email_change_content: read('email_change.html'),
  ...(env.RESEND_API_KEY ? {
    smtp_host: 'smtp.resend.com', smtp_port: '465', smtp_user: 'resend', smtp_pass: env.RESEND_API_KEY,
    smtp_admin_email: from, smtp_sender_name: env.MAIL_NAME || 'PackPass',
    // Supabase only lets the hourly email limit change once custom SMTP is on.
    rate_limit_email_sent: 100,
  } : {}),
  ...(env.SITE_URL ? { site_url: env.SITE_URL } : {}),
  ...(env.REDIRECT_URLS ? { uri_allow_list: env.REDIRECT_URLS } : {}),
};

async function main() {
  await checkResendDomain();
  const shown = Object.fromEntries(Object.entries(config).map(([k, v]) =>
    [k, k === 'smtp_pass' ? '(your Resend key)' : k.endsWith('_content') ? `(${k.replace(/^mailer_templates_|_content$/g, '')}.html, ${v.length} chars)` : v]));
  if (dry) { console.log('Would set:', shown); return; }

  const api = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const r = await fetch(api, { method: 'PATCH', headers, body: JSON.stringify(config) });
  if (!r.ok) throw new Error(`Supabase: ${r.status} ${await r.text()}`);
  const now = await (await fetch(api, { headers })).json();
  console.log(`✓ Supabase Auth updated for ${ref}:`);
  console.log(`    sender        ${now.smtp_host ? `${now.smtp_sender_name} <${now.smtp_admin_email}> via ${now.smtp_host}` : 'Supabase test sender (no SMTP)'}`);
  console.log(`    codes         ${now.mailer_otp_length} digits, ${Math.round(now.mailer_otp_exp / 60)} min`);
  console.log(`    rate limits   ${now.rate_limit_email_sent} emails/hour, 1 per address every ${now.smtp_max_frequency}s`);
  console.log(`    templates     ${['confirmation', 'recovery', 'invite', 'magic_link', 'email_change'].filter((t) => (now[`mailer_templates_${t}_content`] ?? '').includes('{{ .Token }}')).join(', ')}`);
  console.log(`    site url      ${now.site_url}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
