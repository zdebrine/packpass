import type { ClassType, SessionType } from './api';
import { photoKey } from './photos';

export const DISCIPLINES = ['Herding', 'Agility', 'Sprint', 'Fitness', 'Scent', 'Sniff', 'Open play', 'Play', 'Skills', 'Behavior'];
export const ENERGY = ['Couch', 'Medium', 'High', 'Working dog'];
export const SOCIAL = ['Loves dogs', 'Selective', 'Prefers solo'];
export const REQS = ['Rabies', 'DHPP', 'Bordetella', '6 months+', '1 year+', 'Leash until release'];
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
}

export const emptyForm = (trainerId: string | null): ClassForm => ({
  title: '', discipline: null, type: 'class', image: null, duration: 60, intensity: 3, group: 8, energy: [], social: [], clearance: null,
  reqs: ['Rabies', 'DHPP', 'Bordetella'], description: '', trainerId, dropOff: false,
});

/** Reads a saved class back into the form (older classes keep their fit in suits / suits_note). */
export function formOf(c: ClassType): ClassForm {
  const text = c.requirements.map((r) => r.text).join(' ');
  const reqs = [
    /rabies/i.test(text) && 'Rabies', /dhpp/i.test(text) && 'DHPP', /bordetella/i.test(text) && 'Bordetella',
    /6 months/i.test(text) && '6 months+', /12 months|1 year/i.test(text) && '1 year+', /leash until/i.test(text) && 'Leash until release',
  ].filter(Boolean) as string[];
  const energy = c.energy.length ? c.energy : /any energy/i.test(c.suits ?? '') ? ENERGY : ENERGY.filter((e) => (c.suits ?? '').toLowerCase().includes(e.toLowerCase().replace(' dog', '')));
  const social = c.sociability.length ? c.sociability : SOCIAL.filter((s) => (c.suits_note ?? '').toLowerCase().includes(s.toLowerCase().split(' ')[0]));
  return {
    title: c.title, discipline: c.discipline, type: c.session_type, image: photoKey(c.image), duration: c.duration_min, intensity: c.intensity, group: c.group_size,
    energy, social, clearance: c.session_type === 'assessment' ? c.grants : c.requires, reqs, description: c.description ?? '', trainerId: c.trainer_id,
    dropOff: c.drop_off,
  };
}

const CATEGORY: Record<string, ClassType['category']> = { Herding: 'sport', Agility: 'sport', Sprint: 'sport', Fitness: 'sport', Scent: 'scent', Sniff: 'scent', 'Open play': 'play', Play: 'play', Skills: 'skills', Behavior: 'skills' };
const BALANCE: Record<string, ClassType['balance']> = { Herding: 'mental', Agility: 'physical', Sprint: 'physical', Fitness: 'physical', Scent: 'mental', Sniff: 'mental', 'Open play': 'physical', Play: 'social', Skills: 'mental', Behavior: 'social' };

/** The payload for partner_save_class, including the fields the member app reads (suits, requirements). */
export function payloadOf(f: ClassForm) {
  const vax = ['Rabies', 'DHPP', 'Bordetella'].filter((v) => f.reqs.includes(v));
  const requirements = [
    vax.length && { icon: 'syringe', text: `${vax.length === 3 ? 'Rabies, DHPP and Bordetella' : vax.join(' and ')} current` },
    f.reqs.includes('1 year+') ? { icon: 'cake', text: '12 months or older' } : f.reqs.includes('6 months+') && { icon: 'cake', text: '6 months or older' },
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
  };
}

/** What changes the credit cost: the class goes back to PackPass for a review if these change. */
export const pricingChanged = (a: ClassForm, b: ClassForm) => a.duration !== b.duration || a.intensity !== b.intensity || a.group !== b.group || a.type !== b.type;

/** PackPass's rough credit estimate shown while drafting (the real cost is set in review). */
export const estimateFor = (duration: number, intensity: number, type: SessionType, group: number) =>
  Math.max(1, Math.round((duration / 30) * 0.5 + intensity * 0.3 + ((type === 'class' ? group : 1) <= 1 ? 1.5 : group <= 6 ? 0.5 : 0)));
export const estimate = (f: ClassForm) => estimateFor(f.duration, f.intensity, f.type, f.group);
