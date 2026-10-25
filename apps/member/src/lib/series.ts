// Standing bookings (Repeat weekly). Live mode gets each series and its dates from my_series()
// (supabase/migrations/…_standing_bookings.sql); sample mode keeps the rule and works the dates out
// here, the same way: the class's sessions on that weekday and time, through the end of the credit
// month, up to the until date.
import { catalog } from '@/data/catalog';
import type { Booking, Series, SeriesDate, Session } from '@/data/types';
import { now } from './clock';
import { weekday } from './dates';

export interface SeriesRule {
  id: string;
  dogId: string;
  classId: string;
  weekday: number;
  /** Minutes after midnight. */
  minutes: number;
  until: string | null;
}

const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The first of next month: when sample credits reset, and where a credit month ends without a renewal date. */
export const monthEnd = (at = now()) => new Date(at.getFullYear(), at.getMonth() + 1, 1);

export const ruleFor = (id: string, session: Session, dogId: string, until: string | null): SeriesRule => ({
  id, dogId, classId: session.classId, weekday: session.startsAt.getDay(), minutes: minutesOf(session.startsAt), until,
});

/** The rule's sessions still ahead, before `end`, up to its until date. */
export function ruleSessions(rule: SeriesRule, end: Date): Session[] {
  return catalog.sessions
    .filter((s) => s.classId === rule.classId && !s.offered && s.startsAt > now() && s.startsAt < end
      && s.startsAt.getDay() === rule.weekday && minutesOf(s.startsAt) === rule.minutes
      && (!rule.until || isoDay(s.startsAt) <= rule.until))
    .sort((a, b) => +a.startsAt - +b.startsAt);
}

/** Sample mode's my_series(): each date with its booking's state. */
export function seriesPlan(rule: SeriesRule, bookings: Booking[], end: Date): Series {
  const dates: SeriesDate[] = ruleSessions(rule, end).map((s) => {
    const mine = bookings.filter((b) => b.sessionId === s.id && b.dogId === rule.dogId);
    const b = mine.find((x) => x.status !== 'cancelled') ?? mine[0];
    return { sessionId: s.id, startsAt: s.startsAt, bookingId: b?.id, status: !b ? 'short' : b.status === 'cancelled' ? 'cancelled' : 'booked' };
  });
  return { id: rule.id, dogId: rule.dogId, classId: rule.classId, until: rule.until, dates };
}

/** "Every Saturday" */
export const everyLabel = (d: Date) => `Every ${weekday(d)}`;
