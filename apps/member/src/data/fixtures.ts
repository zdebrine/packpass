// Sample data for v1. Every value comes from `project/Pack Member App.dc.html` unless noted.
// The app's clock is fixed to the moment the design depicts: Tuesday, Sep 29 2026, 9:41 am.

import type { TraitGroup } from './traits';
import type { ClassType, Dog, Partner, PhotoKey, Session, Trainer } from './types';

export const NOW = new Date(2026, 8, 29, 9, 41);

export const PLAN = { name: 'Regular', credits: 10, resetsLabel: 'Oct 1' } as const;

export const photos: Record<PhotoKey, number> = {
  athletic_dog_catching_ball: require('../../assets/photos/athletic_dog_catching_ball.jpg'),
  dog_and_owner_chilling: require('../../assets/photos/dog_and_owner_chilling.jpg'),
  dog_being_patient: require('../../assets/photos/dog_being_patient.jpg'),
  dog_chilling: require('../../assets/photos/dog_chilling.jpg'),
  dog_chilling_in_car: require('../../assets/photos/dog_chilling_in_car.jpg'),
  dog_chilling_with_owner_on_porch: require('../../assets/photos/dog_chilling_with_owner_on_porch.jpg'),
  dog_getting_pets_at_park: require('../../assets/photos/dog_getting_pets_at_park.jpg'),
  dog_providing_good_eye_contact: require('../../assets/photos/dog_providing_good_eye_contact.jpg'),
  dog_running_on_beach: require('../../assets/photos/dog_running_on_beach.jpg'),
  dog_sleeping_while_owner_reads: require('../../assets/photos/dog_sleeping_while_owner_reads.jpg'),
  dog_wrapped_in_blanket: require('../../assets/photos/dog_wrapped_in_blanket.jpg'),
  dogs_meeting_on_leash: require('../../assets/photos/dogs_meeting_on_leash.jpg'),
  pulling_on_leash: require('../../assets/photos/pulling_on_leash.jpg'),
};
/** Photo keys from before the October 2026 photo swap. Older class and trainer rows, and saved app state, still use them. */
const LEGACY_PHOTOS: Record<string, PhotoKey> = {
  collie: 'dog_chilling', grass: 'dog_and_owner_chilling', hurdle: 'dog_being_patient', juno: 'dog_providing_good_eye_contact',
  lab: 'dog_sleeping_while_owner_reads', leap: 'dog_getting_pets_at_park', rail: 'pulling_on_leash', sprint: 'dog_running_on_beach',
  tunnel: 'dogs_meeting_on_leash', wall: 'dog_chilling_with_owner_on_porch', weave: 'athletic_dog_catching_ball',
};

/** The photo key for a stored value (current or legacy), or undefined when it isn't one. */
export const photoKey = (k: string | null | undefined): PhotoKey | undefined =>
  !k ? undefined : k in photos ? (k as PhotoKey) : LEGACY_PHOTOS[k];


export const dogs: Record<string, Dog> = {
  juno: { id: 'juno', name: 'Juno', photo: 'dog_providing_good_eye_contact', breed: 'Border Collie', age: '3 yrs', stage: 'Prime', since: 2026 },
  otis: { id: 'otis', name: 'Otis', photo: 'dog_sleeping_while_owner_reads', breed: 'Labrador', age: '6 yrs', stage: 'Prime', since: 2026 },
};

export const partners: Record<string, Partner> = {
  ridgeline: { id: 'ridgeline', name: 'Ridgeline Dog Sport', short: 'Ridgeline', street: 'Manor Rd', address: '4410 Manor Rd', distanceMi: 2.4, rating: 4.9, parking: 'Park in the gravel lot by the gate', lat: 30.2905, lng: -97.6985 },
  northside: { id: 'northside', name: 'Northside Canine', short: 'Northside', street: 'Burnet Rd', address: '5701 Burnet Rd', distanceMi: 1.1, rating: 4.8, parking: 'Street parking on Burnet', lat: 30.329, lng: -97.739 },
  eastfield: { id: 'eastfield', name: 'Eastfield Park', short: 'Eastfield', street: 'Webberville Rd', address: '2200 Webberville Rd', distanceMi: 3.0, rating: 4.7, parking: 'Lot at the north field', lat: 30.269, lng: -97.702 },
  eastside: { id: 'eastside', name: 'Eastside Dog Club', short: 'Eastside', street: 'E Cesar Chavez St', address: '1914 E Cesar Chavez St', distanceMi: 1.8, rating: 4.9, parking: 'Back lot, use the side gate', lat: 30.258, lng: -97.723 },
  southfork: { id: 'southfork', name: 'South Fork Yard', short: 'South Fork', street: 'S Lamar Blvd', address: '3600 S Lamar Blvd', distanceMi: 2.8, rating: 4.6, parking: 'Two spots by the yard gate', lat: 30.24, lng: -97.786 },
};

export const trainers: Record<string, Trainer> = {
  maren: { id: 'maren', name: 'Maren Holt', credential: 'AKC herding judge · 14 years', photo: 'dog_sleeping_while_owner_reads', rating: 4.9 },
  dev: { id: 'dev', name: 'Dev Patel', credential: 'Agility and sprint coach · 9 years', photo: 'dog_running_on_beach', rating: 4.8 },
  ana: { id: 'ana', name: 'Ana Ruiz', credential: 'Reactivity and recall · CPDT-KA', photo: 'dog_and_owner_chilling', rating: 4.9 },
  sam: { id: 'sam', name: 'Sam Reyes', credential: 'Reactivity specialist · 11 years', photo: 'pulling_on_leash', rating: 5.0 },
  lena: { id: 'lena', name: 'Lena Brooks', credential: 'Open field host · Pet first aid', photo: 'dog_getting_pets_at_park', rating: 4.7 },
};

const VAX = { icon: 'syringe', text: 'Rabies, DHPP and Bordetella current' } as const;
const AGE = { icon: 'cake', text: '12 months or older' } as const;
const LEASH = { icon: 'link', text: 'On leash until the trainer releases Juno' } as const;

// Descriptions for classes the design doesn't detail are written in the same voice.
// No sample class is drop-off.
const C = (c: Omit<ClassType, 'dropOff'>): ClassType => ({ ...c, dropOff: false });
export const classes: Record<string, ClassType> = {
  'herding-fundamentals': C({
    id: 'herding-fundamentals', title: 'Herding Fundamentals', discipline: 'Herding', category: 'Sport', sessionType: 'Class',
    credits: 2, durationMin: 60, intensity: 4, groupSize: 6, suits: 'High energy', suitsNote: 'Loves dogs, selective', balance: 'Mental',
    description: 'Juno works a small flock of ducks on a fenced field with a trainer beside her. The session covers stock awareness, outruns and a calm stop. You stay on the field and learn the handling cues. Expect a tired, focused dog.',
    partnerId: 'ridgeline', trainerId: 'maren', image: 'dog_chilling', requirements: [VAX, AGE, LEASH],
  }),
  'herding-livestock': C({
    id: 'herding-livestock', title: 'Herding on Livestock', discipline: 'Herding', category: 'Sport', sessionType: 'Class',
    credits: 4, durationMin: 75, intensity: 5, groupSize: 4, suits: 'Working dog', suitsNote: 'Herding breeds', balance: 'Mental',
    description: 'Sheep, not ducks. Juno works a full flock in the big pasture with Maren on the field. Bigger outruns, longer drives and a pen at the end. For dogs past Herding Fundamentals.',
    partnerId: 'ridgeline', trainerId: 'maren', image: 'dog_chilling', premium: true, requires: 'herding', requirements: [VAX, AGE, LEASH],
  }),
  'herding-assessment': C({
    id: 'herding-assessment', title: 'Herding assessment', discipline: 'Herding', category: 'Sport', sessionType: 'Assessment',
    credits: 2, durationMin: 30, intensity: 3, groupSize: 1, suits: 'Any energy', suitsNote: 'One dog at a time', balance: 'Mental',
    description: 'Maren watches Juno on a small flock and checks stock instinct, recall off stock and a calm stop. Passing opens livestock classes at Ridgeline. The result stays at this partner.',
    partnerId: 'ridgeline', trainerId: 'maren', image: 'dog_chilling', grants: 'herding', requirements: [VAX, AGE, LEASH],
  }),
  'agility-drop-in': C({
    id: 'agility-drop-in', title: 'Agility drop-in', discipline: 'Agility', category: 'Sport', sessionType: 'Class',
    credits: 2, durationMin: 50, intensity: 4, groupSize: 8, suits: 'High energy', suitsNote: 'Loves dogs', balance: 'Physical',
    description: 'Tunnels, jumps and weave poles on the indoor turf. Dev sets a short course for each level and runs dogs one at a time. Bring treats Juno will work for.',
    partnerId: 'ridgeline', trainerId: 'dev', image: 'athletic_dog_catching_ball', requirements: [VAX, AGE, LEASH],
  }),
  'lure-sprint': C({
    id: 'lure-sprint', title: 'Lure Sprint Heats', discipline: 'Sprint', category: 'Sport', sessionType: 'Class',
    credits: 2, durationMin: 40, intensity: 5, groupSize: 8, suits: 'High energy', suitsNote: 'Sound in body', balance: 'Physical',
    description: 'Timed straight-line heats behind a lure on the long field. Three to four runs with rest between. Every heat is timed, so you can watch Juno get faster.',
    partnerId: 'eastfield', trainerId: 'dev', image: 'dog_running_on_beach', requirements: [VAX, AGE],
  }),
  fitness: C({
    id: 'fitness', title: 'Fitness and conditioning', discipline: 'Fitness', category: 'Sport', sessionType: 'Class',
    credits: 2, durationMin: 45, intensity: 3, groupSize: 6, suits: 'Any energy', suitsNote: 'Good with dogs nearby', balance: 'Physical',
    description: 'Balance work, cavaletti poles and core exercises that keep a sport dog sound. Low impact and a good partner to sprint and agility days.',
    partnerId: 'northside', trainerId: 'ana', image: 'dog_being_patient', requirements: [VAX, LEASH],
  }),
  'scent-work': C({
    id: 'scent-work', title: 'Scent Work I', discipline: 'Scent', category: 'Scent', sessionType: 'Class',
    credits: 2, durationMin: 45, intensity: 2, groupSize: 6, suits: 'Any energy', suitsNote: 'Works alone, crated between turns', balance: 'Mental',
    description: 'Juno learns to find a target odor in boxes, then in a room. Dogs search one at a time, so it suits dogs who need space. Expect a calm, tired dog.',
    partnerId: 'northside', trainerId: 'ana', image: 'dog_and_owner_chilling', requirements: [VAX],
  }),
  'sniff-space': C({
    id: 'sniff-space', title: 'Sniff space', discipline: 'Sniff', category: 'Scent', sessionType: 'Class',
    credits: 1, durationMin: 45, intensity: 1, groupSize: 1, suits: 'Any energy', suitsNote: 'Private yard, your dogs only', balance: 'Mental',
    description: 'A fenced private yard for your dogs only. Let Juno sniff, roam and decompress. Book a 45-minute slot inside the open window.',
    partnerId: 'southfork', trainerId: 'lena', image: 'dog_wrapped_in_blanket', openWindow: 'Open 4:00 to 8:00 pm', requirements: [VAX],
  }),
  'open-field': C({
    id: 'open-field', title: 'Open Field Session', discipline: 'Open play', category: 'Play', sessionType: 'Class',
    credits: 1, durationMin: 90, intensity: 3, groupSize: 20, suits: 'Any energy', suitsNote: 'Loves dogs', balance: 'Physical',
    description: 'Five fenced acres with a host on the field. Run, swim in the stock tank and play with other dogs. Leave when Juno is done.',
    partnerId: 'eastfield', trainerId: 'lena', image: 'dog_getting_pets_at_park', requirements: [VAX, AGE],
  }),
  'free-roam': C({
    id: 'free-roam', title: 'Free roam', discipline: 'Open play', category: 'Play', sessionType: 'Class',
    credits: 1, durationMin: 60, intensity: 3, groupSize: 12, suits: 'Any energy', suitsNote: 'Loves dogs', balance: 'Social',
    description: 'Off-leash play in the club yard with a handler watching the group. Dogs are matched by size and play style at the gate.',
    partnerId: 'eastside', trainerId: 'sam', image: 'dog_and_owner_chilling', requirements: [VAX, AGE],
  }),
  'small-group-play': C({
    id: 'small-group-play', title: 'Small-group play', discipline: 'Play', category: 'Play', sessionType: 'Class',
    credits: 1, durationMin: 45, intensity: 2, groupSize: 5, suits: 'Any energy', suitsNote: 'Selective dogs welcome', balance: 'Social',
    description: 'Five dogs, one trainer, a quiet yard. Sam picks calm play partners and steps in early. A good next step for dogs working on manners around other dogs.',
    partnerId: 'eastside', trainerId: 'sam', image: 'dogs_meeting_on_leash', requirements: [VAX, AGE],
  }),
  'focus-recall': C({
    id: 'focus-recall', title: 'Focus and Recall', discipline: 'Skills', category: 'Skills', sessionType: 'Class',
    credits: 2, durationMin: 45, intensity: 2, groupSize: 6, suits: 'Any energy', suitsNote: 'Good with dogs nearby', balance: 'Mental',
    description: 'Eye contact, a reliable come and a solid wait, practiced with more distractions each round. You handle, Ana coaches.',
    partnerId: 'northside', trainerId: 'ana', image: 'dog_being_patient', requirements: [VAX, LEASH],
  }),
  'loose-leash': C({
    id: 'loose-leash', title: 'Loose leash 1:1', discipline: 'Skills', category: 'Skills', sessionType: 'Private',
    credits: 3, durationMin: 45, intensity: 2, groupSize: 1, suits: 'Any energy', suitsNote: 'Private session', balance: 'Mental',
    description: 'A private session on the streets around Northside. Ana works on pace, turns and what to do when Juno pulls. You leave with three things to practice.',
    partnerId: 'northside', trainerId: 'ana', image: 'pulling_on_leash', requirements: [VAX],
  }),
  'calm-private': C({
    id: 'calm-private', title: 'Calm around dogs', discipline: 'Skills', category: 'Skills', sessionType: 'Private',
    credits: 3, durationMin: 40, intensity: 2, groupSize: 1, suits: 'Any energy', suitsNote: 'Private session', balance: 'Social',
    description: 'Sam works Juno at a distance from a calm helper dog and closes the gap as she settles. Each session ends before she gets stuck.',
    partnerId: 'eastside', trainerId: 'sam', image: 'dogs_meeting_on_leash', requirements: [VAX],
  }),
  'social-assessment': C({
    id: 'social-assessment', title: 'Social assessment', discipline: 'Assessment', category: 'Skills', sessionType: 'Assessment',
    credits: 2, durationMin: 30, intensity: 2, groupSize: 1, suits: 'Any energy', suitsNote: 'One dog at a time',
    balance: 'Social',
    description: 'Sam meets Juno one-on-one, then with a calm helper dog, and watches how she reads other dogs, settles and recovers from a startle. Passing earns the Social clearance, which opens group sport, play and group skills at every PackPass partner. Not yet means a short training path first.',
    partnerId: 'eastside', trainerId: 'sam', image: 'pulling_on_leash', grants: 'social', requirements: [VAX],
  }),
  'social-recheck': C({
    id: 'social-recheck', title: 'Social re-check', discipline: 'Assessment', category: 'Skills', sessionType: 'Assessment',
    credits: 2, durationMin: 30, intensity: 2, groupSize: 1, suits: 'Any energy', suitsNote: 'One dog at a time', balance: 'Social',
    description: 'Sam watches Juno in a calm small group and checks how she reads other dogs, recovers from a startle and settles. Passing earns the Social clearance, which opens group sport, play and group skills at every PackPass partner.',
    partnerId: 'eastside', trainerId: 'sam', image: 'dogs_meeting_on_leash', grants: 'social', requirements: [VAX],
  }),
  'parallel-walk': C({
    id: 'parallel-walk', title: 'Parallel walk', discipline: 'Skills', category: 'Skills', sessionType: 'Private',
    credits: 3, durationMin: 45, intensity: 2, groupSize: 1, suits: 'Any energy', suitsNote: 'Private session', balance: 'Social',
    description: 'Juno and a steady helper dog walk the same route on opposite sides of the street, then closer. Step 2 of Calm around dogs.',
    partnerId: 'eastside', trainerId: 'sam', image: 'dog_chilling_with_owner_on_porch', requirements: [VAX],
  }),
};

// ---- Schedule -------------------------------------------------------------------------------

const at = (dayOffset: number, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2026, 8, 29 + dayOffset, h, m);
};

/** Days of sessions in the sample schedule. Book shows the first 7; 01j plans across all 4 weeks. */
export const SCHEDULE_DAYS = 28;

/** [classId, time, spots today]. These run every day. */
export const DAILY: [string, string, number][] = [
  ['agility-drop-in', '18:30', 4],
  ['lure-sprint', '19:00', 0],
  ['herding-assessment', '18:45', 2],
  ['fitness', '19:15', 5],
  ['herding-livestock', '19:00', 1],
  ['scent-work', '18:00', 5],
  ['sniff-space', '16:00', 3],
  ['open-field', '17:00', 12],
  ['free-roam', '17:30', 8],
  ['small-group-play', '18:30', 4],
  ['focus-recall', '17:30', 3],
  ['loose-leash', '18:15', 1],
  ['calm-private', '19:00', 2],
];

/** [classId, weekday (0 = Sunday), time, spots]. These run once a week (Herding Fundamentals is Thursdays only). */
export const WEEKLY: [string, number, string, number][] = [
  ['herding-fundamentals', 4, '07:30', 4],
  ['herding-fundamentals', 4, '09:00', 3],
  ['herding-fundamentals', 4, '17:30', 6],
  ['parallel-walk', 4, '16:00', 1],
  ['herding-livestock', 6, '08:00', 1],
  ['loose-leash', 6, '09:00', 1],
  ['social-recheck', 6, '10:00', 2],
  ['social-assessment', 3, '10:30', 3],
  ['social-assessment', 6, '11:00', 3],
];

const spotsFor = (today: number, day: number, cap: number) =>
  day === 0 ? today : Math.min(cap, Math.max(0, today + ((day * 7 + today * 3) % 5) - 1));

const sid = (classId: string, d: number, time: string) => `${classId}.${d}.${time.replace(':', '')}`;

export const sessions: Session[] = [
  ...DAILY.flatMap(([classId, time, spots]) =>
    Array.from({ length: SCHEDULE_DAYS }, (_, d) => ({
      id: sid(classId, d, time),
      classId,
      startsAt: at(d, time),
      spotsLeft: spotsFor(spots, d, classes[classId].groupSize),
    })),
  ),
  ...WEEKLY.flatMap(([classId, weekday, time, spots]) =>
    Array.from({ length: SCHEDULE_DAYS }, (_, d) => d)
      .filter((d) => at(d, time).getDay() === weekday)
      .map((d) => ({ id: sid(classId, d, time), classId, startsAt: at(d, time), spotsLeft: spots })),
  ),
];

export const sessionById = (id: string) => sessions.find((s) => s.id === id);

// Bookings Juno already has when the app opens (Today: "Up next" and "This month").
export const INITIAL_BOOKINGS = [
  { id: 'b-hf', sessionId: 'herding-fundamentals.2.0730', dogId: 'juno', credits: 2, status: 'booked' as const },
  { id: 'b-sgp', sessionId: 'small-group-play.2.1830', dogId: 'juno', credits: 1, status: 'booked' as const },
];
export const INITIAL_CREDITS = 7;

/** Juno's vaccine records (Dog profile › Health and care). Bookings need all three current on the day. */
export const JUNO_VACCINES = [
  { type: 'Rabies', expires: new Date(2028, 2, 31) },
  { type: 'DHPP', expires: new Date(2027, 0, 31) },
  { type: 'Bordetella', expires: new Date(2026, 9, 14) },
];

// ---- Today ---------------------------------------------------------------------------------

export const monthDone = [
  { meta: 'Done · Sep 12 · Physical', title: 'Lure Sprint Heats · 2 credits', photo: 'dog_running_on_beach' as PhotoKey },
  { meta: 'Done · Sep 19 · Physical', title: 'Agility drop-in · 2 credits', photo: 'athletic_dog_catching_ball' as PhotoKey },
];
/** Classes Today suggests to balance the month, best first. The first one Juno can book is shown. */
export const monthSuggestions = ['scent-work', 'sniff-space'];

/** [classId, day to start looking from] for "Recommended for Juno". Ones Juno can't book are skipped. */
export const recommended: [string, number][] = [
  ['scent-work', 1],
  ['agility-drop-in', 2],
  ['focus-recall', 3],
  ['loose-leash', 4],
  ['sniff-space', 1],
];

// ---- Log -----------------------------------------------------------------------------------

export const monthBalance = [
  { label: 'Physical', done: 2, of: 3, color: 'agility' as const },
  { label: 'Mental', done: 2, of: 2, color: 'turf' as const },
  { label: 'Social', done: 1, of: 2, color: 'pitch' as const },
];

/** Day of September → intensity 1 to 3 (calendar heat map). */
export const activeDays: Record<number, 1 | 2 | 3> = {
  2: 1, 3: 3, 5: 2, 8: 3, 9: 1, 11: 2, 12: 3, 15: 2, 16: 3, 18: 1, 19: 2, 22: 3, 23: 2, 24: 1, 26: 3, 27: 2, 29: 1,
};

export const pastSessions = [
  { title: 'Lure Sprint Heats', date: 'Sep 27', trainer: 'Dev Patel · Eastfield Park', note: 'Fastest heat yet. Needs a longer warm-up.', img: 'dog_running_on_beach' as PhotoKey },
  { title: 'Herding Fundamentals', date: 'Sep 24', trainer: 'Maren Holt · Ridgeline Dog Sport', note: 'Great recall today, work on waiting at the gate.', img: 'dog_chilling' as PhotoKey },
  { title: 'Scent Work I', date: 'Sep 22', trainer: 'Ana Ruiz · Northside Canine', note: 'Found the target in under a minute on the third search.', img: 'dog_and_owner_chilling' as PhotoKey },
  { title: 'Distance work', date: 'Sep 19', trainer: 'Sam Reyes · Private session', note: 'Held focus 20 meters from a calm dog. Try 15 next time.', img: 'dog_chilling_with_owner_on_porch' as PhotoKey },
  { title: 'Social assessment', date: 'Sep 12', trainer: 'Sam Reyes · Eastside Dog Club', note: 'Juno did well one-on-one and settled after ten minutes. She still fixates on new dogs at the gate.', img: 'pulling_on_leash' as PhotoKey, assessment: 'Working on it · Social' },
];

export const disciplineLevels = [
  { name: 'Sprint', level: 3, pct: 0.8 },
  { name: 'Herding', level: 2, pct: 0.55 },
  { name: 'Agility', level: 2, pct: 0.4 },
  { name: 'Scent', level: 1, pct: 0.3 },
  { name: 'Behavior', level: 1, pct: 0.2 },
];

// ---- Onboarding ----------------------------------------------------------------------------

/** Welcome hero photos, cross-faded in this order. */
export const HERO_PHOTOS: PhotoKey[] = [
  'dog_chilling_with_owner_on_porch', 'dogs_meeting_on_leash', 'dog_being_patient', 'dog_and_owner_chilling', 'dog_chilling_in_car', 'dog_running_on_beach',
];

/** Stored as dogs.energy (the energy_level enum). */
export type Energy = 'couch' | 'medium' | 'high' | 'working';
export const ENERGY: { key: Energy; label: string; note: string }[] = [
  { key: 'couch', label: 'Couch potato', note: 'Happy with a walk and a nap.' },
  { key: 'medium', label: 'Up for anything', note: 'One good outing a day.' },
  { key: 'high', label: 'Needs a job', note: 'Needs a hard session most days.' },
  { key: 'working', label: 'Never stops', note: 'Bred for a job. Needs work for body and brain.' },
];
/** Finishes "picked for a dog who …" on Juno's month. */
export const ENERGY_PHRASE: Record<Energy, string> = {
  couch: 'likes a slower pace',
  medium: 'is up for anything',
  high: 'needs a job',
  working: 'never stops',
};
export const SOCIAL = ['Loves dogs', 'Selective', 'Prefers solo'] as const;
export const INTERESTS = ['Agility', 'Scent', 'Sprint', 'Herding', 'Open play', 'Sniff spaces', 'Skills'] as const;

/** Trait ids that clear every other pick. The chips themselves come from the trait catalog (src/data/traits.ts). */
export const TRAIT_SPECIAL = ['none', 'not_sure'];
/** Headings for the catalog's groups on the traits step, in order. */
export const TRAIT_GROUP_LABELS: [TraitGroup, string][] = [
  ['dogs', 'Around dogs'],
  ['people', 'Around people'],
  ['walks', 'Out and about'],
  ['home', 'At home'],
  ['special', 'Or'],
];

/** Training paths offered on Juno's month when any picked trait starts that path (traits.path_id). */
export const PLAN_GOALS: { path: string; title: string; outcome: string }[] = [
  { path: 'loose-leash-walking', title: 'Loose leash walking', outcome: '3 steps · Ends with a calm walk past other dogs' },
  { path: 'calm-around-dogs', title: 'Calm around dogs', outcome: '4 steps · Ends with a Social clearance and group sport' },
];

/**
 * 01j "Juno's month": five sessions over 4 weeks that fit Regular. [classId, day offset] picks the
 * real session to book; each row's swap is another class with the same balance category.
 */
export interface PlanRow {
  classId: string;
  day: number;
  swap?: { classId: string; day: number };
}

/** For dogs with a Social clearance: the month the design shows. */
export const MONTH_PLAN: PlanRow[] = [
  { classId: 'scent-work', day: 0, swap: { classId: 'sniff-space', day: 0 } },
  { classId: 'agility-drop-in', day: 4, swap: { classId: 'lure-sprint', day: 4 } },
  { classId: 'small-group-play', day: 9, swap: { classId: 'free-roam', day: 9 } },
  { classId: 'open-field', day: 19, swap: { classId: 'fitness', day: 19 } },
  { classId: 'focus-recall', day: 21, swap: { classId: 'herding-fundamentals', day: 23 } },
];

/**
 * For dogs without one: the month leads with a Social assessment. Week 1 books now; the group sessions
 * after it open once the assessment is passed, and Today offers to book them then.
 */
export const MONTH_PLAN_NEW_DOG: PlanRow[] = [
  { classId: 'social-assessment', day: 1 },
  { classId: 'sniff-space', day: 2, swap: { classId: 'loose-leash', day: 4 } },
  { classId: 'agility-drop-in', day: 11, swap: { classId: 'lure-sprint', day: 11 } },
  { classId: 'open-field', day: 19, swap: { classId: 'fitness', day: 19 } },
  { classId: 'focus-recall', day: 21, swap: { classId: 'scent-work', day: 21 } },
];
