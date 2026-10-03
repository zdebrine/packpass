// Passport, training paths, milestones and notifications. These depend on where Juno is on
// the Social path, so they're derived from app state instead of being fixed fixtures.

import type { SocialStage } from '@/store/app';
import type { ClearanceStatus, ClearanceType, PhotoKey } from './types';

export type IconName =
  | 'users' | 'trees' | 'zap' | 'fence' | 'trophy' | 'check' | 'arrow-right' | 'lock' | 'shield' | 'shield-check'
  | 'shield-alert' | 'trending-up' | 'calendar-check' | 'message-square' | 'award' | 'rotate-ccw' | 'clock';

export interface Clearance {
  type: ClearanceType;
  name: string;
  status: ClearanceStatus;
  eyebrow: string;
  sub: string;
  facts: [string, string][];
  unlocks: { icon: IconName; label: string; ex: string; photo: PhotoKey }[];
  assessor?: string;
  strengths?: string[];
  working?: string[];
  note?: string;
}

export const SOCIAL_UNLOCKS: Clearance['unlocks'] = [
  { icon: 'zap', label: 'Group sport', ex: 'Agility and sprint drop-ins', photo: 'weave' },
  { icon: 'trees', label: 'Play', ex: 'Open field, free roam, small-group play', photo: 'tunnel' },
  { icon: 'users', label: 'Group skills', ex: 'Focus and Recall, Scent Work I', photo: 'hurdle' },
];

export const RECHECK_QUOTE = "Juno read the group well and recovered fast after a startle. She's ready for group sport.";
export const FIRST_QUOTE =
  'Juno did well one-on-one and settled after ten minutes. She still fixates on new dogs at the gate. Two sessions should get her there.';

export function socialClearance(stage: SocialStage, expired: boolean): Clearance {
  if (stage === 'cleared') {
    return {
      type: 'social',
      name: 'Social',
      status: expired ? 'expired' : 'cleared',
      eyebrow: expired ? 'Verified · Expired' : 'Verified clearance',
      sub: expired ? 'Expired · Eastside Dog Club' : 'Eastside Dog Club · Sep 2026',
      facts: [['Issued by', 'Eastside Dog Club'], ['Assessed', 'Sep 2026'], ['Expires', expired ? 'Sep 2026' : 'Sep 2027']],
      unlocks: SOCIAL_UNLOCKS,
      assessor: 'Sam Reyes, Eastside Dog Club · Sep 2026',
      strengths: ['Calm in group play', "Reads other dogs' signals", 'Recovers fast after a startle'],
      working: ['Fixates for the first few minutes'],
    };
  }
  return {
    type: 'social',
    name: 'Social',
    status: 'working',
    eyebrow: stage === 'earned' ? 'Re-check passed' : 'Working toward it',
    sub: stage === 'earned' ? 'Result in · Tap to see' : 'Calm around dogs · Step 2 of 4',
    facts: [['Assessed at', 'Eastside Dog Club'], ['First check', 'Sep 12 · Not yet'], ['Next', stage === 'earned' ? 'Done' : 'Social re-check']],
    unlocks: SOCIAL_UNLOCKS,
    assessor: 'Sam Reyes, Eastside Dog Club · Sep 12',
    strengths: ['Calm one-on-one', 'Recovers fast after a startle', 'Easy to handle at the gate'],
    working: ['Fixates on new dogs at the gate', 'Fixates for the first few minutes'],
  };
}

export const HERDING: Clearance = {
  type: 'herding',
  name: 'Herding',
  status: 'needs',
  eyebrow: 'Discipline · Stays at the partner',
  sub: 'Assessed at each partner',
  facts: [['Assessed at', 'Each herding partner'], ['Assessed', 'Not yet'], ['Expires', 'Set by the partner']],
  unlocks: [
    { icon: 'fence', label: 'Herding on Livestock', ex: 'Ridgeline Dog Sport', photo: 'collie' },
    { icon: 'trophy', label: 'Herding Advanced', ex: 'Northside Barn', photo: 'collie' },
  ],
  note: 'Herding partners assess every dog on livestock themselves. A Herding clearance is shown as Assessed at that partner and does not transfer.',
};

export const STATUS_LABEL: Record<ClearanceStatus, string> = {
  cleared: 'Cleared',
  expired: 'Expired',
  working: 'Working on it',
  needs: 'Needs assessment',
};

// ---- Training paths ------------------------------------------------------------------------

export type StepState = 'done' | 'next' | 'locked' | 'final';
export interface PathStep {
  title: string;
  meta: string;
  state: StepState;
  stateLabel: string;
  /** The class to book for this step. */
  classId?: string;
}
export interface Goal {
  id: 'calm-around-dogs' | 'loose-leash-walking';
  title: string;
  lede: string;
  updated: string;
  steps: PathStep[];
  trainers: 'reactivity' | 'leash';
  /** Live mode: false for a path the dog hasn't started (shown with a Start button). */
  started?: boolean;
}

export function goals(stage: SocialStage): Goal[] {
  const done = stage !== 'working';
  const calm: Goal = {
    id: 'calm-around-dogs',
    title: 'Calm around dogs',
    lede: 'Finish this path to earn a Social clearance and access to group sport.',
    updated: done ? 'Complete · Social re-check passed today' : 'Updated after the Social assessment, Sep 12',
    trainers: 'reactivity',
    steps: done
      ? [
          { title: 'Distance work', meta: 'Private session · Sam Reyes · 3 credits', state: 'done', stateLabel: 'Done Sep 19' },
          { title: 'Parallel walk', meta: 'Private session · Sam Reyes · 3 credits', state: 'done', stateLabel: 'Done Sep 24' },
          { title: 'Small-group play', meta: 'Small group · Eastside Dog Club · 2 credits', state: 'done', stateLabel: 'Done Sep 26' },
          { title: 'Social re-check', meta: 'Assessment · Eastside Dog Club · 2 credits', state: 'done', stateLabel: 'Passed today. Social cleared.' },
        ]
      : [
          { title: 'Distance work', meta: 'Private session · Sam Reyes · 3 credits', state: 'done', stateLabel: 'Done Sep 19' },
          { title: 'Parallel walk', meta: 'Private session · Sam Reyes · 3 credits', state: 'next', stateLabel: 'Next', classId: 'parallel-walk' },
          { title: 'Small-group play', meta: 'Small group · Eastside Dog Club · 2 credits', state: 'locked', stateLabel: 'Opens after step 2' },
          { title: 'Social re-check', meta: 'Assessment · Eastside Dog Club · 2 credits', state: 'final', stateLabel: 'Unlocks the Social clearance and group sport' },
        ],
  };
  const leash: Goal = {
    id: 'loose-leash-walking',
    title: 'Loose leash walking',
    lede: 'Finish this path to walk Juno past other dogs on a loose leash.',
    updated: 'Started from your traits at sign-up',
    trainers: 'leash',
    steps: [
      { title: '1:1 intro', meta: 'Private session · Ana Ruiz · 3 credits', state: 'next', stateLabel: 'Next', classId: 'loose-leash' },
      { title: 'Quiet streets', meta: 'Private session · Ana Ruiz · 3 credits', state: 'locked', stateLabel: 'Opens after step 1' },
      { title: 'Calm walk past dogs', meta: 'Small group · Northside Canine · 2 credits', state: 'final', stateLabel: 'Ends with a calm walk past other dogs' },
    ],
  };
  return [calm, leash];
}

/** Classes on each path, in order (matches path_steps in supabase/seed.sql). */
export const PATH_CLASSES: Record<Goal['id'], string[]> = {
  'calm-around-dogs': ['calm-private', 'parallel-walk', 'small-group-play', 'social-recheck'],
  'loose-leash-walking': ['loose-leash', 'loose-leash', 'focus-recall'],
};

export const stepIndex = (g: Goal) => {
  const i = g.steps.findIndex((s) => s.state === 'next');
  return i === -1 ? g.steps.length : i;
};
export const isComplete = (g: Goal) => g.steps.every((s) => s.state === 'done');

export interface PathTrainer {
  name: string;
  meta: string;
  tags: string[];
  photo: PhotoKey;
  /** Class to book with this trainer, if they're on PackPass. */
  classId?: string;
}

export const PATH_TRAINERS: Record<'reactivity' | 'leash' | 'behaviorist', PathTrainer[]> = {
  reactivity: [
    { name: 'Sam Reyes', meta: 'Eastside Dog Club · 1.8 mi · 3 credits', tags: ['Reactivity', 'Calm exposure'], photo: 'rail' as PhotoKey, classId: 'calm-private' },
    { name: 'Ana Ruiz', meta: 'Northside Canine · 1.1 mi · 3 credits', tags: ['Separation', 'Reactivity'], photo: 'grass' as PhotoKey, classId: 'loose-leash' },
    { name: 'Theo Grant', meta: 'In-home visits · 4 credits', tags: ['Separation', 'Puppy foundations'], photo: 'leap' as PhotoKey },
  ],
  leash: [
    { name: 'Ana Ruiz', meta: 'Northside Canine · 1.1 mi · 3 credits', tags: ['Reactivity', 'Recall'], photo: 'grass' as PhotoKey, classId: 'loose-leash' },
    { name: 'Theo Grant', meta: 'In-home visits · 4 credits', tags: ['Leash skills', 'Puppy foundations'], photo: 'leap' as PhotoKey },
  ],
  behaviorist: [
    { name: 'Dr. Nadia Ferris', meta: 'Certified behaviorist · Video or in-home · 6 credits', tags: ['Behaviorist', 'Separation'], photo: 'lab' as PhotoKey },
    { name: 'Dr. Owen Hale', meta: 'Veterinary behaviorist · Cedar Animal Clinic · 8 credits', tags: ['Behaviorist', 'Vet'], photo: 'hurdle' as PhotoKey },
  ],
};

// ---- Milestones ----------------------------------------------------------------------------

export function milestones(stage: SocialStage) {
  const social = stage === 'cleared'
    ? { label: 'Social cleared', date: 'Today · Eastside Dog Club', kind: 'clr' as const }
    : { label: 'Social clearance', date: 'Calm around dogs', kind: 'off' as const };
  return [
    { label: 'First herding class', date: 'Mar 12', kind: 'on' as const },
    social,
    { label: '25 sessions', date: 'Jul 30', kind: 'on' as const },
    { label: '1 year with PackPass', date: 'Feb 2027', kind: 'off' as const },
    { label: '50 sessions', date: '8 to go', kind: 'off' as const },
  ];
}

// ---- Notifications -------------------------------------------------------------------------

export type NotifCategory = 'Clearances' | 'Bookings' | 'Notes';
export type NotifTone = 'clr' | 'path' | 'ms' | 'n';
export interface Notif {
  id: string;
  icon: IconName;
  tone: NotifTone;
  title: string;
  body: string;
  time: string;
  cat: NotifCategory;
  isNew: boolean;
  href?: string;
}

export function notifications(stage: SocialStage): Notif[] {
  const recheck: Notif[] = stage === 'working' ? [] : [
    { id: 'n-recheck', icon: 'check', tone: 'path', title: 'Step 4 of 4 done', body: 'Social re-check with Sam Reyes. Calm around dogs is complete.', time: 'Just now', cat: 'Clearances', isNew: true, href: '/goal/calm-around-dogs' },
  ];
  return [
    ...recheck,
    { id: 'n-booked-sgp', icon: 'calendar-check', tone: 'n', title: 'Booked. Small-group play', body: 'Thursday 6:30 pm · Eastside Dog Club · 1 credit', time: '1h', cat: 'Bookings', isNew: true, href: '/class/small-group-play.2.1830' },
    { id: 'n-notes-dev', icon: 'message-square', tone: 'n', title: 'Session notes from Dev Patel', body: 'Fastest heat yet. Needs a longer warm-up.', time: '3h', cat: 'Notes', isNew: true, href: '/log' },
    { id: 'n-25', icon: 'award', tone: 'ms', title: '25 sessions', body: 'Juno has trained 25 times with PackPass.', time: 'Jul 30', cat: 'Clearances', isNew: false, href: '/log' },
    { id: 'n-waitlist', icon: 'users', tone: 'n', title: 'Spot open. Lure Sprint Heats', body: 'A waitlist spot opened for Saturday 7:00 pm.', time: 'Jul 26', cat: 'Bookings', isNew: false, href: '/class/lure-sprint.4.1900' },
    { id: 'n-reset', icon: 'rotate-ccw', tone: 'n', title: 'Credits reset', body: '10 new credits for August.', time: 'Aug 1', cat: 'Bookings', isNew: false },
  ];
}

/** The design's "Session notes from Dev Patel" starts read. */
export const INITIALLY_READ = ['n-notes-dev'];
