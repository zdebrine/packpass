// send-push: called by a Database Webhook on INSERT into public.notifications (see supabase/README.md).
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (provided by Supabase), PUSH_WEBHOOK_SECRET (the
// webhook sends it in the x-webhook-secret header), EXPO_ACCESS_TOKEN (optional, if push security is on).
import { createClient } from 'npm:@supabase/supabase-js@2';

import { deliver, expoSender, type NotificationRow } from './push.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');

Deno.serve(async (req) => {
  if (!secret || req.headers.get('x-webhook-secret') !== secret) return new Response('forbidden', { status: 403 });
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
