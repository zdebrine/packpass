// node --test supabase/functions/send-email/email.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { linkFor, render, resendSender, type NotificationRow } from './email.ts';

const note = (kind: string, o: Partial<NotificationRow> = {}): NotificationRow => ({
  id: 'n1', member_id: 'm1', kind, title: 'In 2 hours: Sniff space', body: 'South Fork Yard, 1200 S Lamar. You stay with Juno. Free cancel closed Tue 4:00 am.',
  href: '/class/s1?dog=d1', ...o,
});
const ctx = { email: 'rae@example.com', name: 'Rae Minder', partner: 'South Fork Yard', address: '1200 S Lamar' };

test('only reminder kinds with an address become emails', () => {
  assert.equal(render(note('hold_expiring'), ctx, 'https://app.packpass.app'), null);
  assert.equal(render(note('reminder_2h'), { ...ctx, email: null }, 'https://app.packpass.app'), null);
  assert.ok(render(note('reminder_2h'), ctx, 'https://app.packpass.app'));
});

test('the email carries the notification, a link into the app and directions before class', () => {
  const e = render(note('reminder_2h'), ctx, 'https://app.packpass.app/')!;
  assert.equal(e.to, 'rae@example.com');
  assert.equal(e.subject, 'In 2 hours: Sniff space');
  assert.match(e.html, /href="https:\/\/app\.packpass\.app\/class\/s1\?dog=d1"/);
  assert.match(e.html, />Check in</);
  assert.match(e.html, /google\.com\/maps\/dir/);
  assert.match(e.text, /Free cancel closed/);
  assert.doesNotMatch(render(note('reminder_24h'), ctx, 'https://app.packpass.app')!.html, /Directions/);
});

test('text from the database is escaped', () => {
  const e = render(note('booked', { title: 'Booked. <b>Fetch</b> & play' }), ctx, 'https://app.packpass.app')!;
  assert.match(e.html, /Booked\. &lt;b&gt;Fetch&lt;\/b&gt; &amp; play/);
});

test('links without an href open notifications', () => {
  assert.equal(linkFor(note('nudge_10d', { href: null }), 'https://app.packpass.app'), 'https://app.packpass.app/notifications');
});

test('sends through Resend', async () => {
  let sent: { url: string; body: Record<string, unknown> } | null = null;
  const fake = (async (url: string, init: RequestInit) => {
    sent = { url, body: JSON.parse(init.body as string) };
    return new Response(JSON.stringify({ id: 'em_1' }), { status: 200 });
  }) as unknown as typeof fetch;
  const id = await resendSender(fake, 're_x', 'PackPass <hello@packpass.app>')(render(note('booked'), ctx, 'https://app.packpass.app')!);
  assert.equal(id, 'em_1');
  assert.equal(sent!.url, 'https://api.resend.com/emails');
  assert.deepEqual(sent!.body.to, ['rae@example.com']);
});
