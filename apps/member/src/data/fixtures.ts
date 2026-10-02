// Sample data for v1. Every value comes from `project/Pack Member App.dc.html` unless noted.
// The app's clock is fixed to the moment the design depicts: Tuesday, Sep 29 2026, 9:41 am.

import type { ClassType, Dog, Partner, PhotoKey, Session, Trainer } from './types';

export const NOW = new Date(2026, 8, 29, 9, 41);

export const PLAN = { name: 'Regular', credits: 10, resetsLabel: 'Oct 1' } as const;

export const photos: Record<PhotoKey, number> = {
  collie: require('../../assets/photos/collie.jpg'),
  grass: require('../../assets/photos/grass.jpg'),
  hurdle: require('../../assets/photos/hurdle.jpg'),
  juno: require('../../assets/photos/juno.jpg'),
  lab: require('../../assets/photos/lab.jpg'),
  leap: require('../../assets/photos/leap.jpg'),
  rail: require('../../assets/photos/rail.jpg'),
  sprint: require('../../assets/photos/sprint.jpg'),
  tunnel: require('../../assets/photos/tunnel.jpg'),
  wall: require('../../assets/photos/wall.jpg'),
  weave: require('../../assets/photos/weave.jpg'),
};

export const dogs: Record<string, Dog> = {
  juno: { id: 'juno', name: 'Juno', photo: 'juno', breed: 'Border Collie', age: '3 yrs', stage: 'Prime', since: 2026 },
  otis: { id: 'otis', name: 'Otis', photo: 'lab', breed: 'Labrador', age: '6 yrs', stage: 'Prime', since: 2026 },
};

export const partners: Record<string, Partner> = {
  ridgeline: { id: 'ridgeline', name: 'Ridgeline Dog Sport', short: 'Ridgeline', street: 'Manor Rd', address: '4410 Manor Rd', distanceMi: 2.4, rating: 4.9, parking: 'Park in the gravel lot by the gate' },
  northside: { id: 'northside', name: 'Northside Canine', short: 'Northside', street: 'Burnet Rd', address: '5701 Burnet Rd', distanceMi: 1.1, rating: 4.8, parking: 'Street parking on Burnet' },
  eastfield: { id: 'eastfield', name: 'Eastfield Park', short: 'Eastfield', street: 'Webberville Rd', address: '2200 Webberville Rd', distanceMi: 3.0, rating: 4.7, parking: 'Lot at the north field' },
  eastside: { id: 'eastside', name: 'Eastside Dog Club', short: 'Eastside', street: 'E Cesar Chavez St', address: '1914 E Cesar Chavez St', distanceMi: 1.8, rating: 4.9, parking: 'Back lot, use the side gate' },
  southfork: { id: 'southfork', name: 'South Fork Yard', short: 'South Fork', street: 'S Lamar Blvd', address: '3600 S Lamar Blvd', distanceMi: 2.8, rating: 4.6, parking: 'Two spots by the yard gate' },
};

export const trainers: Record<string, Trainer> = {
  maren: { id: 'maren', name: 'Maren Holt', credential: 'AKC herding judge · 14 years', photo: 'lab', rating: 4.9 },
  dev: { id: 'dev', name: 'Dev Patel', credential: 'Agility and sprint coach · 9 years', photo: 'sprint', rating: 4.8 },
  ana: { id: 'ana', name: 'Ana Ruiz', credential: 'Reactivity and recall · CPDT-KA', photo: 'grass', rating: 4.9 },
  sam: { id: 'sam', name: 'Sam Reyes', credential: 'Reactivity specialist · 11 years', photo: 'rail', rating: 5.0 },
  lena: { id: 'lena', name: 'Lena Brooks', credential: 'Open field host · Pet first aid', photo: 'leap', rating: 4.7 },
};

const VAX = { icon: 'syringe', text: 'Rabies, DHPP and Bordetella current' } as const;
const AGE = { icon: 'cake', text: '12 months or older' } as const;
const LEASH = { icon: 'link', text: 'On leash until the trainer releases Juno' } as const;

// Descriptions for classes the design doesn't detail are written in the same voice.
const C = (c: ClassType) => c;
export const classes: Record<string, ClassType> = {
  'herding-fundamentals': C({
    id: 'herding-fundamentals', title: 'Herding Fundamentals', discipline: 'Herding', category: 'Sport', sessionType: 'Class',
    credits: 2, durationMin: 60, intensity: 4, groupSize: 6, suits: 'High energy', suitsNote: 'Loves dogs, selective', balance: 'Mental',
    description: 'Juno works a small flock of ducks on a fenced field with a trainer beside her. The session covers stock awareness, outruns and a calm stop. You stay on the field and learn the handling cues. Expect a tired, focused dog.',
    partnerId: 'ridgeline', trainerId: 'maren', image: 'collie', requirements: [VAX, AGE, LEASH],
  }),
  'herding-livestock': C({
    id: 'herding-livestock', title: 'Herding on Livestock', discipline: 'Herding', category: 'Sport', sessionType: 'Class',
    credits: 4, durationMin: 75, intensity: 5, groupSize: 4, suits: 'Working dog', suitsNote: 'Herding breeds', balance: 'Mental',
    description: 'Sheep, not ducks. Juno works a full flock in the big pasture with Maren on the field. Bigger outruns, longer drives and a pen at the end. For dogs past Herding Fundamentals.',
    partnerId: 'ridgeline', trainerId: 'maren', image: 'collie', premium: true, requires: 'herding', requirements: [VAX, AGE, LEASH],
  }),
  'herding-assessment': C({
    id: 'herding-assessment', title: 'Herding assessment', discipline: 'Herding', category: 'Sport', sessionType: 'Assessment',
    credits: 2, durationMin: 30, intensity: 3, groupSize: 1, suits: 'Any energy', suitsNote: 'One dog at a time', balance: 'Mental',
    description: 'Maren watches Juno on a small flock and checks stock instinct, recall off stock and a calm stop. Passing opens livestock classes at Ridgeline. The result stays at this partner.',
    partnerId: 'ridgeline', trainerId: 'maren', image: 'collie', grants: 'herding', requirements: [VAX, AGE, LEASH],
  }),
  'agility-drop-in': C({
    id: 'agility-drop-in', title: 'Agility drop-in', discipline: 'Agility', category: 'Sport', sessionType: 'Class',
    credits: 2, durationMin: 50, intensity: 4, groupSize: 8, suits: 'High energy', suitsNote: 'Loves dogs', balance: 'Physical',
    description: 'Tunnels, jumps and weave poles on the indoor turf. Dev sets a short course for each level and runs dogs one at a time. Bring treats Juno will work for.',
    partnerId: 'ridgeline', trainerId: 'dev', image: 'weave', requirements: [VAX, AGE, LEASH],
  }),
  'lure-sprint': C({
    id: 'lure-sprint', title: 'Lure Sprint Heats', discipline: 'Sprint', category: 'Sport', sessionType: 'Class',
    credits: 2, durationMin: 40, intensity: 5, groupSize: 8, suits: 'High energy', suitsNote: 'Sound in body', balance: 'Physical',
    description: 'Timed straight-line heats behind a lure on the long field. Three to four runs with rest between. Every heat is timed, so you can watch Juno get faster.',
    partnerId: 'eastfield', trainerId: 'dev', image: 'sprint', requirements: [VAX, AGE],
  }),
  fitness: C({
    id: 'fitness', title: 'Fitness and conditioning', discipline: 'Fitness', category: 'Sport', sessionType: 'Class',
    credits: 2, durationMin: 45, intensity: 3, groupSize: 6, suits: 'Any energy', suitsNote: 'Good with dogs nearby', balance: 'Physical',
    description: 'Balance work, cavaletti poles and core exercises that keep a sport dog sound. Low impact and a good partner to sprint and agility days.',
    partnerId: 'northside', trainerId: 'ana', image: 'hurdle', requirements: [VAX, LEASH],
  }),
  'scent-work': C({
    id: 'scent-work', title: 'Scent Work I', discipline: 'Scent', category: 'Scent', sessionType: 'Class',
    credits: 2, durationMin: 45, intensity: 2, groupSize: 6, suits: 'Any energy', suitsNote: 'Works alone, crated between turns', balance: 'Mental',
    description: 'Juno learns to find a target odor in boxes, then in a room. Dogs search one at a time, so it suits dogs who need space. Expect a calm, tired dog.',
    partnerId: 'northside', trainerId: 'ana', image: 'grass', requirements: [VAX],
  }),
  'sniff-space': C({
    id: 'sniff-space', title: 'Sniff space', discipline: 'Sniff', category: 'Scent', sessionType: 'Class',
    credits: 1, durationMin: 45, intensity: 1, groupSize: 1, suits: 'Any energy', suitsNote: 'Private yard, your dogs only', balance: 'Mental',
    description: 'A fenced private yard for your dogs only. Let Juno sniff, roam and decompress. Book a 45-minute slot inside the open window.',
    partnerId: 'southfork', trainerId: 'lena', image: 'wall', openWindow: 'Open 4:00 to 8:00 pm', requirements: [VAX],
  }),
  'open-field': C({
    id: 'open-field', title: 'Open Field Session', discipline: 'Open play', category: 'Play', sessionType: 'Class',
    credits: 1, durationMin: 90, intensity: 3, groupSize: 20, suits: 'Any energy', suitsNote: 'Loves dogs', balance: 'Physical',
    description: 'Five fenced acres with a host on the field. Run, swim in the stock tank and play with other dogs. Leave when Juno is done.',
    partnerId: 'eastfield', trainerId: 'lena', image: 'leap', requirements: [VAX, AGE],
  }),
  'free-roam': C({
    id: 'free-roam', title: 'Free roam', discipline: 'Open play', category: 'Play', sessionType: 'Class',
    credits: 1, durationMin: 60, intensity: 3, groupSize: 12, suits: 'Any energy', suitsNote: 'Loves dogs', balance: 'Social',
    description: 'Off-leash play in the club yard with a handler watching the group. Dogs are matched by size and play style at the gate.',
    partnerId: 'eastside', trainerId: 'sam', image: 'grass', requirements: [VAX, AGE],
  }),
  'small-group-play': C({
    id: 'small-group-play', title: 'Small-group play', discipline: 'Play', category: 'Play', sessionType: 'Class',
    credits: 1, durationMin: 45, intensity: 2, groupSize: 5, suits: 'Any energy', suitsNote: 'Selective dogs welcome', balance: 'Social',
    description: 'Five dogs, one trainer, a quiet yard. Sam picks calm play partners and steps in early. A good next step for dogs working on manners around other dogs.',
    partnerId: 'eastside', trainerId: 'sam', image: 'tunnel', requirements: [VAX, AGE],
  }),
  'focus-recall': C({
    id: 'focus-recall', title: 'Focus and Recall', discipline: 'Skills', category: 'Skills', sessionType: 'Class',
    credits: 2, durationMin: 45, intensity: 2, groupSize: 6, suits: 'Any energy', suitsNote: 'Good with dogs nearby', balance: 'Mental',
    description: 'Eye contact, a reliable come and a solid wait, practiced with more distractions each round. You handle, Ana coaches.',
    partnerId: 'northside', trainerId: 'ana', image: 'hurdle', requirements: [VAX, LEASH],
  }),
  'loose-leash': C({
    id: 'loose-leash', title: 'Loose leash 1:1', discipline: 'Skills', category: 'Skills', sessionType: 'Private',
    credits: 3, durationMin: 45, intensity: 2, groupSize: 1, suits: 'Any energy', suitsNote: 'Private session', balance: 'Mental',
    description: 'A private session on the streets around Northside. Ana works on pace, turns and what to do when Juno pulls. You leave with three things to practice.',
    partnerId: 'northside', trainerId: 'ana', image: 'rail', requirements: [VAX],
  }),
  'calm-private': C({
    id: 'calm-private', title: 'Calm around dogs', discipline: 'Skills', category: 'Skills', sessionType: 'Private',
    credits: 3, durationMin: 40, intensity: 2, groupSize: 1, suits: 'Any energy', suitsNote: 'Private session', balance: 'Social',
    description: 'Sam works Juno at a distance from a calm helper dog and closes the gap as she settles. Each session ends before she gets stuck.',
    partnerId: 'eastside', trainerId: 'sam', image: 'lab', requirements: [VAX],
  }),
  'parallel-walk': C({
    id: 'parallel-walk', title: 'Parallel walk', discipline: 'Skills', category: 'Skills', sessionType: 'Private',
    credits: 3, durationMin: 45, intensity: 2, groupSize: 1, suits: 'Any energy', suitsNote: 'Private session', balance: 'Social',
    description: 'Juno and a steady helper dog walk the same route on opposite sides of the street, then closer. Step 2 of Calm around dogs.',
    partnerId: 'eastside', trainerId: 'sam', image: 'wall', requirements: [VAX],
  }),
};

// ---- Schedule -------------------------------------------------------------------------------

const at = (dayOffset: number, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2026, 8, 29 + dayOffset, h, m);
};

/** [classId, time, spots today]. These repeat daily for the 7 days Book shows. */
const DAILY: [string, string, number][] = [
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

/** Sessions on specific days (Herding Fundamentals runs Thursdays only). */
const EXTRA: [string, number, string, number][] = [
  ['herding-fundamentals', 2, '07:30', 4],
  ['herding-fundamentals', 2, '09:00', 3],
  ['herding-fundamentals', 2, '17:30', 6],
  ['herding-livestock', 4, '08:00', 1],
  ['loose-leash', 4, '09:00', 1],
  ['parallel-walk', 2, '16:00', 1],
];

const spotsFor = (today: number, day: number, cap: number) =>
  day === 0 ? today : Math.min(cap, Math.max(0, today + ((day * 7 + today * 3) % 5) - 1));

export const sessions: Session[] = [
  ...DAILY.flatMap(([classId, time, spots]) =>
    Array.from({ length: 7 }, (_, d) => ({
      id: `${classId}.${d}.${time.replace(':', '')}`,
      classId,
      startsAt: at(d, time),
      spotsLeft: spotsFor(spots, d, classes[classId].groupSize),
    })),
  ),
  ...EXTRA.map(([classId, d, time, spots]) => ({ id: `${classId}.${d}.${time.replace(':', '')}`, classId, startsAt: at(d, time), spotsLeft: spots })),
];

export const sessionById = (id: string) => sessions.find((s) => s.id === id);

// Bookings Juno already has when the app opens (Today: "Up next" and "This month").
export const INITIAL_BOOKINGS = [
  { id: 'b-hf', sessionId: 'herding-fundamentals.2.0730', dogId: 'juno', credits: 2, status: 'booked' as const },
  { id: 'b-sgp', sessionId: 'small-group-play.2.1830', dogId: 'juno', credits: 1, status: 'booked' as const },
];
export const INITIAL_CREDITS = 7;

// ---- Today ---------------------------------------------------------------------------------

export const monthDone = [
  { meta: 'Done · Sep 12 · Physical', title: 'Lure Sprint Heats · 2 credits', photo: 'sprint' as PhotoKey },
  { meta: 'Done · Sep 19 · Physical', title: 'Agility drop-in · 2 credits', photo: 'weave' as PhotoKey },
];
export const monthSuggestion = { sessionId: 'scent-work.1.1800', meta: 'Suggested · Wed 6:00 pm · Mental' };

export const recommendedSessionIds = [
  'scent-work.1.1800',
  'agility-drop-in.2.1830',
  'focus-recall.3.1730',
  'loose-leash.4.0900',
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
  { title: 'Lure Sprint Heats', date: 'Sep 27', trainer: 'Dev Patel · Eastfield Park', note: 'Fastest heat yet. Needs a longer warm-up.', img: 'sprint' as PhotoKey },
  { title: 'Herding Fundamentals', date: 'Sep 24', trainer: 'Maren Holt · Ridgeline Dog Sport', note: 'Great recall today, work on waiting at the gate.', img: 'collie' as PhotoKey },
  { title: 'Scent Work I', date: 'Sep 22', trainer: 'Ana Ruiz · Northside Canine', note: 'Found the target in under a minute on the third search.', img: 'grass' as PhotoKey },
  { title: 'Distance work', date: 'Sep 19', trainer: 'Sam Reyes · Private session', note: 'Held focus 20 meters from a calm dog. Try 15 next time.', img: 'wall' as PhotoKey },
  { title: 'Social assessment', date: 'Sep 12', trainer: 'Sam Reyes · Eastside Dog Club', note: 'Juno did well one-on-one and settled after ten minutes. She still fixates on new dogs at the gate.', img: 'rail' as PhotoKey, assessment: 'Working on it · Social' },
];

export const disciplineLevels = [
  { name: 'Sprint', level: 3, pct: 0.8 },
  { name: 'Herding', level: 2, pct: 0.55 },
  { name: 'Agility', level: 2, pct: 0.4 },
  { name: 'Scent', level: 1, pct: 0.3 },
  { name: 'Behavior', level: 1, pct: 0.2 },
];

// ---- Onboarding ----------------------------------------------------------------------------

export const HERO_WORDS: [string, PhotoKey][] = [
  ['an athlete.', 'sprint'],
  ['an explorer.', 'leap'],
  ['a good listener.', 'hurdle'],
  ['a social butterfly.', 'tunnel'],
  ['a problem solver.', 'weave'],
  ['a scent detective.', 'grass'],
];

export const ENERGY = ['Couch', 'Medium', 'High', 'Working dog'] as const;
export const ENERGY_NOTE: Record<(typeof ENERGY)[number], string> = {
  Couch: 'Happy with a walk and a nap.',
  Medium: 'One good outing a day.',
  High: 'Needs a hard session most days.',
  'Working dog': 'Bred for a job. Needs work for body and brain.',
};
export const SOCIAL = ['Loves dogs', 'Selective', 'Prefers solo'] as const;
export const INTERESTS = ['Agility', 'Scent', 'Sprint', 'Herding', 'Open play', 'Sniff spaces', 'Skills'] as const;

export const TRAIT_SPECIAL = ['None of these', 'Not sure yet'];
export const TRAIT_GROUPS: [string, string[]][] = [
  ['Around dogs', ['Plays too rough', 'Nervous with new dogs', 'Guards food or toys']],
  ['Around people', ['Nervous with strangers', 'Jumps up on people', 'Barks at visitors']],
  ['On walks', ['Pulls on the leash', 'Lunges or barks at dogs on walks', 'Chases bikes or cars', 'Slow to come when called']],
  ['When left alone', ['Struggles when left alone', 'Chews or digs when alone', 'Hard to settle in a crate']],
  ['Or', TRAIT_SPECIAL],
];

export const PLAN_GOALS = [
  { trait: 'Pulls on the leash', title: 'Loose leash walking', outcome: '3 steps · Ends with a calm walk past other dogs' },
  { trait: 'Nervous with new dogs', title: 'Calm around dogs', outcome: '4 steps · Ends with a Social clearance and group sport' },
];

export const MONTH_PLAN = [
  { when: 'Week 1 · Tue 6:00 pm', title: 'Scent Work I', meta: 'Northside Canine · 2 credits · Mental', photo: 'grass' as PhotoKey, credits: 2 },
  { when: 'Week 1 · Sat 9:00 am', title: 'Agility drop-in', meta: 'Ridgeline Dog Sport · 2 credits · Physical', photo: 'weave' as PhotoKey, credits: 2 },
  { when: 'Week 2 · Thu 6:30 pm', title: 'Small-group play', meta: 'Eastside Dog Club · 1 credit · Social', photo: 'tunnel' as PhotoKey, credits: 1 },
  { when: 'Week 3 · Sun 5:00 pm', title: 'Open field', meta: 'Eastfield Park · 1 credit · Physical', photo: 'leap' as PhotoKey, credits: 1 },
  { when: 'Week 4 · Tue 5:30 pm', title: 'Focus and Recall', meta: 'Northside Canine · 2 credits · Mental', photo: 'hurdle' as PhotoKey, credits: 2 },
];

/** Swap options for the month plan, same balance category and credit cost. */
export const MONTH_SWAPS: Record<string, { title: string; meta: string; photo: PhotoKey }> = {
  'Scent Work I': { title: 'Sniff space', meta: 'South Fork Yard · 1 credit · Mental', photo: 'wall' },
  'Agility drop-in': { title: 'Lure Sprint Heats', meta: 'Eastfield Park · 2 credits · Physical', photo: 'sprint' },
  'Small-group play': { title: 'Free roam', meta: 'Eastside Dog Club · 1 credit · Social', photo: 'grass' },
  'Open field': { title: 'Fitness and conditioning', meta: 'Northside Canine · 2 credits · Physical', photo: 'hurdle' },
  'Focus and Recall': { title: 'Herding Fundamentals', meta: 'Ridgeline Dog Sport · 2 credits · Mental', photo: 'collie' },
};
