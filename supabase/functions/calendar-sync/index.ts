// calendar-sync: reads partners' iCal feeds and stores their busy times (migrations/…_calendar_sync.sql).
//   * every 15 minutes read_calendar_feeds() posts {"due": true} with the shared webhook secret (as send-push and
//     send-email get it); every feed not read in the last 14 minutes is read.
//   * the partner dashboard posts {"feed": id} with the staff member's own token straight after adding a feed, so
//     the Settings page can say what it found; partner_owns_feed() checks the feed is theirs.
// Each read fetches the feed (10 s, 5 MB at most), keeps the next 15 days of busy times (ics.ts) and hands them to
// calendar_store_busy(), which closes PackPass spots at those times.
// Env: SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY (provided by Supabase).
import { createClient } from 'npm:@supabase/supabase-js@2';

import { feedUrl, parseIcs } from './ics.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info' };
const MAX_BYTES = 5_000_000;

/** One feed: fetch, parse, store. Returns the error stored, if any. */
async function read(id: string, raw: string): Promise<string | null> {
  let error: string | null = null;
  let blocks: unknown[] = [];
  const u = feedUrl(raw);
  if (!u) error = 'This address isn\'t a public https or webcal feed.';
  else {
    try {
      const res = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(10_000), headers: { accept: 'text/calendar, */*' } });
      if (!res.ok) error = res.status === 404 || res.status === 410 ? 'The feed address no longer works.' : `The calendar answered ${res.status}.`;
      else {
        const body = await res.text();
        if (body.length > MAX_BYTES) error = 'The feed is too large to read.';
        else if (!/BEGIN:VCALENDAR/i.test(body)) error = 'That address isn\'t an iCal feed.';
        else {
          const now = new Date();
          blocks = parseIcs(body, now, new Date(now.getTime() + 15 * 86_400_000));
        }
      }
    } catch (e) {
      error = (e as Error).name === 'TimeoutError' ? 'The calendar took too long to answer.' : 'The calendar couldn\'t be reached.';
    }
  }
  const { error: dbError } = await db.rpc('calendar_store_busy', { p_feed: id, p_blocks: blocks, p_error: error });
  if (dbError) throw dbError;
  return error;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const body = await req.json().catch(() => ({})) as { due?: boolean; feed?: string };

  if (body.due) {
    const { data: ok } = await db.rpc('push_secret_ok', { p_secret: req.headers.get('x-webhook-secret') });
    if (ok !== true) return new Response('forbidden', { status: 403 });
    const { data, error } = await db.rpc('calendar_feeds_due', {});
    if (error) throw error;
    const feeds = data as { id: string; url: string }[];
    let failed = 0;
    // A few at a time, so one slow calendar doesn't hold up the rest.
    for (let i = 0; i < feeds.length; i += 5) {
      const results = await Promise.all(feeds.slice(i, i + 5).map((f) => read(f.id, f.url).catch(() => 'failed')));
      failed += results.filter(Boolean).length;
    }
    return Response.json({ read: feeds.length, failed });
  }

  if (body.feed) {
    const auth = req.headers.get('authorization') ?? '';
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { authorization: auth } }, auth: { persistSession: false } });
    const { data: mine } = await asUser.rpc('partner_owns_feed', { p_feed: body.feed });
    if (mine !== true) return Response.json({ error: 'not_found' }, { status: 404, headers: cors });
    const { data } = await db.rpc('calendar_feeds_due', { p_feed: body.feed });
    const feed = (data as { id: string; url: string }[] | null)?.[0];
    if (!feed) return Response.json({ error: 'not_found' }, { status: 404, headers: cors });
    const error = await read(feed.id, feed.url);
    return Response.json({ ok: !error, error }, { headers: cors });
  }

  return Response.json({ error: 'bad_request' }, { status: 400, headers: cors });
});
