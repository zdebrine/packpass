// send-email: called by the notifications_email trigger (migrations/…_reminders.sql) through pg_net for each
// new notification worth emailing (the reminder sequence). The trigger sends the same shared secret as
// send-push; push_secret_ok() checks it. email_context() gives the address, and skips members who turned
// reminder emails off.
// Env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (provided by Supabase), RESEND_API_KEY and MAIL_FROM (the same
// sender supabase/scripts/setup-auth.mjs puts on Auth), APP_URL (optional, defaults to https://app.packpass.app).
import { createClient } from 'npm:@supabase/supabase-js@2';

import { render, resendSender, type Context, type NotificationRow } from './email.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  const { data: ok } = await db.rpc('push_secret_ok', { p_secret: req.headers.get('x-webhook-secret') });
  if (ok !== true) return new Response('forbidden', { status: 403 });
  const payload = (await req.json()) as { type: string; table: string; record: NotificationRow };
  if (payload.type !== 'INSERT' || payload.table !== 'notifications') return Response.json({ skipped: true });

  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('MAIL_FROM');
  if (!key || !from) return Response.json({ skipped: 'no_sender' });

  const { data, error } = await db.rpc('email_context', { p_notification: payload.record.id });
  if (error) throw error;
  const ctx = (data as Context[])[0];
  const email = ctx && render(payload.record, ctx, Deno.env.get('APP_URL') ?? 'https://app.packpass.app');
  if (!email) return Response.json({ skipped: true });
  const id = await resendSender(fetch, key, from)(email);
  return Response.json({ sent: id });
});
