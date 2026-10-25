import type { ReportCard } from './types';

/**
 * Sample mode's report card (22a and 22b): Dev's note on Juno after Saturday's agility drop-in, with three homework items
 * until next Saturday. Dated from the clock so it's always last Saturday's.
 */
export function sampleReportCards(now: Date): ReportCard[] {
  const startsAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 1) % 7 || 7), 10, 0);
  return [{
    bookingId: 'sample-report', dogId: 'juno', sessionId: 'agility-drop-in.sample', classId: 'agility-drop-in', title: 'Agility drop-in', startsAt,
    partner: 'Ridgeline Dog Sport', trainer: 'Dev Patel', trainerRole: 'Agility and sprint coach', trainerPhoto: 'dog_running_on_beach', discipline: 'Agility',
    note: 'Great focus through the tunnel. Lost her head when the Lab arrived. Short sessions near other dogs will help.',
    ratings: { focus: 3, sociability: 1, skill: 2 },
    homework: [
      { text: 'Mat at home', drill: 'mat-at-home' },
      { text: 'Hand target, 10 reps before meals', drill: null },
      { text: 'Watch the park', drill: 'watch-the-park' },
    ],
    done: [],
    openUntil: new Date(startsAt.getTime() + 7 * 86_400_000),
  }];
}
