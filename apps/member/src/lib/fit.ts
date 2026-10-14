// Who a class is for: the age, size and spayed-or-neutered gates partners set on a class. The same rules
// and codes as public.class_gate() (supabase/migrations/…_breed_review_overrides.sql), so sample mode and live
// mode agree. Breed only ranks classes (fitFor, below), except a class PackPass approved as "Only these breeds".
// A partner's Assessed fit lifts the size and breed gates at that partner.

import { breedById, type Aptitude } from '@/data/breeds';
import type { Energy } from '@/data/fixtures';
import type { BalanceCategory, ClassType, Dog } from '@/data/types';

export type GateCode = 'too_young' | 'too_old' | 'too_small' | 'too_large' | 'breed_only' | 'needs_fixed';

/** What the gates need to know about a dog. Missing birthday or weight passes those gates. */
export type DogFacts = Pick<Dog, 'birthYear' | 'birthMonth' | 'weightLb' | 'fixed' | 'breedIds' | 'fitPartners'>;

/** Age in months on a day, counted from the birth month (June when unknown), like public.dog_age_months(). */
export function ageMonthsOn(dog: DogFacts, day: Date): number | null {
  if (!dog.birthYear) return null;
  return (day.getFullYear() - dog.birthYear) * 12 + (day.getMonth() + 1) - (dog.birthMonth ?? 6);
}

/** The first of the class's gates the dog fails on `day`, or null. */
export function gateFor(cls: ClassType, dog: DogFacts | undefined, day: Date): GateCode | null {
  if (!dog) return null;
  const age = ageMonthsOn(dog, day);
  if (cls.minAgeMonths != null && age != null && age < cls.minAgeMonths) return 'too_young';
  if (cls.maxAgeMonths != null && age != null && age > cls.maxAgeMonths) return 'too_old';
  if (!dog.fitPartners?.includes(cls.partnerId)) {
    if (cls.minWeightLb != null && dog.weightLb != null && dog.weightLb < cls.minWeightLb) return 'too_small';
    if (cls.maxWeightLb != null && dog.weightLb != null && dog.weightLb > cls.maxWeightLb) return 'too_large';
    if (cls.breedOnly && cls.builtFor?.length) {
      const mine = aptitudesOf(dog.breedIds);
      if (!cls.builtFor.some((a) => mine.has(a))) return 'breed_only';
    }
  }
  if (cls.requiresFixed && dog.fixed !== true) return 'needs_fixed';
  return null;
}

const months = (m: number) => (m % 12 === 0 && m >= 12 ? `${m / 12} ${m === 12 ? 'year' : 'years'}` : `${m} months`);

/** "Puppies 4 to 12 months", "Dogs 8 years and up", "Ages 1 to 9 years". Null when the class has no age gate. */
export function ageLabel(min?: number, max?: number): string | null {
  if (min == null && max == null) return null;
  if (max != null && max <= 12) return min ? `Puppies ${min} to ${max} months` : `Puppies up to ${max} months`;
  if (min != null && max != null) {
    return min % 12 === 0 && max % 12 === 0 ? `Ages ${min / 12} to ${max / 12} years` : `Ages ${months(min)} to ${months(max)}`;
  }
  if (min != null) return `Dogs ${months(min)} and up`;
  return `Dogs up to ${months(max!)}`;
}

/** "Dogs 25 lb and up", "Dogs up to 30 lb", "Dogs 20 to 60 lb". Null when the class has no size gate. */
export function sizeLabel(min?: number, max?: number): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `Dogs ${min} to ${max} lb`;
  return min != null ? `Dogs ${min} lb and up` : `Dogs up to ${max} lb`;
}

/** Why a gated class isn't for this dog, as the class's own rule: "Puppies 4 to 12 months". */
export function gateLabel(cls: ClassType, code: GateCode): string {
  if (code === 'too_young' || code === 'too_old') return ageLabel(cls.minAgeMonths, cls.maxAgeMonths)!;
  if (code === 'too_small' || code === 'too_large') return sizeLabel(cls.minWeightLb, cls.maxWeightLb)!;
  if (code === 'breed_only') return breedOnlyLabel(cls.builtFor ?? []);
  return 'Spayed or neutered dogs';
}

// ---- Fit: how well an open class suits the dog. Ranking only; it never hides a class. --------------------------
// Each part is a signal from 0 to 1, times its weight. The weights add up to 100 and start as the plan's guess;
// PackPass tunes them in Admin › Fit from what dogs book (public.fit_weights), and live mode loads them.

export type FitPart = 'breed' | 'energy' | 'social' | 'interests' | 'balance' | 'history';
export type Weights = Record<FitPart, number>;
export const DEFAULT_WEIGHTS: Weights = { breed: 35, energy: 20, social: 15, interests: 15, balance: 10, history: 5 };
let weights: Weights = DEFAULT_WEIGHTS;
/** Live mode: the weights PackPass set. */
export const setWeights = (w: Weights) => { weights = w; };
export const currentWeights = () => weights;

/** "Built for herding breeds", "Built for sighthounds". */
export const BUILT_FOR: Record<Aptitude, string> = {
  herding: 'herding breeds', sighthound: 'sighthounds', scenthound: 'scenthounds', retriever: 'retrievers', water: 'water dogs',
  terrier: 'terriers', guardian: 'guardian breeds', bully: 'bully breeds', toy: 'toy breeds', companion: 'companion dogs',
};
export const builtForLabel = (a: Aptitude) => `Built for ${BUILT_FOR[a]}`;
/** "Built for herding breeds and sighthounds". */
export const builtForList = (tags: Aptitude[]) =>
  `Built for ${tags.map((t) => BUILT_FOR[t]).join(', ').replace(/, ([^,]*)$/, ' and $1')}`;
/** "Herding breeds only", for a class PackPass approved as Only these breeds. */
export const breedOnlyLabel = (tags: Aptitude[]) => {
  const list = tags.map((t) => BUILT_FOR[t]).join(', ').replace(/, ([^,]*)$/, ' and $1');
  return `${list.charAt(0).toUpperCase()}${list.slice(1)} only`;
};

/** Onboarding's interests (01g) that each discipline answers. */
const INTEREST_OF: Record<string, string> = {
  Herding: 'Herding', Agility: 'Agility', Sprint: 'Sprint', Scent: 'Scent', Sniff: 'Sniff spaces', 'Open play': 'Open play', Play: 'Open play',
  Skills: 'Skills', Behavior: 'Skills',
};
const ENERGY_RANK: Record<Energy, number> = { couch: 1, medium: 2, high: 3, working: 4 };
/** The class intensity (1 to 5) each energy level wants. */
const ENERGY_PACE: Record<Energy, number> = { couch: 1.5, medium: 2.5, high: 4, working: 5 };

export type FitDog = Pick<Dog, 'breed' | 'breedIds' | 'energy' | 'social' | 'interests'>;
export interface FitContext {
  /** The balance the dog's month is shortest on (src/lib/stats.ts). */
  short?: BalanceCategory | null;
  /** Disciplines and partners the dog has been to. */
  disciplines?: string[];
  partners?: string[];
}
export interface Fit {
  score: number;
  /** Points per part (signal times weight). */
  parts: Weights;
  /** Each part's signal, 0 to 1, before weighting: what impressions log, so weights can be refit from them. */
  signals: Weights;
  /** The aptitude the dog shares with the class, when breed earned its tag. */
  builtFor: Aptitude | null;
}

/** The dog's aptitudes, from its breeds. A mix counts every breed in it. */
export const aptitudesOf = (breedIds: string[] = []) => new Set(breedIds.flatMap((id) => breedById[id]?.aptitudes ?? []));

/** A class built for no one, or a dog whose owner isn't sure, sits in the middle: never boosted, never penalized. */
const BREED_NEUTRAL = 3 / 7;

function breedSignal(cls: ClassType, dog: FitDog): { signal: number; match: Aptitude | null } {
  const tags = cls.builtFor ?? [];
  const ids = dog.breedIds ?? [];
  if (!tags.length || !ids.length) return { signal: BREED_NEUTRAL, match: null };
  const mine = aptitudesOf(ids);
  const match = tags.find((t) => mine.has(t)) ?? null;
  if (!match) return { signal: 0, match: null };
  const mix = ids.length > 1 || /\bmix\b/i.test(dog.breed);
  return { signal: mix ? 0.7 : 1, match };
}

function energySignal(cls: ClassType, dog: FitDog) {
  if (!dog.energy) return 0.5;
  if (cls.energy?.length) {
    const gap = Math.min(...cls.energy.map((e) => Math.abs(ENERGY_RANK[e] - ENERGY_RANK[dog.energy!])));
    return Math.max(0, 1 - gap * 0.4);
  }
  return Math.max(0, 1 - Math.abs(ENERGY_PACE[dog.energy] - cls.intensity) / 4);
}

function socialSignal(cls: ClassType, dog: FitDog) {
  if (cls.groupSize <= 1) return 1;
  if (!dog.social) return 0.5;
  if (cls.sociability?.length) return cls.sociability.includes(dog.social) ? 1 : 0;
  if (dog.social === 'Loves dogs') return 1;
  if (dog.social === 'Selective') return cls.groupSize <= 4 ? 1 : 0.4;
  return 0;
}

/** How well an open class suits the dog, 0 to 100, with each part so the reason and the logging can use them. */
export function fitFor(cls: ClassType, dog: FitDog, ctx: FitContext = {}, w: Weights = weights): Fit {
  const breed = breedSignal(cls, dog);
  const signals: Weights = {
    breed: breed.signal,
    energy: energySignal(cls, dog),
    social: socialSignal(cls, dog),
    interests: dog.interests?.includes(INTEREST_OF[cls.discipline] ?? '') ? 1 : 0,
    balance: ctx.short && cls.balance === ctx.short ? 1 : 0,
    history: ctx.disciplines?.includes(cls.discipline) || ctx.partners?.includes(cls.partnerId) ? 1 : 0,
  };
  const parts = Object.fromEntries(Object.entries(signals).map(([k, v]) => [k, Math.round(v * w[k as FitPart])])) as Weights;
  const score = Object.values(parts).reduce((a, b) => a + b, 0);
  // The tag follows the match itself, whatever breed weighs: a purebred or a mix that shares the aptitude.
  return { score, parts, signals, builtFor: breed.signal >= 0.7 ? breed.match : null };
}
