import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { isLive } from '@/api/client';
import * as live from '@/api/live';
import { dogs as sampleDogs, INITIAL_BOOKINGS, INITIAL_CREDITS, JUNO_VACCINES, TRAIT_SPECIAL } from '@/data/fixtures';
import { INITIALLY_READ, notifications as sampleNotifications, PATH_CLASSES, type Goal, type Notif } from '@/data/passport';
import type { Booking, Dog } from '@/data/types';
import { now } from '@/lib/clock';
import { bookError, view, type BookError, type RuleContext } from '@/lib/booking';

export type Appearance = 'system' | 'light' | 'dark';
/** working: on the Calm around dogs path. earned: re-check passed, not seen yet. cleared: seen on screen 13. */
export type SocialStage = 'working' | 'earned' | 'cleared';

export interface OnboardingDraft {
  ownerName: string;
  email: string;
  dogName: string;
  photo: boolean;
  sex: 'Female' | 'Male';
  breed: string;
  mixed: boolean;
  notSure: boolean;
  birthMonth: number; // 0 to 11
  birthYear: number;
  weight: number;
  fixed: boolean;
  energy: string;
  social: string;
  interests: string[];
  traits: string[];
}

const DRAFT: OnboardingDraft = {
  ownerName: 'Alex Kim',
  email: 'alex@kim.co',
  dogName: 'Juno',
  photo: true,
  sex: 'Female',
  breed: 'Border Collie',
  mixed: false,
  notSure: false,
  birthMonth: 2,
  birthYear: 2023,
  weight: 38,
  fixed: true,
  energy: 'Working dog',
  social: 'Loves dogs',
  interests: ['Herding', 'Sprint', 'Scent'],
  traits: ['Pulls on the leash', 'Nervous with new dogs'],
};

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
  /** Paths the main dog is still working through. Their sessions skip the Social gate. */
  activePaths: Goal['id'][];
  /** Partners where the main dog holds a Herding clearance. */
  herdingAt: string[];
  /** The main dog's vaccine records (ISO expiry dates). Bookings need all three current. */
  vaccines: Vaccine[];
  /** Live mode only: notifications from the database, and the Social clearance row. */
  remoteNotifications: Notif[] | null;
  socialClearanceId: string | null;
  /** Live mode: catalog and member are loaded. */
  ready: boolean;

  setAppearance: (a: Appearance) => void;
  updateDraft: (patch: Partial<OnboardingDraft>) => void;
  toggleTrait: (t: string) => void;
  toggleSwap: (classId: string) => void;
  /** Holds sessions until the dog passes its Social assessment (spot reserved, no credits). */
  holdSessions: (sessionIds: string[], dogId: string) => Promise<{ sessionId: string; error: string | null }[]>;
  /** Books every held session; failures stay held. */
  bookHeld: (dogId: string) => Promise<{ sessionId: string; error: string | null }[]>;
  releaseHolds: (dogId: string, sessionId?: string) => Promise<void>;

  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  verifyEmail: (code: string) => Promise<void>;
  finishOnboarding: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Live mode: reload catalog and member data. */
  refresh: () => Promise<void>;

  bookSession: (sessionId: string, dogId: string) => Promise<BookResult>;
  bookMany: (sessionIds: string[], dogId: string) => Promise<{ sessionId: string; error: string | null }[]>;
  cancelBooking: (bookingId: string) => Promise<void>;
  checkIn: (bookingId: string, code: string) => Promise<void>;
  clearBookings: () => void;
  setCredits: (n: number) => void;
  saveVaccines: (rows: Vaccine[]) => Promise<void>;

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
  activePaths: ['calm-around-dogs', 'loose-leash-walking'] as Goal['id'][],
  herdingAt: [] as string[],
  vaccines: JUNO_VACCINES.map((v) => ({ type: v.type, expires: localIso(v.expires) })) as Vaccine[],
  remoteNotifications: null as Notif[] | null,
  socialClearanceId: null as string | null,
  social: 'working' as SocialStage,
  socialExpired: false,
  behaviorNote: false,
};

// Live mode starts empty and fills from Supabase on sign-in.
if (isLive) {
  Object.assign(fresh, {
    dogs: [], credits: 0, bookings: [], readNotifications: [], activePaths: [], vaccines: [], remoteNotifications: [],
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
        }));
        return { ok: true, bookingId: booking.id };
      };

      return {
        ...fresh,
        appearance: 'system',
        ready: !isLive,

        setAppearance: (appearance) => set({ appearance }),
        updateDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
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
            // Vaccines entered during onboarding (before the dog existed) are saved now.
            const pending = get().vaccines;
            if (pending.length) {
              await live.saveVaccines(dogId, pending.map((r) => ({ type: r.type.toLowerCase() as 'rabies', expiresOn: r.expires })));
            }
            await get().refresh();
          }
          set({ signedIn: true, onboarded: true });
        },
        signOut: async () => {
          if (isLive) await live.signOut();
          set({ signedIn: false, onboarded: false });
        },
        refresh: async () => {
          if (!isLive) return;
          await live.loadCatalog();
          const m = await live.loadMember();
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
            pendingPlan: m.holds,
          });
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
          set((s) => ({ bookings: s.bookings.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' } : b)) }));
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
        saveVaccines: async (rows) => {
          const dog = get().dogs[0];
          // Before onboarding finishes there's no dog row yet; finishOnboarding saves these.
          if (isLive && dog) {
            await thenRefresh(() => live.saveVaccines(dog.id, rows.map((r) => ({ type: r.type.toLowerCase() as 'rabies', expiresOn: r.expires }))));
            return;
          }
          set({ vaccines: rows });
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
      version: 3,
      storage: createJSONStorage(() => AsyncStorage),
      // Live mode keeps member data in Supabase; only preferences and the onboarding draft persist.
      partialize: (s) =>
        isLive
          ? { appearance: s.appearance, draft: s.draft }
          : {
              appearance: s.appearance, signedIn: s.signedIn, onboarded: s.onboarded, draft: s.draft, credits: s.credits, bookings: s.bookings,
              readNotifications: s.readNotifications, planSwaps: s.planSwaps, pendingPlan: s.pendingPlan, social: s.social, socialExpired: s.socialExpired,
              behaviorNote: s.behaviorNote, activePaths: s.activePaths, vaccines: s.vaccines,
            },
      // v1 stored month swaps by title; start them fresh.
      migrate: (persisted) => ({ ...(persisted as object), planSwaps: [] }) as never,
    },
  ),
);

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
