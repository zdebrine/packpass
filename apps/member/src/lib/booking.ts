import { catalog, clearanceName, sessionById } from '@/data/catalog';
import type { Booking, ClassType, Partner, Session, Trainer, Waiver } from '@/data/types';
import { now } from './clock';
import { dayOffset, time } from './dates';
import { gateFor, gateLabel, type DogFacts, type GateCode } from './fit';

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

/** `needs_<clearance id>`: needs_social, needs_herding, or a clearance PackPass added. */
export type BlockCode = 'started' | 'already_cleared' | GateCode | `needs_${string}` | 'records_denied' | 'vaccines';
export type BookError = BlockCode | 'waiver' | 'partner_waiver' | 'already_booked' | 'full' | 'credits' | 'not_found';

/** What the rules need to know about the member and dog. */
export interface RuleContext {
  /** The dog's birthday, weight and spayed/neutered status, for the class's own gates (src/lib/fit.ts). */
  dog?: DogFacts;
  /** Valid Social clearance (granted, not expired). Seen or not doesn't matter for booking. */
  hasSocial: boolean;
  /** Partners where the dog holds a Herding clearance. */
  herdingAt: string[];
  /** The dog's other valid clearances (not Social or Herding), and where they count. */
  cleared?: { type: string; partnerId: string; scope: 'network' | 'partner' }[];
  /** Classes that are steps on a path the dog is still working through. */
  pathClasses: string[];
  /** PackPass denied the dog's vet record; booking waits for a new upload. */
  recordsDenied: boolean;
  /** Last day all three vaccines are current, or null if any is missing. */
  vaccinesUntil: Date | null;
  credits: number;
  bookings: Booking[];
  /** The waiver the member still has to sign to book at a partner (src/lib/ready.ts). Not a block: the sheet signs it. */
  waiverFor?: (partnerId: string) => Waiver | null;
}

/** Classes that ask for a Social clearance: the partner set it, or a Herding group class (it needs both). */
export const needsSocial = (cls: ClassType) =>
  cls.requires === 'social' || (cls.requires === 'herding' && cls.sessionType === 'Class' && cls.groupSize > 1);

/** Whether the dog holds a valid clearance that counts at this partner. */
export function holdsClearance(ctx: RuleContext, type: string, partnerId: string) {
  if (type === 'social') return ctx.hasSocial;
  if (type === 'herding') return ctx.herdingAt.includes(partnerId);
  return (ctx.cleared ?? []).some((k) => k.type === type && (k.scope === 'network' || k.partnerId === partnerId));
}

/** Clearances other than Social and Herding a class needs: the one it requires, then the one group classes also need. */
function otherNeeds(cls: ClassType): string[] {
  if (!cls.requires || cls.requires === 'social' || cls.requires === 'herding') return [];
  const also = cls.sessionType === 'Class' && cls.groupSize > 1 ? catalog.clearanceTypes[cls.requires]?.groupAlsoRequires : null;
  return also ? [cls.requires, also] : [cls.requires];
}

export function blockFor(cls: ClassType, session: Session, ctx: RuleContext): BlockCode | null {
  if (session.startsAt <= now()) return 'started';
  // An assessment the dog has already passed (Herding counts at the partner that assessed it).
  if (cls.grants && holdsClearance(ctx, cls.grants, cls.partnerId)) return 'already_cleared';
  const gate = gateFor(cls, ctx.dog, session.startsAt);
  if (gate) return gate;
  if (cls.requires === 'herding' && !ctx.herdingAt.includes(cls.partnerId)) return 'needs_herding';
  if (needsSocial(cls) && !ctx.hasSocial && !ctx.pathClasses.includes(cls.id)) return 'needs_social';
  for (const need of otherNeeds(cls)) {
    if (!holdsClearance(ctx, need, cls.partnerId) && !ctx.pathClasses.includes(cls.id)) return `needs_${need}`;
  }
  if (ctx.recordsDenied) return 'records_denied';
  if (!ctx.vaccinesUntil || dayOffset(session.startsAt, ctx.vaccinesUntil) > 0) return 'vaccines';
  return null;
}

export function bookError(sessionId: string, dogId: string, ctx: RuleContext): BookError | null {
  const v = view(sessionId);
  if (!v) return 'not_found';
  const block = blockFor(v.cls, v.session, ctx);
  if (block) return block;
  const waiver = ctx.waiverFor?.(v.cls.partnerId);
  if (waiver) return waiver.partnerId ? 'partner_waiver' : 'waiver';
  if (ctx.bookings.some((b) => b.sessionId === sessionId && b.dogId === dogId && b.status !== 'cancelled')) return 'already_booked';
  if (v.session.spotsLeft <= 0) return 'full';
  if (ctx.credits < v.cls.credits) return 'credits';
  return null;
}

export type Eligibility =
  | { ok: true; cleared: boolean }
  | { ok: false; needs: 'herding' | 'social' | 'vaccines'; reason: string }
  /** A clearance PackPass added (not Social or Herding): `clearance` is its id. */
  | { ok: false; needs: 'clearance'; clearance: string; reason: string }
  /** An assessment for a clearance the dog already holds: Book leaves it out. */
  | { ok: false; needs: 'cleared'; reason: string }
  /** The class isn't for this dog (age, size, breed, spayed or neutered): nothing to unlock. `label` is the class's rule. */
  | { ok: false; needs: 'fit'; reason: string; label: string };

/** For badges and the class detail box: can the dog book this class, and is it "Cleared"? */
export function eligibility(v: SessionView, ctx: RuleContext, dogName = 'Juno'): Eligibility {
  const block = blockFor(v.cls, v.session, ctx);
  if (block === 'already_cleared') {
    return { ok: false, needs: 'cleared', reason: `${dogName} already passed this. The ${clearanceName(v.cls.grants ?? 'social')} clearance is on the Passport.` };
  }
  if (block === 'too_young' || block === 'too_old' || block === 'too_small' || block === 'too_large' || block === 'breed_only' || block === 'needs_fixed') {
    const label = gateLabel(v.cls, block);
    const rule = label.replace(/^Ages /, 'dogs aged ').replace(/^./, (x) => x.toLowerCase());
    return { ok: false, needs: 'fit', label, reason: `This class is for ${rule}.` };
  }
  if (block === 'needs_herding') return { ok: false, needs: 'herding', reason: 'This class needs a Herding assessment first.' };
  if (block === 'needs_social') return { ok: false, needs: 'social', reason: 'This class needs a Social clearance first.' };
  if (block?.startsWith('needs_') && block !== 'needs_fixed') {
    const id = block.slice('needs_'.length);
    return { ok: false, needs: 'clearance', clearance: id, reason: `This class needs a ${clearanceName(id)} clearance first.` };
  }
  if (block === 'records_denied') return { ok: false, needs: 'vaccines', reason: `PackPass denied ${dogName}'s vet record. Upload a new one to book.` };
  if (block === 'vaccines') return { ok: false, needs: 'vaccines', reason: `${dogName}'s vaccines need updating before this date.` };
  return { ok: true, cleared: needsSocial(v.cls) && ctx.hasSocial };
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

/** The soonest session of any of these classes (a path step's Path classes) that hasn't started. */
export function nextSessionOf(classIds: string[]): SessionView | undefined {
  return classIds.map((id) => nextSession(id)).filter((x): x is SessionView => !!x)
    .sort((a, b) => byStart(a.session, b.session))[0];
}

/** The first session of a class on a given day (0 = today). */
export function sessionOn(classId: string, day: number): SessionView | undefined {
  const s = catalog.sessions.filter((x) => x.classId === classId && dayOffset(x.startsAt) === day).sort(byStart)[0];
  return s ? view(s.id) : undefined;
}

/** The assessment that unlocks a gated class, at the same partner. */
/** The next assessment for the clearance a class needs (`type`, else what it requires): at its partner first, and for a network-wide clearance at any partner. */
export function assessmentFor(cls: ClassType, type = cls.requires): SessionView | undefined {
  const all = Object.values(catalog.classes).filter((c) => c.grants === type);
  const here = all.find((c) => c.partnerId === cls.partnerId);
  if (here) return nextSession(here.id);
  if (catalog.clearanceTypes[type ?? '']?.scope !== 'network') return undefined;
  return all.map((c) => nextSession(c.id)).filter((x): x is SessionView => !!x).sort((a, b) => +a.session.startsAt - +b.session.startsAt)[0];
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

/** Check-in closes this many minutes after the start (check_in); after that a booking nobody checked in is missed. */
export const CHECK_IN_CLOSES_MIN = 15;
/** When check-in closes for a session starting at `startsAt`. */
export const checkInClosesAt = (startsAt: Date) => new Date(startsAt.getTime() + CHECK_IN_CLOSES_MIN * 60_000);

/** Credits a cancellation gives back: all of them until 12 hours before the start, none after (cancel_booking). */
export const cancelRefund = (startsAt: Date, credits: number, at = now()) =>
  startsAt.getTime() - at.getTime() >= 12 * 3_600_000 ? credits : 0;
