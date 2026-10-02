import { classes, partners, sessionById, sessions, trainers } from '@/data/fixtures';
import type { Booking, ClassType, Session } from '@/data/types';
import type { SocialStage } from '@/store/app';
import { dayOffset, time } from './dates';

export interface SessionView {
  session: Session;
  cls: ClassType;
  partner: (typeof partners)[string];
  trainer: (typeof trainers)[string];
}

export function view(sessionId: string): SessionView | undefined {
  const session = sessionById(sessionId);
  if (!session) return undefined;
  const cls = classes[session.classId];
  return { session, cls, partner: partners[cls.partnerId], trainer: trainers[cls.trainerId] };
}

export const credits = (n: number) => `${n} ${n === 1 ? 'credit' : 'credits'}`;

/** "6:30 pm" or the open window for sniff spaces. */
export const timeLabel = (v: SessionView) => v.cls.openWindow ?? time(v.session.startsAt);

export type Eligibility =
  | { ok: true; cleared: boolean }
  | { ok: false; needs: 'herding'; reason: string };

/**
 * Whether the dog can book this class, and whether to show the "Cleared" chip.
 * Social clearance gates nothing in v1 (see docs/TECH_SPEC.md §8): the chip only shows once Juno has it.
 */
export function eligibility(cls: ClassType, social: SocialStage, socialExpired: boolean): Eligibility {
  if (cls.requires === 'herding') {
    return { ok: false, needs: 'herding', reason: 'This class needs a Herding assessment first.' };
  }
  const groupClass = cls.sessionType === 'Class' && cls.groupSize > 1;
  return { ok: true, cleared: groupClass && social === 'cleared' && !socialExpired };
}

/** The assessment that unlocks a gated class, at the same partner. */
export function assessmentFor(cls: ClassType): SessionView | undefined {
  const a = Object.values(classes).find((c) => c.grants === cls.requires && c.partnerId === cls.partnerId);
  if (!a) return undefined;
  const next = sessions.filter((s) => s.classId === a.id).sort((x, y) => +x.startsAt - +y.startsAt)[0];
  return next ? view(next.id) : undefined;
}

/** Other start times for the same class on the same day (booking sheet time chips). */
export function sameDaySessions(v: SessionView) {
  const off = dayOffset(v.session.startsAt);
  return sessions
    .filter((s) => s.classId === v.cls.id && dayOffset(s.startsAt) === off)
    .sort((a, b) => +a.startsAt - +b.startsAt);
}

/** Sessions for Book: one category, one day. */
export function sessionsFor(category: ClassType['category'], day: number) {
  return sessions
    .filter((s) => classes[s.classId].category === category && dayOffset(s.startsAt) === day)
    .sort((a, b) => +a.startsAt - +b.startsAt)
    .map((s) => view(s.id)!);
}

export const activeBookings = (bookings: Booking[]) =>
  bookings
    .filter((b) => b.status !== 'cancelled')
    .map((b) => ({ booking: b, v: view(b.sessionId)! }))
    .filter((x) => x.v)
    .sort((a, b) => +a.v.session.startsAt - +b.v.session.startsAt);

export const bookingFor = (bookings: Booking[], sessionId: string) =>
  bookings.find((b) => b.sessionId === sessionId && b.status !== 'cancelled');
