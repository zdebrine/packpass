// The Athlete Card's numbers, discipline levels and Today's "This month" list. Sample mode keeps the
// designs' Juno; live mode counts the sessions in the Log.
import { isLive } from '@/api/client';
import { catalog } from '@/data/catalog';
import { disciplineLevels, monthDone } from '@/data/fixtures';
import type { LogEntry, PhotoKey } from '@/data/types';
import { useApp, useDog } from '@/store/app';
import { now as clock } from './clock';
import { monthDay } from './dates';
import { BALANCE_TARGETS } from './log';

/** Sessions per level: Level 1 from the first session, then a level every 4 sessions, up to Level 5. */
const PER_LEVEL = 4;
const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

export interface DogStats {
  sessions: number;
  hours: number;
  /** Days in a row with a session, ending today or yesterday. Shown from 2. */
  streak: number;
  disciplines: number;
  levels: { name: string; level: number; pct: number }[];
  /** "Five disciplines." */
  levelsTitle: string;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function statsOf(entries: LogEntry[], at = clock()): DogStats {
  const counts = new Map<string, number>();
  for (const e of entries) {
    const name = catalog.classes[e.classId]?.discipline ?? e.title;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const levels = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, n]) => {
      const level = Math.min(5, 1 + Math.floor((n - 1) / PER_LEVEL));
      return { name, level, pct: level === 5 ? 1 : (((n - 1) % PER_LEVEL) + 1) / PER_LEVEL };
    });
  const days = new Set(entries.map((e) => dayKey(e.startsAt)));
  const d = new Date(at);
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(d))) { streak++; d.setDate(d.getDate() - 1); }
  const n = levels.length;
  return {
    sessions: entries.length,
    hours: Math.round(entries.reduce((t, e) => t + e.durationMin, 0) / 60),
    streak,
    disciplines: n,
    levels: levels.slice(0, 6),
    levelsTitle: `${WORDS[n] ?? n} discipline${n === 1 ? '' : 's'}${n ? '.' : ' yet.'}`,
  };
}

/** The dog's stats, from the Log in live mode. */
export function useDogStats(): DogStats {
  const dog = useDog();
  const log = useApp((s) => s.log);
  if (!isLive || !log) {
    return { sessions: 42, hours: 38, streak: 9, disciplines: 5, levels: disciplineLevels, levelsTitle: 'Five disciplines.' };
  }
  return statsOf(log.filter((e) => e.dogId === dog.id));
}

export interface MonthItem { key: string; meta: string; title: string; photo: PhotoKey }

/** Sessions done this month for Today's list, and the balance the month is shortest on. */
export function useMonthDone(): { done: MonthItem[]; short: 'Physical' | 'Mental' | 'Social' | null } {
  const dog = useDog();
  const log = useApp((s) => s.log);
  if (!isLive || !log) {
    return { done: monthDone.map((m) => ({ key: m.title, meta: m.meta, title: m.title, photo: m.photo })), short: null };
  }
  const at = clock();
  const month = log.filter((e) => e.dogId === dog.id && e.startsAt.getFullYear() === at.getFullYear() && e.startsAt.getMonth() === at.getMonth());
  const label = (b: LogEntry['balance']) => (b === 'physical' ? 'Physical' : b === 'mental' ? 'Mental' : 'Social');
  const gaps = (Object.keys(BALANCE_TARGETS) as (keyof typeof BALANCE_TARGETS)[])
    .map((b) => ({ b, gap: BALANCE_TARGETS[b] - month.filter((e) => e.balance === b).length }))
    .filter((x) => x.gap > 0)
    .sort((a, b) => b.gap - a.gap);
  return {
    done: [...month].reverse().map((e) => ({ key: e.bookingId, meta: `Done · ${monthDay(e.startsAt)} · ${label(e.balance)}`, title: e.title, photo: e.image })),
    short: gaps[0] ? label(gaps[0].b) : null,
  };
}
