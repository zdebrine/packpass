// What the Log (07) and Today's month header show. Sample mode keeps the designs' September; live mode
// works it out from the sessions the dog went to (my_log).
import { activeDays, monthBalance, pastSessions } from '@/data/fixtures';
import { milestones as sampleMilestones, RECHECK_QUOTE } from '@/data/passport';
import type { LogEntry, PhotoKey } from '@/data/types';
import type { SocialStage } from '@/store/app';
import { now as clock } from './clock';
import { monthDay } from './dates';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A balanced month, from the designs: three physical sessions, two mental, two social. */
export const BALANCE_TARGETS = { physical: 3, mental: 2, social: 2 } as const;
const BALANCE_ROWS = [
  { key: 'physical', label: 'Physical', color: 'agility' },
  { key: 'mental', label: 'Mental', color: 'turf' },
  { key: 'social', label: 'Social', color: 'pitch' },
] as const;

export interface LogMonth { name: string; days: number; firstWeekday: number; active: Record<number, number>; today: number | null }
export interface LogSession {
  key: string; title: string; date: string; trainer: string; note: string | null; img: PhotoKey;
  /** "Cleared · Social" / "Not yet · Herding" */
  assessment: string | null; cleared: boolean; href: string | null;
}
export interface LogView {
  balance: { label: string; done: number; of: number; color: 'agility' | 'turf' | 'pitch' }[];
  hint: string;
  stats: [string, string][];
  months: LogMonth[];
  sessions: LogSession[];
  milestones: { label: string; date: string; kind: 'on' | 'clr' | 'off' }[];
}

/** "September", and when credits reset ("Oct 1"): the 1st of next month. Sample mode's clock is the designs' Sep 29. */
export function monthHeader(at = clock()) {
  const next = new Date(at.getFullYear(), at.getMonth() + 1, 1);
  return { month: MONTH_NAMES[at.getMonth()], resets: monthDay(next) };
}

const monthOf = (y: number, m: number, entries: LogEntry[], at: Date): LogMonth => {
  const active: Record<number, number> = {};
  for (const e of entries) {
    if (e.startsAt.getFullYear() === y && e.startsAt.getMonth() === m) active[e.startsAt.getDate()] = Math.min(3, (active[e.startsAt.getDate()] ?? 0) + 1);
  }
  const first = new Date(y, m, 1);
  return {
    name: MONTH_NAMES[m], days: new Date(y, m + 1, 0).getDate(), firstWeekday: (first.getDay() + 6) % 7, active,
    today: at.getFullYear() === y && at.getMonth() === m ? at.getDate() : null,
  };
};

const hoursLabel = (min: number) => String(Math.round((min / 60) * 10) / 10);
const typeName = (t: 'social' | 'herding') => (t === 'social' ? 'Social' : 'Herding');

export function liveLog(all: LogEntry[], dogId: string | undefined, dogName: string, social: SocialStage, at = clock()): LogView {
  const entries = all.filter((e) => e.dogId === dogId);
  const y = at.getFullYear(), m = at.getMonth();
  const thisMonth = entries.filter((e) => e.startsAt.getFullYear() === y && e.startsAt.getMonth() === m);

  const balance = BALANCE_ROWS.map((r) => ({ label: r.label, color: r.color, of: BALANCE_TARGETS[r.key], done: thisMonth.filter((e) => e.balance === r.key).length }));
  const short = balance.filter((b) => b.done < b.of).sort((a, b) => (b.of - b.done) - (a.of - a.done))[0];
  const hint = !thisMonth.length
    ? `Nothing yet this month. Book a class to start ${dogName}'s month.`
    : short ? `One more ${short.label.toLowerCase()} session would round out ${dogName}'s month.` : `${dogName}'s month is balanced.`;

  const months = [monthOf(m === 0 ? y - 1 : y, (m + 11) % 12, entries, at), monthOf(y, m, entries, at)];

  const sessions = entries.map((e): LogSession => {
    const a = e.assessment;
    const sameDay = e.startsAt.toDateString() === at.toDateString();
    return {
      key: e.bookingId, title: e.title, img: e.image, date: sameDay ? 'Today' : monthDay(e.startsAt),
      trainer: [a?.assessor ?? e.noteBy ?? e.trainer, e.partner].filter(Boolean).join(' · '),
      note: a?.quote ?? e.note,
      assessment: a ? `${a.outcome === 'cleared' ? 'Cleared' : 'Not yet'} · ${typeName(a.type)}` : null,
      cleared: a?.outcome === 'cleared',
      href: a ? `/assessment/${e.bookingId}` : null,
    };
  });

  // Oldest first, for "first" milestones and counts.
  const ordered = [...entries].reverse();
  const nth = (n: number) => ordered[n - 1];
  const count = (n: number) => (nth(n) ? { label: `${n} sessions`, date: monthDay(nth(n)!.startsAt), kind: 'on' as const } : { label: `${n} sessions`, date: `${n - entries.length} to go`, kind: 'off' as const });
  const cleared = entries.find((e) => e.assessment?.type === 'social' && e.assessment.outcome === 'cleared');
  const milestones = [
    ordered[0] ? { label: `First ${ordered[0].title}`, date: monthDay(ordered[0].startsAt), kind: 'on' as const } : { label: 'First session', date: 'Book a class', kind: 'off' as const },
    social !== 'working'
      ? { label: 'Social cleared', date: cleared ? `${monthDay(cleared.startsAt)} · ${cleared.partner}` : 'On the Passport', kind: 'clr' as const }
      : { label: 'Social clearance', date: 'Calm around dogs', kind: 'off' as const },
    count(10), count(25), count(50),
  ];

  return {
    balance, hint, months, sessions, milestones,
    stats: [
      [String(thisMonth.length), `Sessions in ${MONTH_NAMES[m].slice(0, 3)}`],
      [hoursLabel(thisMonth.reduce((t, e) => t + e.durationMin, 0)), 'Hours active'],
      [String(entries.length), 'Lifetime sessions'],
    ],
  };
}

// August is a lighter sample pattern; September is the design's heat map.
export function sampleLog(dogName: string, social: SocialStage): LogView {
  const sessions: LogSession[] = [
    ...(social === 'cleared'
      ? [{ key: 'recheck', title: 'Social re-check', date: 'Today', trainer: 'Sam Reyes · Eastside Dog Club', note: RECHECK_QUOTE, img: 'tunnel' as PhotoKey, assessment: 'Cleared · Social', cleared: true, href: '/assessment/social' }]
      : []),
    ...pastSessions.map((s) => ({ ...s, key: s.title + s.date, assessment: null, cleared: false, href: null })),
  ];
  return {
    balance: monthBalance,
    hint: `One more social session would round out ${dogName}'s month.`,
    stats: [['14', 'Sessions in Sept'], ['11.5', 'Hours active'], ['42', 'Lifetime sessions']],
    months: [
      { name: 'August', days: 31, firstWeekday: 5, active: { 1: 2, 4: 1, 6: 3, 8: 2, 12: 1, 15: 3, 19: 2, 22: 1, 26: 2, 29: 3 }, today: null },
      { name: 'September', days: 30, firstWeekday: 1, active: activeDays, today: 29 },
    ],
    sessions,
    milestones: sampleMilestones(social),
  };
}
