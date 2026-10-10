import { catalog, sessionById } from '@/data/catalog';
import type { Booking, ClassType, Partner, Session, Trainer } from '@/data/types';
import { now } from './clock';
import { dayOffset, time } from './dates';

export interface SessionView {
  session: Session;
  cls: ClassType;
  partner: Partner;
  trainer: Trainer;
}

export function view(sessionId: string): SessionView | undefined {
  const session = sessionById(sessionId);
  if (!session) return undefined;
  const cls = catalog.classes[session.classId];
  if (!cls) return undefined;
  return { session, cls, partner: catalog.partners[cls.partnerId], trainer: catalog.trainers[cls.trainerId] };
}

export const credits = (n: number) => `${n} ${n === 1 ? 'credit' : 'credits'}`;

/** "6:30 pm" or the open window for sniff spaces. */
export const timeLabel = (v: SessionView) => v.cls.openWindow ?? time(v.session.startsAt);

// ---- Rules ---------------------------------------------------------------------------------
// The same rules as public.booking_block() / book_session() in supabase/migrations, with the
// same reason codes, so sample mode and live mode behave alike.

export type BlockCode = 'started' | 'needs_herding' | 'needs_social' | 'records_denied' | 'vaccines';
export type BookError = BlockCode | 'already_booked' | 'full' | 'credits' | 'not_found';

/** What the rules need to know about the member and dog. */
export interface RuleContext {
  /** Valid Social clearance (granted, not expired). Seen or not doesn't matter for booking. */
  hasSocial: boolean;
  /** Partners where the dog holds a Herding clearance. */
  herdingAt: string[];
  /** Classes that are steps on a path the dog is still working through. */
  pathClasses: string[];
  /** PackPass denied the dog's vet record; booking waits for a new upload. */
  recordsDenied: boolean;
  /** Last day all three vaccines are current, or null if any is missing. */
  vaccinesUntil: Date | null;
  credits: number;
  bookings: Booking[];
}

export function blockFor(cls: ClassType, session: Session, ctx: RuleContext): BlockCode | null {
  if (session.startsAt <= now()) return 'started';
  if (cls.requires === 'herding' && !ctx.herdingAt.includes(cls.partnerId)) return 'needs_herding';
  const groupClass = cls.sessionType === 'Class' && cls.groupSize > 1;
  if (groupClass && !ctx.hasSocial && !ctx.pathClasses.includes(cls.id)) return 'needs_social';
  if (ctx.recordsDenied) return 'records_denied';
  if (!ctx.vaccinesUntil || dayOffset(session.startsAt, ctx.vaccinesUntil) > 0) return 'vaccines';
  return null;
}

export function bookError(sessionId: string, dogId: string, ctx: RuleContext): BookError | null {
  const v = view(sessionId);
  if (!v) return 'not_found';
  const block = blockFor(v.cls, v.session, ctx);
  if (block) return block;
  if (ctx.bookings.some((b) => b.sessionId === sessionId && b.dogId === dogId && b.status !== 'cancelled')) return 'already_booked';
  if (v.session.spotsLeft <= 0) return 'full';
  if (ctx.credits < v.cls.credits) return 'credits';
  return null;
}

export type Eligibility =
  | { ok: true; cleared: boolean }
  | { ok: false; needs: 'herding' | 'social' | 'vaccines'; reason: string };

/** For badges and the class detail box: can the dog book this class, and is it "Cleared"? */
export function eligibility(v: SessionView, ctx: RuleContext, dogName = 'Juno'): Eligibility {
  const block = blockFor(v.cls, v.session, ctx);
  if (block === 'needs_herding') return { ok: false, needs: 'herding', reason: 'This class needs a Herding assessment first.' };
  if (block === 'needs_social') return { ok: false, needs: 'social', reason: 'This class needs a Social clearance first.' };
  if (block === 'records_denied') return { ok: false, needs: 'vaccines', reason: `PackPass denied ${dogName}'s vet record. Upload a new one to book.` };
  if (block === 'vaccines') return { ok: false, needs: 'vaccines', reason: `${dogName}'s vaccines need updating before this date.` };
  const groupClass = v.cls.sessionType === 'Class' && v.cls.groupSize > 1;
  return { ok: true, cleared: groupClass && ctx.hasSocial };
}

// ---- Lookups -------------------------------------------------------------------------------

const byStart = (a: Session, b: Session) => +a.startsAt - +b.startsAt;

/** The next session of a class that hasn't started, optionally from a given day on. */
export function nextSession(classId: string, fromDay = 0): SessionView | undefined {
  const s = catalog.sessions
    .filter((x) => x.classId === classId && x.startsAt > now() && dayOffset(x.startsAt) >= fromDay)
    .sort(byStart)[0];
  return s ? view(s.id) : undefined;
}

/** The first session of a class on a given day (0 = today). */
export function sessionOn(classId: string, day: number): SessionView | undefined {
  const s = catalog.sessions.filter((x) => x.classId === classId && dayOffset(x.startsAt) === day).sort(byStart)[0];
  return s ? view(s.id) : undefined;
}

/** The assessment that unlocks a gated class, at the same partner. */
export function assessmentFor(cls: ClassType): SessionView | undefined {
  const a = Object.values(catalog.classes).find((c) => c.grants === cls.requires && c.partnerId === cls.partnerId);
  return a ? nextSession(a.id) : undefined;
}

/** Other start times for the same class on the same day (booking sheet time chips). */
export function sameDaySessions(v: SessionView) {
  const off = dayOffset(v.session.startsAt);
  return catalog.sessions.filter((s) => s.classId === v.cls.id && dayOffset(s.startsAt) === off).sort(byStart);
}

/** Sessions for Book: one category, one day. */
export function sessionsFor(category: ClassType['category'], day: number) {
  return catalog.sessions
    .filter((s) => catalog.classes[s.classId]?.category === category && dayOffset(s.startsAt) === day)
    .sort(byStart)
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

/** Credits a cancellation gives back: all of them until 12 hours before the start, none after (cancel_booking). */
export const cancelRefund = (startsAt: Date, credits: number, at = now()) =>
  startsAt.getTime() - at.getTime() >= 12 * 3_600_000 ? credits : 0;
