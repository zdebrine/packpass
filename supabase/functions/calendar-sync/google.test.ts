// node --test supabase/functions/calendar-sync/google.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { authUrl, busyFromEvents, emailFromIdToken, eventFor, hashEvent, plan, type ExportRow } from './google.ts';

test('the consent page asks for offline calendar access', () => {
  const u = new URL(authUrl('client-1', 'https://x.supabase.co/functions/v1/calendar-sync/google/callback', 'st-1'));
  assert.equal(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(u.searchParams.get('client_id'), 'client-1');
  assert.equal(u.searchParams.get('state'), 'st-1');
  assert.equal(u.searchParams.get('access_type'), 'offline');
  assert.equal(u.searchParams.get('prompt'), 'consent');
  assert.match(u.searchParams.get('scope')!, /calendar\.events/);
});

test('the email comes from the ID token', () => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  assert.equal(emailFromIdToken(`${b64({ alg: 'RS256' })}.${b64({ email: 'dana@barkwise.co', sub: '1' })}.sig`), 'dana@barkwise.co');
  assert.equal(emailFromIdToken('nonsense'), null);
  assert.equal(emailFromIdToken(undefined), null);
});

test('busy times: timed events only, not cancelled, free or PackPass\'s own', () => {
  const busy = busyFromEvents([
    { summary: 'Private client', start: { dateTime: '2026-11-03T11:00:00-06:00' }, end: { dateTime: '2026-11-03T12:00:00-06:00' } },
    { summary: 'Holiday', start: { date: '2026-11-04' }, end: { date: '2026-11-05' } },
    { summary: 'Cancelled', status: 'cancelled', start: { dateTime: '2026-11-03T13:00:00Z' }, end: { dateTime: '2026-11-03T14:00:00Z' } },
    { summary: 'Lunch (free)', transparency: 'transparent', start: { dateTime: '2026-11-03T18:00:00Z' }, end: { dateTime: '2026-11-03T19:00:00Z' } },
    { summary: 'Agility · Juno', extendedProperties: { private: { packpass: 's1' } }, start: { dateTime: '2026-11-03T20:00:00Z' }, end: { dateTime: '2026-11-03T21:00:00Z' } },
    { summary: 'Backwards', start: { dateTime: '2026-11-03T22:00:00Z' }, end: { dateTime: '2026-11-03T21:00:00Z' } },
  ]);
  assert.deepEqual(busy, [{ starts_at: '2026-11-03T17:00:00.000Z', ends_at: '2026-11-03T18:00:00.000Z', title: 'Private client' }]);
});

const row = (o: Partial<ExportRow>): ExportRow => ({
  session_id: 's1', starts_at: '2026-11-07T16:00:00Z', ends_at: '2026-11-07T17:00:00Z', title: 'Agility Foundations', dogs: 'Juno, Max',
  event_id: null, hash: null, ...o,
});

test('the event names the class and dogs, links the roster and is marked as PackPass\'s', () => {
  const e = eventFor(row({}), 'https://partners.packpass.co/');
  assert.equal(e.summary, 'Agility Foundations · Juno, Max');
  assert.equal(e.description, 'Booked through PackPass: Juno, Max.\nRoster: https://partners.packpass.co/roster?s=s1');
  assert.equal(e.start?.dateTime, '2026-11-07T16:00:00.000Z');
  assert.equal(e.extendedProperties?.private?.packpass, 's1');
});

test('plan: write new, rewrite changed, keep unchanged, remove gone', async () => {
  const same = await hashEvent(eventFor(row({ session_id: 's2' }), 'https://p.co'));
  const steps = await plan([
    row({}),
    row({ session_id: 's2', event_id: 'e2', hash: same }),
    row({ session_id: 's3', event_id: 'e3', hash: 'old' }),
    row({ session_id: 's4', event_id: 'e4', hash: 'x', title: null, dogs: null, starts_at: null, ends_at: null }),
    row({ session_id: 's5', title: null, dogs: null }),
  ], 'https://p.co');
  assert.deepEqual(steps.map((s) => [s.kind, s.row.session_id]), [['insert', 's1'], ['update', 's3'], ['remove', 's4']]);
  assert.match((steps[0] as { hash: string }).hash, /^[0-9a-f]{32}$/);
});
