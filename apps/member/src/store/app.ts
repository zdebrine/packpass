import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { isLive } from '@/api/client';
import * as live from '@/api/live';
import { dogs as sampleDogs, INITIAL_BOOKINGS, INITIAL_CREDITS, JUNO_VACCINES, TRAIT_SPECIAL, type Energy } from '@/data/fixtures';
import { INITIALLY_READ, notifications as sampleNotifications, PATH_CLASSES, type Goal, type Notif } from '@/data/passport';
import { planOf } from '@/data/plans';
import type { Booking, ClearanceRecord, Dog, LogEntry, Membership, PathProgress, PhotoSource, PickedDoc, VaccineRecord, WaitEntry } from '@/data/types';
import { now } from '@/lib/clock';
import { applyDistances, areaNamed, DEFAULT_AREA, type Origin } from '@/lib/location';
import { bookError, cancelRefund, view, type BookError, type RuleContext } from '@/lib/booking';

export type Appearance = 'system' | 'light' | 'dark';
/** working: on the Calm around dogs path. earned: re-check passed, not seen yet. cleared: seen on screen 13. */
export type SocialStage = 'working' | 'earned' | 'cleared';

export interface OnboardingDraft {
  ownerName: string;
  email: string;
  dogName: string;
  /** Sample mode starts with Juno's photo; a picked photo is a JPEG data URI until it's uploaded. */
  photo: PhotoSource | null;
  sex: 'Female' | 'Male';
  breed: string;
  mixed: boolean;
  notSure: boolean;
  birthMonth: number; // 0 to 11
  birthYear: number;
  weight: number;
  fixed: boolean;
  energy: Energy;
  social: string;
  interests: string[];
  /** Trait ids from the catalog (src/data/traits.ts). */
  traits: string[];
  /** "Trains near" (01g); one of AREAS in src/lib/location.ts. */
  area: string;
}

/** For persisted state from before v5, which stored labels (supabase/migrations/20261005000100_trait_catalog.sql has the same backfill). */
const LEGACY_ENERGY: Record<string, Energy> = { Couch: 'couch', Medium: 'medium', High: 'high', 'Working dog': 'working' };
const LEGACY_TRAITS: Record<string, string> = {
  'Plays too rough': 'rough_play', 'Nervous with new dogs': 'nervous_dogs', 'Guards food or toys': 'guards',
  'Nervous with strangers': 'shy_people', 'Jumps up on people': 'jumps', 'Barks at visitors': 'barks_visitors',
  'Pulls on the leash': 'pulls', 'Lunges or barks at dogs on walks': 'leash_reactive', 'Chases bikes or cars': 'chases',
  'Slow to come when called': 'recall', 'Struggles when left alone': 'alone', 'Chews or digs when alone': 'bored_chewing',
  'Hard to settle in a crate': 'crate', 'None of these': 'none', 'Not sure yet': 'not_sure',
};
const legacyTraitId = (t: string) => LEGACY_TRAITS[t] ?? t;

const SAMPLE_DRAFT: OnboardingDraft = {
  ownerName: 'Alex Kim',
  email: 'alex@kim.co',
  dogName: 'Juno',
  photo: 'juno',
  sex: 'Female',
  breed: 'Border Collie',
  mixed: false,
  notSure: false,
  birthMonth: 2,
  birthYear: 2023,
  weight: 38,
  fixed: true,
  energy: 'working',
  social: 'Loves dogs',
  interests: ['Herding', 'Sprint', 'Scent'],
  area: 'Austin · South',
  traits: ['pulls', 'nervous_dogs'],
};
// Live accounts start blank: nothing about the sample member or Juno is filled in for a real owner. Birthday,
// weight and energy keep a starting value for their pickers; "With other dogs" is left for the owner to choose,
// since it decides which group classes fit.
const DRAFT: OnboardingDraft = isLive
  ? { ...SAMPLE_DRAFT, ownerName: '', email: '', dogName: '', photo: null, breed: '', fixed: false, energy: 'medium', social: '', interests: [], traits: [] }
  : SAMPLE_DRAFT;

interface Demo {
  social: SocialStage;
  socialExpired: boolean;
  behaviorNote: boolean;
}

export type VaccineType = 'Rabies' | 'DHPP' | 'Bordetella';
export interface Vaccine {
  type: VaccineType;
  expires: string;
}

export type BookResult = { ok: true; bookingId: string } | { ok: false; error: BookError | string };

interface AppState extends Demo {
  appearance: Appearance;
  signedIn: boolean;
  onboarded: boolean;
  draft: OnboardingDraft;
  /** The member's dogs; the first is the one the app is about (Juno in sample mode). */
  dogs: Dog[];
  credits: number;
  bookings: Booking[];
  readNotifications: string[];
  /** Month-plan rows (by class id) the member swapped on 01j. */
  planSwaps: string[];
  /** Sessions held for the dog until it passes its Social assessment (01j → Today). Stored on the
   * server in live mode (held_spots); each hold reserves the spot until a day before the session. */
  pendingPlan: string[];
  /** The account's area ("Trains near", saved on the dog). */
  area: string | null;
  /** Where distances are measured from, if the member picked somewhere other than their area. */
  origin: Origin | null;
  setOrigin: (o: Origin | null) => void;
  /** Full sessions the member is waiting on. A spot that opens is booked for the first dog in line
   * until 12 hours before the start (supabase/migrations/…_waitlist.sql). */
  waitlist: WaitEntry[];
  /** Paths the main dog is still working through. Their sessions skip the Social gate. */
  activePaths: Goal['id'][];
  /** Partners where the main dog holds a Herding clearance. */
  herdingAt: string[];
  /** The main dog's vaccine records (ISO expiry dates). Bookings need all three current. */
  vaccines: Vaccine[];
  /** The main dog's vet record (photo or PDF). Live mode: on the server; before the dog exists, pending. */
  vaccineRecord: VaccineRecord | null;
  pendingVaccineDoc: PickedDoc | null;
  /** Live mode only: notifications from the database, and the Social clearance row. */
  remoteNotifications: Notif[] | null;
  socialClearanceId: string | null;
  /** Live mode: the dogs' sessions that have run (07 Log). Null in sample mode, which shows the designs' log. */
  log: LogEntry[] | null;
  /** Live mode: the main dog's clearance rows. Null in sample mode (the Passport shows the designs' Juno). */
  clearanceRecords: ClearanceRecord[] | null;
  /** Live mode: every training path with the main dog's progress. Null in sample mode (the designs' two paths). */
  paths: PathProgress[] | null;
  /** Starts a training path for a dog (live mode; sample mode's paths are already started). */
  startPath: (dogId: string, pathId: string) => Promise<void>;
  /** The signed-in member's name and email (Settings › Account). */
  account: { name: string; email: string };
  /** The member's plan (Settings › Plan and credits). Sample mode: Regular, no payment set up. */
  membership: Membership;
  saveName: (name: string) => Promise<void>;
  changePassword: (password: string) => Promise<void>;
  /** Sends a code to the new address (and, with secure email change, the current one). */
  requestEmailChange: (email: string) => Promise<void>;
  /** Enters a code sent to `codeFrom` (default: the new address). Resolves true once the email has changed. */
  confirmEmailChange: (email: string, code: string, codeFrom?: string) => Promise<boolean>;
  /** Deletes the account and everything in it, then signs out. Sample mode resets the sample data. */
  deleteAccount: () => Promise<void>;
  /** Live mode: catalog and member are loaded. */
  ready: boolean;

  setAppearance: (a: Appearance) => void;
  updateDraft: (patch: Partial<OnboardingDraft>) => void;
  toggleTrait: (t: string) => void;
  /** Saves the draft's traits to the dog (Passport › Edit). Sample mode keeps them in the draft. */
  saveTraits: (dogId: string) => Promise<void>;
  toggleSwap: (classId: string) => void;
  /** Holds sessions until the dog passes its Social assessment (spot reserved, no credits). */
  holdSessions: (sessionIds: string[], dogId: string) => Promise<{ sessionId: string; error: string | null }[]>;
  /** Books every held session; failures stay held. */
  bookHeld: (dogId: string) => Promise<{ sessionId: string; error: string | null }[]>;
  releaseHolds: (dogId: string, sessionId?: string) => Promise<void>;
  /** Joins a full session's waitlist; resolves with the dog's place in line. */
  joinWaitlist: (sessionId: string, dogId: string) => Promise<number>;
  leaveWaitlist: (sessionId: string, dogId: string) => Promise<void>;
  /** Sample mode: someone cancels, so the first waitlisted session books itself (Preview states). */
  openWaitlistSpot: () => BookResult | null;

  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  verifyEmail: (code: string) => Promise<void>;
  finishOnboarding: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Sets a dog's photo from a picked JPEG data URI (uploaded to dog-photos in live mode). */
  setDogPhoto: (dogId: string, dataUri: string) => Promise<void>;
  /** Forgot password: email a code, then set a new password with it (signs in). */
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, password: string) => Promise<void>;
  /** Live mode, phones only: this device's Expo push token, once the member allows notifications. */
  pushToken: string | null;
  registerPush: (token: string, platform: 'ios' | 'android') => Promise<void>;
  /** Live mode: reload catalog and member data. */
  refresh: () => Promise<void>;

  bookSession: (sessionId: string, dogId: string) => Promise<BookResult>;
  bookMany: (sessionIds: string[], dogId: string) => Promise<{ sessionId: string; error: string | null }[]>;
  cancelBooking: (bookingId: string) => Promise<void>;
  checkIn: (bookingId: string, code: string) => Promise<void>;
  clearBookings: () => void;
  setCredits: (n: number) => void;
  /** Saves expiry dates and, if one was picked, the vet record that shows them. */
  saveVaccines: (rows: Vaccine[], doc?: PickedDoc | null) => Promise<void>;

  markRead: (ids: string[] | null) => void;
  passSocialRecheck: () => void;
  seeSocialClearance: () => void;
  setDemo: (patch: Partial<Demo>) => void;
  resetDemo: () => void;
}

const fresh = {
  signedIn: false,
  onboarded: false,
  draft: DRAFT,
  dogs: Object.values(sampleDogs),
  credits: INITIAL_CREDITS,
  bookings: INITIAL_BOOKINGS as Booking[],
  readNotifications: INITIALLY_READ,
  planSwaps: [] as string[],
  pendingPlan: [] as string[],
  waitlist: [] as WaitEntry[],
  area: null as string | null,
  origin: null as Origin | null,
  activePaths: ['calm-around-dogs', 'loose-leash-walking'] as Goal['id'][],
  herdingAt: [] as string[],
  vaccines: JUNO_VACCINES.map((v) => ({ type: v.type, expires: localIso(v.expires) })) as Vaccine[],
  // Sample Juno's records were checked at her first visit.
  vaccineRecord: (isLive ? null : { name: 'Vet record.pdf', verified: true }) as VaccineRecord | null,
  pendingVaccineDoc: null as PickedDoc | null,
  remoteNotifications: null as Notif[] | null,
  socialClearanceId: null as string | null,
  log: null as LogEntry[] | null,
  clearanceRecords: null as ClearanceRecord[] | null,
  paths: null as PathProgress[] | null,
  account: { name: 'Alex Kim', email: 'alex@kim.co' },
  membership: { plan: 'regular', status: 'none', nextPlan: null, renewsOn: null, cancels: false } as Membership,
  social: 'working' as SocialStage,
  socialExpired: false,
  behaviorNote: false,
};

// Live mode starts empty and fills from Supabase on sign-in.
if (isLive) {
  Object.assign(fresh, {
    dogs: [], credits: 0, bookings: [], readNotifications: [], activePaths: [], vaccines: [], remoteNotifications: [], log: [], clearanceRecords: [], paths: [], account: { name: '', email: '' },
  });
}

function localIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The booking rules' view of the store (see src/lib/booking.ts). */
export function ruleContext(s: Pick<AppState, 'social' | 'socialExpired' | 'activePaths' | 'herdingAt' | 'vaccines' | 'credits' | 'bookings'>): RuleContext {
  const first = s.vaccines.length >= 3 ? s.vaccines.map((v) => v.expires).sort()[0] : null;
  const [y, m, d] = (first ?? '').split('-').map(Number);
  return {
    hasSocial: s.social !== 'working' && !s.socialExpired,
    herdingAt: s.herdingAt,
    pathClasses: s.activePaths.flatMap((p) => PATH_CLASSES[p]),
    vaccinesUntil: first ? new Date(y, m - 1, d) : null,
    credits: s.credits,
    bookings: s.bookings,
  };
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => {
      /** Live mode: run a write, then reload what it changed. */
      const thenRefresh = async <T,>(fn: () => Promise<T>) => {
        const r = await fn();
        await get().refresh();
        return r;
      };

      // Sample-mode booking, same rules as book_session().
      const bookLocal = (sessionId: string, dogId: string): BookResult => {
        const s = get();
        const held = s.pendingPlan.includes(sessionId);
        const error = bookError(sessionId, dogId, ruleContext(s));
        // A held session already has its spot.
        if (error && !(held && error === 'full')) return { ok: false, error };
        const v = view(sessionId)!;
        const booking: Booking = { id: `b-${Date.now()}-${Math.round(Math.random() * 1e6)}`, sessionId, dogId, credits: v.cls.credits, status: 'booked' };
        if (!held) v.session.spotsLeft -= 1;
        set((st) => ({
          bookings: [...st.bookings, booking],
          credits: st.credits - v.cls.credits,
          pendingPlan: st.pendingPlan.filter((x) => x !== sessionId),
          waitlist: st.waitlist.filter((w) => !(w.sessionId === sessionId && w.dogId === dogId)),
        }));
        return { ok: true, bookingId: booking.id };
      };

      return {
        ...fresh,
        appearance: 'system',
        ready: !isLive,

        setAppearance: (appearance) => set({ appearance }),
        updateDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
        saveName: async (name) => {
          if (isLive) await live.saveName(name);
          set((s) => ({ account: { ...s.account, name: name.trim() } }));
        },
        requestEmailChange: async (email) => {
          const next = email.trim().toLowerCase();
          if (next === get().account.email.toLowerCase()) throw new Error('same_email');
          if (isLive) await live.requestEmailChange(next);
        },
        confirmEmailChange: async (email, code, codeFrom) => {
          const next = email.trim().toLowerCase();
          const done = isLive ? await live.confirmEmailChange(next, code.trim(), codeFrom ?? next) : true;
          if (done) set((s) => ({ account: { ...s.account, email: next } }));
          return done;
        },
        changePassword: async (password) => {
          if (password.length < 8) throw new Error('weak_password');
          if (isLive) await live.changePassword(password);
        },
        deleteAccount: async () => {
          if (isLive) await live.deleteAccount();
          set({ ...fresh, signedIn: false, onboarded: false, pushToken: null, ready: true });
        },
        startPath: async (dogId, pathId) => {
          if (isLive) await thenRefresh(() => live.startPath(dogId, pathId));
        },
        saveTraits: async (dogId) => {
          if (isLive) await thenRefresh(() => live.saveTraits(dogId, get().draft.traits));
        },
        toggleTrait: (t) =>
          set((s) => {
            const cur = s.draft.traits;
            if (TRAIT_SPECIAL.includes(t)) return { draft: { ...s.draft, traits: cur.includes(t) ? [] : [t] } };
            const real = cur.filter((x) => !TRAIT_SPECIAL.includes(x));
            return { draft: { ...s.draft, traits: real.includes(t) ? real.filter((x) => x !== t) : [...real, t] } };
          }),
        holdSessions: async (sessionIds, dogId) => {
          if (isLive) return thenRefresh(() => live.holdSessions(dogId, sessionIds));
          // Same checks as hold_sessions(): every rule except Social, plus spots and a day's notice.
          const ctx = { ...ruleContext(get()), hasSocial: true, credits: Infinity };
          return sessionIds.map((sessionId) => {
            const v = view(sessionId);
            const st = get();
            let error: string | null = bookError(sessionId, dogId, ctx);
            if (!error && v && +v.session.startsAt - 86_400_000 <= +now()) error = 'too_soon';
            if (!error && st.pendingPlan.includes(sessionId)) error = 'already_booked';
            if (!error && v) {
              v.session.spotsLeft -= 1;
              set({ pendingPlan: [...st.pendingPlan, sessionId] });
            }
            return { sessionId, error };
          });
        },
        bookHeld: async (dogId) => {
          if (isLive) return thenRefresh(() => live.bookHeld(dogId));
          return get().pendingPlan.map((sessionId) => {
            const r = bookLocal(sessionId, dogId);
            return { sessionId, error: r.ok ? null : r.error };
          });
        },
        releaseHolds: async (dogId, sessionId) => {
          if (isLive) {
            await thenRefresh(() => live.releaseHolds(dogId, sessionId));
            return;
          }
          const gone = get().pendingPlan.filter((x) => !sessionId || x === sessionId);
          gone.forEach((id) => {
            const v = view(id);
            if (v) v.session.spotsLeft += 1;
          });
          set((st) => ({ pendingPlan: st.pendingPlan.filter((x) => !gone.includes(x)) }));
        },
        setOrigin: (origin) => {
          set({ origin });
          syncDistances();
        },
        joinWaitlist: async (sessionId, dogId) => {
          if (isLive) return thenRefresh(() => live.joinWaitlist(dogId, sessionId));
          const s = get();
          if (s.waitlist.some((w) => w.sessionId === sessionId && w.dogId === dogId)) throw new Error('already_waiting');
          const error = bookError(sessionId, dogId, ruleContext(s));
          if (error === null) throw new Error('not_full');
          if (error !== 'full') throw new Error(error);
          const v = view(sessionId)!;
          if (s.credits < v.cls.credits) throw new Error('credits');
          // Sample data has no other members; say two dogs got there first.
          const place = 3;
          set((st) => ({ waitlist: [...st.waitlist, { sessionId, dogId, place }] }));
          return place;
        },
        leaveWaitlist: async (sessionId, dogId) => {
          if (isLive) {
            await thenRefresh(() => live.leaveWaitlist(dogId, sessionId));
            return;
          }
          set((st) => ({ waitlist: st.waitlist.filter((w) => !(w.sessionId === sessionId && w.dogId === dogId)) }));
        },
        openWaitlistSpot: () => {
          const w = get().waitlist.find((x) => (view(x.sessionId)?.session.startsAt.getTime() ?? 0) - now().getTime() >= 12 * 3_600_000);
          if (!w) return null;
          view(w.sessionId)!.session.spotsLeft += 1;
          const r = bookLocal(w.sessionId, w.dogId);
          if (!r.ok) set((st) => ({ waitlist: st.waitlist.filter((x) => x !== w) }));
          return r;
        },
        toggleSwap: (classId) =>
          set((s) => ({ planSwaps: s.planSwaps.includes(classId) ? s.planSwaps.filter((x) => x !== classId) : [...s.planSwaps, classId] })),

        signIn: async (email, password) => {
          if (isLive) {
            await live.signIn(email, password);
            await get().refresh();
            set({ signedIn: true, onboarded: get().dogs.length > 0 });
          } else {
            if (password.length < 8 || !email.includes('@')) throw new Error('bad_credentials');
            set({ signedIn: true, onboarded: true });
          }
        },
        signUp: async (email, password) => {
          if (isLive) await live.signUp(email, password, get().draft.ownerName);
        },
        verifyEmail: async (code) => {
          if (isLive) {
            await live.verifyEmail(get().draft.email.trim(), code);
            set({ signedIn: true });
          } else {
            set({ signedIn: true });
          }
        },
        finishOnboarding: async () => {
          if (isLive) {
            const dogId = await live.createDog(get().draft);
            const photo = get().draft.photo;
            // A failed upload shouldn't stop sign-up; the photo can be added again from the dog's profile.
            if (photo && typeof photo === 'object') await live.uploadDogPhoto(dogId, photo.uri).catch(() => {});
            // Vaccines entered during onboarding (before the dog existed) are saved now.
            const pending = get().vaccines;
            if (pending.length) {
              await live.saveVaccines(dogId, pending.map((r) => ({ type: r.type.toLowerCase() as 'rabies', expiresOn: r.expires })));
              const doc = get().pendingVaccineDoc;
              // Like the photo, a failed upload shouldn't stop sign-up; it can be added from Vaccines.
              if (doc) await live.uploadVaccineRecord(dogId, doc).catch(() => {});
              set({ pendingVaccineDoc: null });
            }
            await get().refresh();
          } else {
            const photo = get().draft.photo;
            set((s) => ({ dogs: s.dogs.map((d, i) => (i === 0 ? { ...d, photo: photo ?? undefined } : d)), area: s.draft.area }));
          }
          set({ signedIn: true, onboarded: true });
        },
        signOut: async () => {
          if (isLive) await live.signOut(get().pushToken);
          set({ signedIn: false, onboarded: false, pushToken: null, ...(isLive ? { log: [], clearanceRecords: [], paths: [] } : {}) });
        },
        setDogPhoto: async (dogId, dataUri) => {
          if (isLive) {
            await thenRefresh(() => live.uploadDogPhoto(dogId, dataUri));
            return;
          }
          set((s) => ({ dogs: s.dogs.map((d) => (d.id === dogId ? { ...d, photo: { uri: dataUri } } : d)) }));
        },
        requestPasswordReset: async (email) => {
          if (isLive) await live.requestPasswordReset(email);
        },
        resetPassword: async (email, code, password) => {
          if (password.length < 8) throw new Error('weak_password');
          if (isLive) {
            await live.resetPassword(email, code, password);
            await get().refresh();
            set({ signedIn: true, onboarded: get().dogs.length > 0 });
            return;
          }
          set({ signedIn: true, onboarded: true });
        },
        pushToken: null,
        registerPush: async (token, platform) => {
          if (!isLive || !get().signedIn) return;
          await live.registerPushToken(token, platform);
          set({ pushToken: token });
        },
        refresh: async () => {
          if (!isLive) return;
          // Signed out: the welcome and sign-in screens don't need the catalog, so show them straight
          // away (the stored session is local; no network) and load the catalog in the background.
          if (!(await live.hasSession())) {
            set({ ready: true, signedIn: false, onboarded: false });
            live.loadCatalog().catch(() => {});
            return;
          }
          await live.loadCatalog();
          const [m, log] = await Promise.all([live.loadMember(), live.loadLog().catch(() => null)]);
          const paths = m?.dogs[0] ? await live.loadPaths(m.dogs[0].id).catch(() => null) : [];
          if (!m) {
            set({ ready: true, signedIn: false, onboarded: false });
            return;
          }
          set({
            ready: true,
            signedIn: true,
            onboarded: m.dogs.length > 0,
            dogs: m.dogs,
            credits: m.credits,
            bookings: m.bookings,
            social: m.social,
            socialExpired: m.socialExpired,
            socialClearanceId: m.socialClearanceId,
            herdingAt: m.herdingAt,
            activePaths: m.activePaths,
            vaccines: m.vaccines,
            remoteNotifications: m.notifications,
            readNotifications: m.readNotifications,
            log: log ?? get().log,
            clearanceRecords: m.clearances,
            account: { name: m.name, email: m.email },
            membership: m.membership,
            paths: paths ?? get().paths,
            pendingPlan: m.holds,
            waitlist: m.waitlist,
            vaccineRecord: m.vaccineRecord,
            area: m.area,
          });
          syncDistances();
        },

        bookSession: async (sessionId, dogId) => {
          if (!isLive) return bookLocal(sessionId, dogId);
          try {
            const bookingId = await thenRefresh(() => live.book(sessionId, dogId));
            return { ok: true, bookingId };
          } catch (e) {
            return { ok: false, error: (e as Error).message };
          }
        },
        bookMany: async (sessionIds, dogId) => {
          if (isLive) return thenRefresh(() => live.bookMany(dogId, sessionIds));
          return sessionIds.map((sessionId) => {
            const r = bookLocal(sessionId, dogId);
            return { sessionId, error: r.ok ? null : r.error };
          });
        },
        cancelBooking: async (bookingId) => {
          if (isLive) {
            await thenRefresh(() => live.cancel(bookingId));
            return;
          }
          // Same rule as cancel_booking: the spot goes back, credits come back until 12 hours before.
          const b = get().bookings.find((x) => x.id === bookingId);
          if (!b || b.status !== 'booked') throw new Error('not_cancellable');
          const v = view(b.sessionId);
          if (v) v.session.spotsLeft += 1;
          const refund = v ? cancelRefund(v.session.startsAt, b.credits) : 0;
          set((s) => ({
            bookings: s.bookings.map((x) => (x.id === bookingId ? { ...x, status: 'cancelled' } : x)),
            credits: s.credits + refund,
          }));
        },
        checkIn: async (bookingId, code) => {
          if (isLive) {
            await thenRefresh(() => live.checkIn(bookingId, code));
            return;
          }
          set((s) => ({ bookings: s.bookings.map((b) => (b.id === bookingId ? { ...b, status: 'checked_in' } : b)) }));
        },
        clearBookings: () => set({ bookings: [] }),
        setCredits: (credits) => set({ credits }),
        saveVaccines: async (rows, doc) => {
          const dog = get().dogs[0];
          // Before onboarding finishes there's no dog row yet; finishOnboarding saves these.
          if (isLive && dog) {
            await thenRefresh(async () => {
              await live.saveVaccines(dog.id, rows.map((r) => ({ type: r.type.toLowerCase() as 'rabies', expiresOn: r.expires })));
              if (doc) await live.uploadVaccineRecord(dog.id, doc);
            });
            return;
          }
          set((s) => ({
            vaccines: rows,
            vaccineRecord: doc ? { name: doc.name, verified: false } : s.vaccineRecord,
            pendingVaccineDoc: isLive && doc ? doc : s.pendingVaccineDoc,
          }));
        },

        markRead: (ids) => {
          const all = ids ?? (get().remoteNotifications ?? []).map((n) => n.id);
          set((s) => ({ readNotifications: Array.from(new Set([...s.readNotifications, ...all])) }));
          if (isLive) live.markRead(ids).catch(() => {});
        },
        passSocialRecheck: () =>
          set((s) => ({
            social: s.social === 'working' ? 'earned' : s.social,
            socialExpired: false,
            activePaths: s.activePaths.filter((p) => p !== 'calm-around-dogs'),
          })),
        seeSocialClearance: () => {
          const id = get().socialClearanceId;
          set((s) => ({ social: s.social === 'earned' ? 'cleared' : s.social }));
          if (isLive && id) live.seeClearance(id).catch(() => {});
        },
        setDemo: (patch) => set(patch),
        resetDemo: () => set({ ...fresh, signedIn: get().signedIn, onboarded: get().onboarded }),
      };
    },
    {
      name: 'packpass-member',
      version: 5,
      storage: createJSONStorage(() => AsyncStorage),
      // Live mode keeps member data in Supabase; only preferences and the onboarding draft persist.
      partialize: (s) =>
        isLive
          ? { appearance: s.appearance, draft: s.draft, origin: s.origin }
          : {
              dogs: s.dogs, origin: s.origin, area: s.area, appearance: s.appearance, signedIn: s.signedIn, onboarded: s.onboarded, draft: s.draft, credits: s.credits, bookings: s.bookings,
              readNotifications: s.readNotifications, planSwaps: s.planSwaps, pendingPlan: s.pendingPlan, waitlist: s.waitlist, social: s.social, socialExpired: s.socialExpired,
              behaviorNote: s.behaviorNote, activePaths: s.activePaths, vaccines: s.vaccines, vaccineRecord: s.vaccineRecord,
            },
      onRehydrateStorage: () => () => syncDistances(),
      migrate: (persisted, version) => {
        const p = { ...(persisted as Record<string, any>) };
        // v1 stored month swaps by title; start them fresh.
        if (version < 3) p.planSwaps = [];
        // v4: the draft's photo went from a yes/no to the photo itself.
        if (p.draft && typeof p.draft.photo === 'boolean') p.draft = { ...p.draft, photo: p.draft.photo ? 'juno' : null };
        // v5: the draft stores the energy key and trait ids instead of their old labels.
        if (version < 5 && p.draft) {
          p.draft = { ...p.draft, energy: LEGACY_ENERGY[p.draft.energy] ?? p.draft.energy, traits: (p.draft.traits ?? []).map(legacyTraitId) };
          if (Array.isArray(p.dogs)) p.dogs = p.dogs.map((d: Dog) => (d.traits ? { ...d, traits: d.traits.map(legacyTraitId) } : d));
        }
        return p as never;
      },
    },
  ),
);

/**
 * Measures partner distances from the picked origin, else the account's area. Sample mode keeps the
 * designs' distances until the member picks somewhere.
 */
function syncDistances() {
  const { origin, area } = useApp.getState();
  applyDistances(origin ?? (isLive ? areaNamed(area) ?? DEFAULT_AREA : null));
}

/** What distances are measured from, for the Today pill and Settings. Subscribing re-renders on change. */
export const useOriginLabel = () => useApp((s) => s.origin?.label ?? s.area ?? DEFAULT_AREA.label);

/** The plan this month's credits came from: name and monthly credits. */
export const usePlan = () => planOf(useApp((s) => s.membership.plan));
/** The plan's monthly credits, or null for a live member without a paid plan (credits are then a trial or top-ups). */
export const useAllowance = () => {
  const plan = usePlan();
  const paid = useApp((s) => s.membership.status === 'active' || s.membership.status === 'past_due');
  return !isLive || paid ? plan.credits : null;
};

/** The dog the app is about (Juno in sample mode). */
export const useDog = () => useApp((s) => s.dogs[0] ?? sampleDogs.juno);
/** Notifications: the database's in live mode, otherwise the sample set for the current Social stage. */
export const useNotifications = () => {
  const remote = useApp((s) => s.remoteNotifications);
  const social = useApp((s) => s.social);
  return remote ?? sampleNotifications(social);
};
/** Booking rule context for the current state. */
export const useRules = () =>
  ruleContext(useApp((s) => s));
