// Turns a new notifications row into a reminder email and sends it through Resend. Kept free of Deno and
// Supabase imports so it runs under Node for tests (email.test.ts). The layout matches the code emails in
// supabase/templates (same card, type and colors), so every PackPass email looks like one family.

/** Emailed kinds. Same list as public.email_kind() in migrations/…_reminders.sql, which filters before calling. */
export const EMAIL_KINDS = new Set(['booked', 'reminder_24h', 'reminder_2h', 'session_note', 'nudge_10d', 'waitlist_booked', 'waitlist_offer']);

export type NotificationRow = { id: string; member_id: string; kind: string; title: string; body: string; href: string | null };
/** What email_context() adds: where to send it, and the session's place for the directions link. */
export type Context = { email: string | null; name: string | null; partner: string | null; address: string | null };
export type Email = { to: string; subject: string; html: string; text: string };

const BUTTON: Record<string, string> = {
  booked: 'View booking',
  reminder_24h: 'View booking',
  reminder_2h: 'Check in',
  session_note: 'See the note',
  nudge_10d: 'See classes',
  waitlist_booked: 'View booking',
  waitlist_offer: 'Accept or pass',
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The app link for a notification: its own href on the member web app. */
export function linkFor(n: NotificationRow, appUrl: string): string {
  const base = appUrl.replace(/\/+$/, '');
  const path = n.href && n.href.startsWith('/') ? n.href : '/notifications';
  return base + path;
}

export function render(n: NotificationRow, ctx: Context, appUrl: string): Email | null {
  if (!EMAIL_KINDS.has(n.kind) || !ctx.email) return null;
  const link = linkFor(n, appUrl);
  const first = (ctx.name ?? '').trim().split(/\s+/)[0];
  const directions = n.kind === 'reminder_2h' && ctx.address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${ctx.partner ?? ''} ${ctx.address}`.trim())}`
    : null;
  const button = BUTTON[n.kind] ?? 'Open PackPass';
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(n.title)}</title></head>
<body style="margin:0;padding:0;background:#f3f3f1;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f3f1;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:28px;">
<tr><td style="padding:32px 32px 0 32px;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:3px;color:#0e0f0e;">PACKPASS</td></tr>
<tr><td style="padding:28px 32px 0 32px;font-family:Helvetica,Arial,sans-serif;">
<h1 style="margin:0;font-size:28px;line-height:32px;font-weight:800;color:#0e0f0e;">${esc(n.title)}</h1>
<p style="margin:14px 0 0 0;font-size:16px;line-height:24px;color:#0e0f0e;">${esc(n.body)}</p>
</td></tr>
<tr><td style="padding:24px 32px 0 32px;font-family:Helvetica,Arial,sans-serif;">
<a href="${esc(link)}" style="display:inline-block;background:#16322a;color:#f4f5f1;border-radius:9999px;padding:14px 24px;font-size:16px;font-weight:700;text-decoration:none;">${esc(button)}</a>${directions ? `
<a href="${esc(directions)}" style="display:inline-block;margin-left:8px;color:#0e0f0e;border-radius:9999px;padding:14px 20px;font-size:16px;font-weight:700;text-decoration:underline;">Directions</a>` : ''}
</td></tr>
<tr><td style="padding:24px 32px 32px 32px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:21px;color:#6a6d6b;">${first ? `Sent to ${esc(first)} because you have a PackPass booking or account. ` : ''}Turn reminder emails off in the app under Settings.</td></tr>
</table>
<p style="margin:20px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:#6a6d6b;">PackPass · Dog sport, scent and play classes in Austin</p>
</td></tr>
</table>
</body>
</html>`;
  const text = `${n.title}\n\n${n.body}\n\n${button}: ${link}${directions ? `\nDirections: ${directions}` : ''}\n\nTurn reminder emails off in the app under Settings.`;
  return { to: ctx.email, subject: n.title, html, text };
}

export const RESEND_URL = 'https://api.resend.com/emails';

export function resendSender(fetchFn: typeof fetch, apiKey: string, from: string) {
  return async (e: Email): Promise<string> => {
    const res = await fetchFn(RESEND_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to: [e.to], subject: e.subject, html: e.html, text: e.text }),
    });
    if (!res.ok) throw new Error(`resend_${res.status}`);
    return ((await res.json()) as { id: string }).id;
  };
}
