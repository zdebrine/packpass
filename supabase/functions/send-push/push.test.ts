// node --test supabase/functions/send-push/push.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { deliver, expoSender, messagesFor, type ExpoMessage, type NotificationRow } from './push.ts';

const note = (kind: string): NotificationRow => ({
  id: 'n1', member_id: 'm1', kind, title: 'Juno\'s held spots release soon', body: '2 held group sessions go back…', href: '/',
});

test('only interrupting kinds become pushes', () => {
  assert.equal(messagesFor(note('booked'), ['ExponentPushToken[a]']).length, 0);
  const [m] = messagesFor(note('hold_expiring'), ['ExponentPushToken[a]']);
  assert.deepEqual(m.data, { href: '/', notificationId: 'n1' });
});

test('sends to every device, batches by 100, forgets unregistered devices', async () => {
  const tokens = Array.from({ length: 150 }, (_, i) => `ExponentPushToken[${i}]`);
  const batches: number[] = [];
  let forgotten: string[] = [];
  const out = await deliver(note('hold_expiring'), {
    tokensFor: async () => tokens,
    send: async (ms: ExpoMessage[]) => {
      batches.push(ms.length);
      return ms.map((m) => (m.to === 'ExponentPushToken[7]'
        ? { status: 'error' as const, message: 'gone', details: { error: 'DeviceNotRegistered' } }
        : { status: 'ok' as const, id: m.to }));
    },
    forget: async (t) => { forgotten = t; },
  });
  assert.deepEqual(batches, [100, 50]);
  assert.deepEqual(out, { sent: 149, forgotten: 1 });
  assert.deepEqual(forgotten, ['ExponentPushToken[7]']);
});

test('a booking confirmation never looks up devices', async () => {
  let asked = false;
  await deliver(note('booked'), { tokensFor: async () => { asked = true; return []; }, send: async () => [], forget: async () => {} });
  assert.equal(asked, false);
});

test('the Expo sender posts JSON and reads tickets', async () => {
  let seen: RequestInit | undefined;
  const send = expoSender((async (_url: string, init: RequestInit) => {
    seen = init;
    return new Response(JSON.stringify({ data: [{ status: 'ok', id: 't1' }] }), { status: 200 });
  }) as typeof fetch, 'secret');
  const tickets = await send(messagesFor(note('clearance_earned'), ['ExponentPushToken[a]']));
  assert.equal(tickets[0].status, 'ok');
  assert.equal((seen!.headers as Record<string, string>).authorization, 'Bearer secret');
});
