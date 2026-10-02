import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { INITIAL_BOOKINGS, INITIAL_CREDITS, TRAIT_SPECIAL } from '@/data/fixtures';
import { INITIALLY_READ } from '@/data/passport';
import type { Booking } from '@/data/types';

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

interface AppState extends Demo {
  appearance: Appearance;
  signedIn: boolean;
  onboarded: boolean;
  draft: OnboardingDraft;
  credits: number;
  bookings: Booking[];
  readNotifications: string[];
  /** Month-plan rows the member swapped on 01j. */
  planSwaps: string[];

  setAppearance: (a: Appearance) => void;
  updateDraft: (patch: Partial<OnboardingDraft>) => void;
  toggleTrait: (t: string) => void;
  signIn: () => void;
  finishOnboarding: () => void;
  signOut: () => void;
  toggleSwap: (title: string) => void;

  book: (sessionId: string, dogId: string, credits: number) => Booking;
  checkIn: (bookingId: string) => void;
  clearBookings: () => void;
  setCredits: (n: number) => void;

  markRead: (ids: string[]) => void;
  passSocialRecheck: () => void;
  seeSocialClearance: () => void;
  setDemo: (patch: Partial<Demo>) => void;
  resetDemo: () => void;
}

const fresh = {
  signedIn: false,
  onboarded: false,
  draft: DRAFT,
  credits: INITIAL_CREDITS,
  bookings: INITIAL_BOOKINGS,
  readNotifications: INITIALLY_READ,
  planSwaps: [] as string[],
  social: 'working' as SocialStage,
  socialExpired: false,
  behaviorNote: false,
};

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      ...fresh,
      appearance: 'system',

      setAppearance: (appearance) => set({ appearance }),
      updateDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
      toggleTrait: (t) =>
        set((s) => {
          const cur = s.draft.traits;
          if (TRAIT_SPECIAL.includes(t)) return { draft: { ...s.draft, traits: cur.includes(t) ? [] : [t] } };
          const real = cur.filter((x) => !TRAIT_SPECIAL.includes(x));
          return { draft: { ...s.draft, traits: real.includes(t) ? real.filter((x) => x !== t) : [...real, t] } };
        }),
      signIn: () => set({ signedIn: true, onboarded: true }),
      finishOnboarding: () => set({ signedIn: true, onboarded: true }),
      signOut: () => set({ signedIn: false, onboarded: false }),
      toggleSwap: (title) =>
        set((s) => ({ planSwaps: s.planSwaps.includes(title) ? s.planSwaps.filter((x) => x !== title) : [...s.planSwaps, title] })),

      book: (sessionId, dogId, credits) => {
        const booking: Booking = { id: `b-${Date.now()}`, sessionId, dogId, credits, status: 'booked' };
        set((s) => ({ bookings: [...s.bookings, booking], credits: s.credits - credits }));
        return booking;
      },
      checkIn: (bookingId) =>
        set((s) => ({ bookings: s.bookings.map((b) => (b.id === bookingId ? { ...b, status: 'checked_in' } : b)) })),
      clearBookings: () => set({ bookings: [] }),
      setCredits: (credits) => set({ credits }),

      markRead: (ids) => set((s) => ({ readNotifications: Array.from(new Set([...s.readNotifications, ...ids])) })),
      passSocialRecheck: () => set((s) => ({ social: s.social === 'working' ? 'earned' : s.social, socialExpired: false })),
      seeSocialClearance: () => set((s) => ({ social: s.social === 'earned' ? 'cleared' : s.social })),
      setDemo: (patch) => set(patch),
      resetDemo: () => set({ ...fresh, signedIn: get().signedIn, onboarded: get().onboarded }),
    }),
    {
      name: 'packpass-member',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ appearance, signedIn, onboarded, draft, credits, bookings, readNotifications, planSwaps, social, socialExpired, behaviorNote }) => ({
        appearance, signedIn, onboarded, draft, credits, bookings, readNotifications, planSwaps, social, socialExpired, behaviorNote,
      }),
    },
  ),
);
