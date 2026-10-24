// Sample Juno's practice between classes (LOG_AT_HOME_SPEC.md §6): the week before the designs' Sep 29.
import { NOW } from './fixtures';
import type { HomeActivity } from './types';

const at = (daysAgo: number, h: number, m = 0) => new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - daysAgo, h, m);

export const SAMPLE_HOME_LOG: HomeActivity[] = [
  { id: 'home-1', dogId: 'juno', kind: 'walk', doneAt: at(1, 18, 10), durationMin: 30, balance: 'physical', skills: ['loose_leash'], rating: 'good', note: 'Turned at every tight leash. Fewer turns by the end.', drillId: 'turn-and-go', reps: 12 },
  { id: 'home-2', dogId: 'juno', kind: 'park', doneAt: at(1, 8), durationMin: 10, balance: 'social', skills: ['calm_dogs'], rating: 'good', note: 'Five calm looks in a row, then we left.', drillId: 'watch-the-park', reps: 5 },
  { id: 'home-3', dogId: 'juno', kind: 'walk', doneAt: at(2, 7, 30), durationMin: 20, balance: 'physical', skills: ['loose_leash'], rating: 'mixed', note: 'Pulled at the corner by the school.', drillId: null, reps: null },
  { id: 'home-4', dogId: 'juno', kind: 'sniff', doneAt: at(3, 17, 45), durationMin: 30, balance: 'mental', skills: ['decompression'], rating: 'good', note: null, drillId: null, reps: null },
  { id: 'home-5', dogId: 'juno', kind: 'patio', doneAt: at(4, 11), durationMin: 20, balance: 'social', skills: ['calm_dogs'], rating: 'tough', note: 'Couldn\'t settle with dogs at the next table. Left after 15 minutes.', drillId: null, reps: null },
];

/** Which skills the sample classes' trainer notes are about (live notes carry the partner's skill tags). */
export const SAMPLE_NOTE_SKILLS: Record<string, string[]> = {
  'Distance work': ['calm_dogs'],
  'Social assessment': ['calm_dogs', 'settle_public'],
  'Herding Fundamentals': ['recall'],
  'Lure Sprint Heats': ['fitness'],
  'Scent Work I': ['enrichment'],
};
