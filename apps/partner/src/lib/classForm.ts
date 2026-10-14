import type { ClassType, SessionType } from './api';
import { photoKey } from './photos';

export const DISCIPLINES = ['Herding', 'Agility', 'Sprint', 'Fitness', 'Scent', 'Sniff', 'Open play', 'Play', 'Skills', 'Behavior'];
export const ENERGY = ['Couch', 'Medium', 'High', 'Working dog'];
export const SOCIAL = ['Loves dogs', 'Selective', 'Prefers solo'];
export const REQS = ['Rabies', 'DHPP', 'Bordetella', 'Leash until release'];

// Who it's for: gates the member app and booking check (public.class_gate). A dog outside them can't book.
export interface Range { min: number | null; max: number | null }
export const AGES: { label: string; min: number | null; max: number | null }[] = [
  { label: 'Any age', min: null, max: null },
  { label: '6 months+', min: 6, max: null },
  { label: '1 year+', min: 12, max: null },
  { label: 'Puppies, 4 to 12 months', min: 4, max: 12 },
  { label: 'Adults, 1 to 8 years', min: 12, max: 96 },
  { label: 'Seniors, 8 years+', min: 96, max: null },
];
export const SIZES: { label: string; min: number | null; max: number | null }[] = [
  { label: 'Any size', min: null, max: null },
  { label: 'Under 25 lb', min: null, max: 25 },
  { label: '25 lb+', min: 25, max: null },
  { label: '55 lb+', min: 55, max: null },
];
const months = (m: number) => (m % 12 === 0 && m >= 12 ? `${m / 12} ${m === 12 ? 'year' : 'years'}` : `${m} months`);
/** The same wording as the member app (apps/member/src/lib/fit.ts): "Puppies 4 to 12 months", "Dogs 8 years and up". */
export function ageLabel({ min, max }: Range): string | null {
  if (min == null && max == null) return null;
  if (max != null && max <= 12) return min ? `Puppies ${min} to ${max} months` : `Puppies up to ${max} months`;
  if (min != null && max != null) return min % 12 === 0 && max % 12 === 0 ? `Ages ${min / 12} to ${max / 12} years` : `Ages ${months(min)} to ${months(max)}`;
  return min != null ? `Dogs ${months(min)} and up` : `Dogs up to ${months(max!)}`;
}
export function sizeLabel({ min, max }: Range): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `Dogs ${min} to ${max} lb`;
  return min != null ? `Dogs ${min} lb and up` : `Dogs up to ${max} lb`;
}
/** The cover photo library (public/photos). */
export const PHOTOS = [
  'athletic_dog_catching_ball', 'dog_running_on_beach', 'dog_getting_pets_at_park', 'dogs_meeting_on_leash', 'pulling_on_leash',
  'dog_being_patient', 'dog_providing_good_eye_contact', 'dog_chilling', 'dog_and_owner_chilling', 'dog_chilling_with_owner_on_porch',
  'dog_sleeping_while_owner_reads', 'dog_wrapped_in_blanket', 'dog_chilling_in_car',
];
export const TYPES: { key: SessionType; label: string; note: string }[] = [
  { key: 'class', label: 'Class', note: 'A group session. Shows on Book under Sport, Scent, Play or Skills.' },
  { key: 'private', label: 'Private', note: 'One dog with a trainer. Private sessions cost more credits and show on training paths.' },
  { key: 'assessment', label: 'Assessment', note: 'Scores a rubric and updates the dog’s Passport. Can grant a clearance.' },
];

export interface ClassForm {
  title: string; discipline: string | null; type: SessionType; image: string | null; duration: number; intensity: number; group: number;
  energy: string[]; social: string[]; clearance: 'social' | 'herding' | null; reqs: string[]; description: string; trainerId: string | null;
  /** Owners leave the dog with the trainer. Group classes only; privates and assessments never are. */
  dropOff: boolean;
  /** Age in months and weight in lb the class is for; null ends are open. */
  age: Range;
  size: Range;
  /** Spayed or neutered dogs only. */
  fixed: boolean;
}

export const emptyForm = (trainerId: string | null): ClassForm => ({
  title: '', discipline: null, type: 'class', image: null, duration: 60, intensity: 3, group: 8, energy: [], social: [], clearance: null,
  reqs: ['Rabies', 'DHPP', 'Bordetella'], description: '', trainerId, dropOff: false,
  age: { min: 6, max: null }, size: { min: null, max: null }, fixed: false,
});

/** Reads a saved class back into the form (older classes keep their fit in suits / suits_note). */
export function formOf(c: ClassType): ClassForm {
  const text = c.requirements.map((r) => r.text).join(' ');
  const reqs = [
    /rabies/i.test(text) && 'Rabies', /dhpp/i.test(text) && 'DHPP', /bordetella/i.test(text) && 'Bordetella',
    /leash until/i.test(text) && 'Leash until release',
  ].filter(Boolean) as string[];
  const energy = c.energy.length ? c.energy : /any energy/i.test(c.suits ?? '') ? ENERGY : ENERGY.filter((e) => (c.suits ?? '').toLowerCase().includes(e.toLowerCase().replace(' dog', '')));
  const social = c.sociability.length ? c.sociability : SOCIAL.filter((s) => (c.suits_note ?? '').toLowerCase().includes(s.toLowerCase().split(' ')[0]));
  return {
    title: c.title, discipline: c.discipline, type: c.session_type, image: photoKey(c.image), duration: c.duration_min, intensity: c.intensity, group: c.group_size,
    energy, social, clearance: c.session_type === 'assessment' ? c.grants : c.requires, reqs, description: c.description ?? '', trainerId: c.trainer_id,
    dropOff: c.drop_off,
    // Classes saved before the gates had their age floor in the requirements text only.
    age: c.min_age_months != null || c.max_age_months != null
      ? { min: c.min_age_months, max: c.max_age_months }
      : { min: /12 months|1 year/i.test(text) ? 12 : /6 months/i.test(text) ? 6 : null, max: null },
    size: { min: c.min_weight_lb, max: c.max_weight_lb }, fixed: c.requires_fixed,
  };
}

const CATEGORY: Record<string, ClassType['category']> = { Herding: 'sport', Agility: 'sport', Sprint: 'sport', Fitness: 'sport', Scent: 'scent', Sniff: 'scent', 'Open play': 'play', Play: 'play', Skills: 'skills', Behavior: 'skills' };
const BALANCE: Record<string, ClassType['balance']> = { Herding: 'mental', Agility: 'physical', Sprint: 'physical', Fitness: 'physical', Scent: 'mental', Sniff: 'mental', 'Open play': 'physical', Play: 'social', Skills: 'mental', Behavior: 'social' };

/** The payload for partner_save_class, including the fields the member app reads (suits, requirements). */
export function payloadOf(f: ClassForm) {
  const vax = ['Rabies', 'DHPP', 'Bordetella'].filter((v) => f.reqs.includes(v));
  const requirements = [
    vax.length && { icon: 'syringe', text: `${vax.length === 3 ? 'Rabies, DHPP and Bordetella' : vax.join(' and ')} current` },
    ageLabel(f.age) && { icon: 'cake', text: ageLabel(f.age) },
    sizeLabel(f.size) && { icon: 'shield', text: sizeLabel(f.size) },
    f.fixed && { icon: 'stethoscope', text: 'Spayed or neutered' },
    // The member app swaps "Juno" for the member's dog.
    f.reqs.includes('Leash until release') && { icon: 'link', text: 'On leash until the trainer releases Juno' },
  ].filter(Boolean);
  const group = f.type === 'class' ? f.group : 1;
  return {
    title: f.title.trim(), discipline: f.discipline ?? (f.type === 'assessment' ? 'Assessment' : 'Skills'), category: CATEGORY[f.discipline ?? ''] ?? 'skills',
    session_type: f.type, duration_min: f.duration, intensity: f.intensity, group_size: group, balance: BALANCE[f.discipline ?? ''] ?? 'mental',
    suits: f.energy.length === ENERGY.length || !f.energy.length ? 'Any energy' : f.energy.length === 1 ? (f.energy[0] === 'Working dog' ? 'Working dog' : `${f.energy[0]} energy`) : `${f.energy.join(' or ')}`,
    suits_note: group === 1 ? (f.type === 'private' ? 'Private session' : 'One dog at a time') : f.social.length === SOCIAL.length || !f.social.length ? 'All dogs welcome' : f.social.join(', '),
    description: f.description.trim(), image: f.image, trainer_id: f.trainerId, clearance: f.clearance ?? '', requirements, energy: f.energy, sociability: f.social,
    drop_off: f.type === 'class' && f.dropOff,
    // An empty string clears a gate (partner_save_class).
    min_age_months: f.age.min ?? '', max_age_months: f.age.max ?? '', min_weight_lb: f.size.min ?? '', max_weight_lb: f.size.max ?? '',
    requires_fixed: f.fixed,
  };
}

/** What changes the credit cost: the class goes back to PackPass for a review if these change. */
export const pricingChanged = (a: ClassForm, b: ClassForm) => a.duration !== b.duration || a.intensity !== b.intensity || a.group !== b.group || a.type !== b.type;

/** PackPass's rough credit estimate shown while drafting (the real cost is set in review). */
export const estimateFor = (duration: number, intensity: number, type: SessionType, group: number) =>
  Math.max(1, Math.round((duration / 30) * 0.5 + intensity * 0.3 + ((type === 'class' ? group : 1) <= 1 ? 1.5 : group <= 6 ? 0.5 : 0)));
export const estimate = (f: ClassForm) => estimateFor(f.duration, f.intensity, f.type, f.group);
