// Who a class is for: the age, size and spayed-or-neutered gates partners set on a class. The same rules
// and codes as public.class_gate() (supabase/migrations/…_class_fit_gates.sql), so sample mode and live
// mode agree. Breed never gates a class; it only ranks them (phase 2 of the breed-specific classes plan).

import type { ClassType, Dog } from '@/data/types';

export type GateCode = 'too_young' | 'too_old' | 'too_small' | 'too_large' | 'needs_fixed';

/** What the gates need to know about a dog. Missing birthday or weight passes those gates. */
export type DogFacts = Pick<Dog, 'birthYear' | 'birthMonth' | 'weightLb' | 'fixed'>;

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
  if (cls.minWeightLb != null && dog.weightLb != null && dog.weightLb < cls.minWeightLb) return 'too_small';
  if (cls.maxWeightLb != null && dog.weightLb != null && dog.weightLb > cls.maxWeightLb) return 'too_large';
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
  return 'Spayed or neutered dogs';
}
