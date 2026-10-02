import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

import type { SessionView } from './booking';

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s: string) => s.replace(/[\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');

/** An iCalendar file for one session, for the web (opens in Calendar, Outlook or Google). */
export function ics(v: SessionView) {
  const { cls, partner, session } = v;
  const end = new Date(session.startsAt.getTime() + cls.durationMin * 60_000);
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PackPass//Member app//EN', 'BEGIN:VEVENT',
    `UID:${session.id}@packpass.app`, `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(session.startsAt)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(`${cls.title} · PackPass`)}`, `LOCATION:${esc(`${partner.name}, ${partner.address}`)}`,
    `DESCRIPTION:${esc(`${cls.description}\n\nCheck in with the PackPass app at the entrance.`)}`,
    'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', `DESCRIPTION:${esc(cls.title)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}

/**
 * Adds a booked session to the member's calendar. Phones open the system "new event" sheet with
 * everything filled in (no calendar access needed); the web downloads an .ics file.
 * Resolves true if the member saved it (or, on Android and web, once the sheet or file opens).
 */
export async function addToCalendar(v: SessionView): Promise<boolean> {
  const { cls, partner, session } = v;
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([ics(v)], { type: 'text/calendar' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${cls.id}.ics` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  }
  const r = await Calendar.createEventInCalendarAsync({
    title: cls.title,
    startDate: session.startsAt,
    endDate: new Date(session.startsAt.getTime() + cls.durationMin * 60_000),
    location: `${partner.name}, ${partner.address}`,
    notes: 'Check in with the PackPass app at the entrance.',
    alarms: [{ relativeOffset: -60 }],
  });
  return r.action === 'saved' || r.action === 'done';
}
