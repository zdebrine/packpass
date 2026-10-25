// node --test supabase/functions/calendar-sync/ics.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { feedUrl, parseDuration, parseIcs, parseTime, unfold } from './ics.ts';

const cal = (...events: string[]) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gingr//EN', ...events, 'END:VCALENDAR'].join('\r\n');
const ev = (...lines: string[]) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'].join('\r\n');
const from = new Date('2026-11-02T00:00:00Z');
const to = new Date('2026-11-16T00:00:00Z');

test('folded lines join before reading', () => {
  assert.deepEqual(unfold('SUMMARY:Private\r\n  client\r\nUID:1'), ['SUMMARY:Private client', 'UID:1']);
});

test('UTC, zoned and floating times', () => {
  assert.equal(new Date(parseTime('20261103T170000Z')!).toISOString(), '2026-11-03T17:00:00.000Z');
  // Austin is UTC−6 in November (after DST ends Nov 1) and UTC−5 in October.
  assert.equal(new Date(parseTime('20261103T110000', 'America/Chicago')!).toISOString(), '2026-11-03T17:00:00.000Z');
  assert.equal(new Date(parseTime('20261020T110000', 'America/Chicago')!).toISOString(), '2026-10-20T16:00:00.000Z');
  assert.equal(new Date(parseTime('20261103T110000', 'America/New_York')!).toISOString(), '2026-11-03T16:00:00.000Z');
  // No zone, or one the runtime doesn't know: Austin.
  assert.equal(new Date(parseTime('20261103T110000')!).toISOString(), '2026-11-03T17:00:00.000Z');
  assert.equal(new Date(parseTime('20261103T110000', 'Gingr Standard Time')!).toISOString(), '2026-11-03T17:00:00.000Z');
  assert.equal(parseTime('20261103'), null);
});

test('durations', () => {
  assert.equal(parseDuration('PT1H30M'), 90 * 60_000);
  assert.equal(parseDuration('P1D'), 86_400_000);
  assert.equal(parseDuration('P1W'), 7 * 86_400_000);
  assert.equal(parseDuration('nope'), null);
});

test('timed events become busy times; all-day, free and cancelled ones do not', () => {
  const busy = parseIcs(cal(
    ev('UID:a', 'DTSTART;TZID=America/Chicago:20261103T120000', 'DTEND;TZID=America/Chicago:20261103T140000', 'SUMMARY:Private client'),
    ev('UID:b', 'DTSTART;VALUE=DATE:20261104', 'DTEND;VALUE=DATE:20261105', 'SUMMARY:Holiday'),
    ev('UID:c', 'DTSTART:20261105T150000Z', 'DTEND:20261105T160000Z', 'TRANSP:TRANSPARENT', 'SUMMARY:Maybe'),
    ev('UID:d', 'DTSTART:20261106T150000Z', 'DTEND:20261106T160000Z', 'STATUS:CANCELLED', 'SUMMARY:Off'),
    ev('UID:e', 'DTSTART:20261107T150000Z', 'DURATION:PT45M', 'SUMMARY:Vet visit\\, Rex'),
    ev('UID:f', 'DTSTART:20261201T150000Z', 'DTEND:20261201T160000Z', 'SUMMARY:Too far out'),
  ), from, to);
  assert.deepEqual(busy, [
    { starts_at: '2026-11-03T18:00:00.000Z', ends_at: '2026-11-03T20:00:00.000Z', title: 'Private client' },
    { starts_at: '2026-11-07T15:00:00.000Z', ends_at: '2026-11-07T15:45:00.000Z', title: 'Vet visit, Rex' },
  ]);
});

test('weekly repeats on chosen days, with a skipped and a moved date', () => {
  const busy = parseIcs(cal(
    ev('UID:w', 'DTSTART;TZID=America/Chicago:20261026T090000', 'DTEND;TZID=America/Chicago:20261026T100000', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261112T235959Z',
       'EXDATE;TZID=America/Chicago:20261104T090000', 'SUMMARY:Board and train'),
    ev('UID:w', 'RECURRENCE-ID;TZID=America/Chicago:20261109T090000', 'DTSTART;TZID=America/Chicago:20261109T130000', 'DTEND;TZID=America/Chicago:20261109T140000', 'SUMMARY:Board and train'),
  ), from, to);
  // Mon Nov 2, Wed Nov 4 skipped, Mon Nov 9 moved to 1 pm, Wed Nov 11; 9 am Austin is 15:00 UTC after Nov 1.
  assert.deepEqual(busy.map((b) => b.starts_at), ['2026-11-02T15:00:00.000Z', '2026-11-09T19:00:00.000Z', '2026-11-11T15:00:00.000Z']);
});

test('daily repeats keep the wall-clock time across the end of daylight saving, and stop at COUNT', () => {
  const busy = parseIcs(cal(
    ev('UID:d', 'DTSTART;TZID=America/Chicago:20261030T080000', 'DTEND;TZID=America/Chicago:20261030T083000', 'RRULE:FREQ=DAILY;INTERVAL=2;COUNT=4', 'SUMMARY:Walks'),
  ), new Date('2026-10-29T00:00:00Z'), to);
  assert.deepEqual(busy.map((b) => b.starts_at), ['2026-10-30T13:00:00.000Z', '2026-11-01T14:00:00.000Z', '2026-11-03T14:00:00.000Z', '2026-11-05T14:00:00.000Z']);
});

test('an alarm inside an event is not an event of its own', () => {
  const busy = parseIcs(cal(ev('UID:x', 'DTSTART:20261103T150000Z', 'DTEND:20261103T160000Z', 'SUMMARY:Class', 'BEGIN:VALARM', 'TRIGGER:-PT15M', 'DESCRIPTION:Reminder', 'END:VALARM')), from, to);
  assert.deepEqual(busy.map((b) => b.title), ['Class']);
});

test('feed URLs: public https or webcal only', () => {
  assert.equal(feedUrl('webcal://app.gingrapp.com/ical/abc.ics')?.href, 'https://app.gingrapp.com/ical/abc.ics');
  assert.ok(feedUrl('https://calendar.google.com/calendar/ical/x/private-y/basic.ics'));
  for (const bad of ['http://example.com/a.ics', 'https://localhost/a.ics', 'https://10.0.0.1/a.ics', 'https://[::1]/a.ics', 'https://user:pw@example.com/a.ics', 'file:///etc/passwd', 'nope']) {
    assert.equal(feedUrl(bad), null, bad);
  }
});
