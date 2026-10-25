// calendar-sync: reads partners' calendars and stores their busy times (migrations/…_calendar_sync.sql), and keeps
// PackPass bookings on their Google calendars (…_google_calendar.sql).
//   * every 15 minutes read_calendar_feeds() posts {"due": true} with the shared webhook secret (as send-push and
//     send-email get it); every iCal feed and Google connection not read in the last 14 minutes is synced.
//   * the partner dashboard posts {"feed": id} with the staff member's own token straight after adding a feed (and to
//     retry a broken one), so the Settings page can say what it found; partner_owns_feed() checks the feed is theirs.
//     {"disconnect": id} removes a Google connection: PackPass's events come off the calendar and the access is revoked.
//   * Google sign-in: the dashboard opens GET …/calendar-sync/google/start?state=… (from partner_google_start), which
//     goes to Google's consent page; Google returns to …/google/callback, which stores the connection, syncs it and
//     goes back to Settings › Calendar sync with ?google=connected (or an error code). GET …/google/status says
//     whether Google is set up, so the dashboard only offers it when it is.
// An iCal read fetches the feed (10 s, 5 MB at most), keeps the next 15 days of busy times (ics.ts) and hands them to
// calendar_store_busy(), which closes PackPass spots at those times. A Google sync reads the same 15 days of events,
// then writes, rewrites or removes PackPass's own events for the next 30 days (google.ts).
// Env: SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY (provided by Supabase); for Google,
// GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and PARTNER_URL (the dashboard's address, for the roster link and the way back).
import { createClient } from 'npm:@supabase/supabase-js@2';

import { authUrl, busyFromEvents, emailFromIdToken, plan, type ExportRow, type GoogleEvent } from './google.ts';
import { feedUrl, parseIcs } from './ics.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info' };
const MAX_BYTES = 5_000_000;
const DAY_MS = 86_400_000;

const GOOGLE_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
const GOOGLE_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';
const PARTNER_URL = (Deno.env.get('PARTNER_URL') ?? '').replace(/\/$/, '');
const googleReady = () => !!(GOOGLE_ID && GOOGLE_SECRET && PARTNER_URL);
const CALENDAR = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const REDIRECT = `${url.replace(/\/$/, '')}/functions/v1/calendar-sync/google/callback`;

/** One iCal feed: fetch, parse, store. Returns the error stored, if any. */
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
          blocks = parseIcs(body, now, new Date(now.getTime() + 15 * DAY_MS));
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

// ---- Google ------------------------------------------------------------------------------------------------------

interface Connection { id: string; email: string; refresh_token: string; access_token: string | null; access_expires_at: string | null }

/** A problem worth telling the partner about, in their words. */
class GoogleError extends Error {}
const REVOKED = 'Google access was removed. Connect Google Calendar again.';

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', signal: AbortSignal.timeout(10_000),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: GOOGLE_ID, client_secret: GOOGLE_SECRET, ...params }),
  });
  const json = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) throw new GoogleError(json.error === 'invalid_grant' ? REVOKED : 'Google didn\'t accept the sign-in.');
  return json as { access_token: string; expires_in: number; refresh_token?: string; id_token?: string };
}

/** A working access token, refreshed (and stored) when the last one is about to run out. */
async function accessToken(c: Connection): Promise<string> {
  if (c.access_token && c.access_expires_at && new Date(c.access_expires_at).getTime() > Date.now() + 60_000) return c.access_token;
  const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: c.refresh_token });
  await db.rpc('calendar_google_token', { p_feed: c.id, p_access_token: t.access_token, p_expires_in: t.expires_in });
  return t.access_token;
}

async function google(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${CALENDAR}${path}`, {
    ...init, signal: AbortSignal.timeout(10_000),
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  if (res.status === 401) throw new GoogleError(REVOKED);
  if (res.status === 403) throw new GoogleError('Google Calendar refused access. Connect it again and allow PackPass to see and edit events.');
  return res;
}

/** The next 15 days of events, a few pages at most. */
async function listEvents(token: string): Promise<GoogleEvent[]> {
  const now = new Date();
  const items: GoogleEvent[] = [];
  let page: string | undefined;
  for (let i = 0; i < 4; i++) {
    const q = new URLSearchParams({
      timeMin: now.toISOString(), timeMax: new Date(now.getTime() + 15 * DAY_MS).toISOString(),
      singleEvents: 'true', orderBy: 'startTime', maxResults: '2500', ...(page ? { pageToken: page } : {}),
    });
    const res = await google(token, `?${q}`);
    if (!res.ok) throw new GoogleError(`Google Calendar answered ${res.status}.`);
    const json = await res.json() as { items?: GoogleEvent[]; nextPageToken?: string };
    items.push(...(json.items ?? []));
    page = json.nextPageToken;
    if (!page) break;
  }
  return items;
}

/** Writes, rewrites and removes PackPass's events so the calendar matches the bookings. */
async function writeEvents(token: string, feed: string) {
  const { data, error } = await db.rpc('calendar_google_exports', { p_feed: feed });
  if (error) throw error;
  const written: { session_id: string; event_id: string; hash: string }[] = [];
  const removed: string[] = [];
  for (const step of await plan(data as ExportRow[], PARTNER_URL)) {
    if (step.kind === 'remove') {
      const res = await google(token, `/${encodeURIComponent(step.row.event_id!)}`, { method: 'DELETE' });
      if (res.ok || res.status === 404 || res.status === 410) removed.push(step.row.session_id);
      continue;
    }
    let res = step.kind === 'update'
      ? await google(token, `/${encodeURIComponent(step.row.event_id!)}`, { method: 'PATCH', body: JSON.stringify(step.event) })
      : null;
    // Never written, or deleted from the calendar since: write it again.
    if (!res || res.status === 404 || res.status === 410) res = await google(token, '', { method: 'POST', body: JSON.stringify(step.event) });
    if (!res.ok) continue;
    const ev = await res.json() as { id: string };
    written.push({ session_id: step.row.session_id, event_id: ev.id, hash: step.hash });
  }
  await db.rpc('calendar_google_store_exports', { p_feed: feed, p_written: written, p_removed: removed });
}

/** One Google connection: read busy times, then write bookings. Returns the error stored, if any. */
async function syncGoogle(c: Connection): Promise<string | null> {
  let error: string | null = null;
  let blocks: unknown[] = [];
  let token: string | null = null;
  if (!googleReady()) error = 'Google Calendar isn\'t set up on PackPass yet.';
  else {
    try {
      token = await accessToken(c);
      blocks = busyFromEvents(await listEvents(token));
    } catch (e) {
      error = e instanceof GoogleError ? e.message
        : (e as Error).name === 'TimeoutError' ? 'Google Calendar took too long to answer.' : 'Google Calendar couldn\'t be reached.';
    }
  }
  const { error: dbError } = await db.rpc('calendar_store_busy', { p_feed: c.id, p_blocks: blocks, p_error: error });
  if (dbError) throw dbError;
  // Bookings go out only after a good read, so a broken connection isn't written to.
  if (!error && token) await writeEvents(token, c.id).catch(() => {});
  return error;
}

/** Takes PackPass's events off the calendar and revokes the access, as far as Google allows, then forgets it. */
async function disconnect(feed: string) {
  const { data } = await db.rpc('calendar_google_due', { p_feed: feed });
  const c = (data as Connection[] | null)?.[0];
  if (c && googleReady()) {
    try {
      const token = await accessToken(c);
      const { data: rows } = await db.rpc('calendar_google_exports', { p_feed: feed });
      for (const r of (rows as ExportRow[] | null) ?? []) {
        if (r.event_id) await google(token, `/${encodeURIComponent(r.event_id)}`, { method: 'DELETE' }).catch(() => null);
      }
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(c.refresh_token)}`, { method: 'POST', signal: AbortSignal.timeout(10_000) });
    } catch { /* the access may already be gone; forget the connection either way */ }
  }
  const { error } = await db.rpc('calendar_google_disconnect', { p_feed: feed });
  if (error) throw error;
}

const back = (result: string) => Response.redirect(`${PARTNER_URL || 'https://packpass.co'}/calendar?google=${result}`, 302);

async function googleRoute(path: string, q: URLSearchParams): Promise<Response> {
  if (path.endsWith('/google/status')) return Response.json({ ready: googleReady() }, { headers: cors });
  if (!googleReady()) return back('not_ready');
  if (path.endsWith('/google/start')) {
    const state = q.get('state') ?? '';
    const { data: ok } = /^[0-9a-f-]{36}$/i.test(state) ? await db.rpc('calendar_google_state_ok', { p_state: state }) : { data: false };
    if (ok !== true) return back('expired');
    return Response.redirect(authUrl(GOOGLE_ID, REDIRECT, state), 302);
  }
  if (path.endsWith('/google/callback')) {
    const state = q.get('state') ?? '';
    if (q.get('error')) return back(q.get('error') === 'access_denied' ? 'cancelled' : 'failed');
    if (!/^[0-9a-f-]{36}$/i.test(state) || !q.get('code')) return back('failed');
    try {
      const t = await tokenRequest({ grant_type: 'authorization_code', code: q.get('code')!, redirect_uri: REDIRECT });
      if (!t.access_token || !(q.get('scope') ?? '').includes('calendar.events')) return back('no_calendar');
      const { data: feed, error } = await db.rpc('calendar_google_connect', {
        p_state: state, p_email: emailFromIdToken(t.id_token), p_refresh_token: t.refresh_token ?? '', p_access_token: t.access_token, p_expires_in: t.expires_in,
      });
      if (error) return back(/expired|too_many|no_refresh_token/.exec(error.message)?.[0] ?? 'failed');
      const { data } = await db.rpc('calendar_google_due', { p_feed: feed });
      const c = (data as Connection[] | null)?.[0];
      if (c) await syncGoogle(c).catch(() => null);
      return back('connected');
    } catch {
      return back('failed');
    }
  }
  return new Response('not found', { status: 404 });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const u = new URL(req.url);
  if (req.method === 'GET') return googleRoute(u.pathname, u.searchParams);
  const body = await req.json().catch(() => ({})) as { due?: boolean; feed?: string; disconnect?: string };

  if (body.due) {
    const { data: ok } = await db.rpc('push_secret_ok', { p_secret: req.headers.get('x-webhook-secret') });
    if (ok !== true) return new Response('forbidden', { status: 403 });
    const { data, error } = await db.rpc('calendar_feeds_due', {});
    if (error) throw error;
    const feeds = data as { id: string; url: string }[];
    const { data: gData, error: gError } = await db.rpc('calendar_google_due', {});
    if (gError) throw gError;
    const connections = gData as Connection[];
    const jobs = [...feeds.map((f) => () => read(f.id, f.url)), ...connections.map((c) => () => syncGoogle(c))];
    let failed = 0;
    // A few at a time, so one slow calendar doesn't hold up the rest.
    for (let i = 0; i < jobs.length; i += 5) {
      const results = await Promise.all(jobs.slice(i, i + 5).map((job) => job().catch(() => 'failed')));
      failed += results.filter(Boolean).length;
    }
    return Response.json({ read: jobs.length, failed });
  }

  const target = body.feed ?? body.disconnect;
  if (target) {
    const auth = req.headers.get('authorization') ?? '';
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { authorization: auth } }, auth: { persistSession: false } });
    const { data: mine } = await asUser.rpc('partner_owns_feed', { p_feed: target });
    if (mine !== true) return Response.json({ error: 'not_found' }, { status: 404, headers: cors });
    if (body.disconnect) {
      await disconnect(target);
      return Response.json({ ok: true }, { headers: cors });
    }
    const { data } = await db.rpc('calendar_feeds_due', { p_feed: target });
    const feed = (data as { id: string; url: string }[] | null)?.[0];
    if (feed) {
      const error = await read(feed.id, feed.url);
      return Response.json({ ok: !error, error }, { headers: cors });
    }
    const { data: gData } = await db.rpc('calendar_google_due', { p_feed: target });
    const c = (gData as Connection[] | null)?.[0];
    if (!c) return Response.json({ error: 'not_found' }, { status: 404, headers: cors });
    const error = await syncGoogle(c);
    return Response.json({ ok: !error, error }, { headers: cors });
  }

  return Response.json({ error: 'bad_request' }, { status: 400, headers: cors });
});
