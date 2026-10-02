// send-push: called by the notifications_push trigger (migrations/…_push_webhook.sql) through pg_net
// for each new notification worth pushing. The trigger sends a shared secret from Vault in the
// x-webhook-secret header; push_secret_ok() checks it, so the function needs no secret of its own.
// Env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (provided by Supabase), EXPO_ACCESS_TOKEN (optional,
// only if Expo push security is turned on).
import { createClient } from 'npm:@supabase/supabase-js@2';

import { deliver, expoSender, type NotificationRow } from './push.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  const { data: ok } = await db.rpc('push_secret_ok', { p_secret: req.headers.get('x-webhook-secret') });
  if (ok !== true) return new Response('forbidden', { status: 403 });
  const payload = (await req.json()) as { type: string; table: string; record: NotificationRow };
  if (payload.type !== 'INSERT' || payload.table !== 'notifications') return Response.json({ skipped: true });

  const result = await deliver(payload.record, {
    tokensFor: async (memberId) => {
      const { data, error } = await db.from('push_tokens').select('token').eq('member_id', memberId);
      if (error) throw error;
      return data.map((r) => r.token as string);
    },
    send: expoSender(fetch, Deno.env.get('EXPO_ACCESS_TOKEN') ?? undefined),
    forget: async (tokens) => {
      await db.from('push_tokens').delete().in('token', tokens);
    },
  });
  return Response.json(result);
});
