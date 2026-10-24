// Working on (07k): the dog's focus skills, how practice on each is going this week, and each skill's detail
// (the last four weeks, its drills, trainers' notes that mention it and classes that train it).
import { activityById, drillsFor, skillById, skillLabel, type Drill, type Rating } from '@/data/practice';
import type { FocusSkill, HomeActivity, LogEntry } from '@/data/types';
import type { SessionView } from './booking';
import { now as clock } from './clock';
import { dayOffset, monthDay } from './dates';

export type Trend = 'up' | 'flat' | 'down' | 'none';
export const TREND: Record<Trend, { label: string; icon: 'trending-up' | 'minus' | 'trending-down' | 'circle-dashed' }> = {
  up: { label: 'Getting easier', icon: 'trending-up' },
  flat: { label: 'Steady', icon: 'minus' },
  down: { label: 'Tough lately', icon: 'trending-down' },
  none: { label: 'No practice yet', icon: 'circle-dashed' },
};

export interface SkillTile {
  id: string; label: string;
  /** "From Juno's traits", "Training path", "You picked" */
  source: string;
  /** Home practice on this skill this week, against a small weekly target. */
  done: number; target: number;
  trend: Trend;
}
export interface SkillWeek { key: string; label: string; count: number; ratings: Rating[] }
export interface SkillNote { key: string; note: string; by: string }

const SCORE: Record<Rating, number> = { tough: 0, mixed: 1, good: 2 };
const startOfWeek = (at: Date) => new Date(at.getFullYear(), at.getMonth(), at.getDate() - ((at.getDay() + 6) % 7));
const avg = (xs: number[]) => xs.reduce((t, x) => t + x, 0) / xs.length;

export function sourceLabel(f: FocusSkill, dogName: string) {
  return { trait: `From ${dogName}'s traits`, path: 'Training path', note: 'Trainer note', assessment: 'Assessment', owner: 'You picked' }[f.source];
}

/** The first skill gets the weekly goal (up to 3); the rest two each, never more than the goal. */
export const skillTarget = (index: number, goal: number) => Math.min(goal, index === 0 ? 3 : 2);

/** How practice on a skill is going: the last two weeks' ratings against the four weeks before. */
export function trendOf(practice: HomeActivity[], at = clock()): Trend {
  if (!practice.length) return 'none';
  const rated = practice.filter((h) => h.rating);
  const recent = rated.filter((h) => dayOffset(h.doneAt, at) > -14).map((h) => SCORE[h.rating!]);
  const before = rated.filter((h) => dayOffset(h.doneAt, at) <= -14 && dayOffset(h.doneAt, at) > -42).map((h) => SCORE[h.rating!]);
  if (!recent.length) return 'flat';
  const r = avg(recent);
  if (r < 0.8) return 'down';
  if (before.length ? r > avg(before) + 0.3 : r >= 1.5) return 'up';
  return 'flat';
}

const practiceOn = (home: HomeActivity[], skillId: string) => home.filter((h) => h.skills.includes(skillId));

export function skillTiles(focus: FocusSkill[], home: HomeActivity[], dogName: string, goal: number, at = clock()): SkillTile[] {
  const mon = startOfWeek(at);
  return focus.map((f, i) => {
    const practice = practiceOn(home, f.skillId);
    return {
      id: f.skillId, label: skillById(f.skillId)?.label ?? f.skillId, source: sourceLabel(f, dogName),
      done: practice.filter((h) => h.doneAt >= mon && dayOffset(h.doneAt, at) <= 0).length,
      target: skillTarget(i, goal), trend: trendOf(practice, at),
    };
  });
}

/** Sessions per week on a skill, the last four weeks, oldest first. */
export function skillWeeks(home: HomeActivity[], skillId: string, at = clock()): SkillWeek[] {
  const mon = startOfWeek(at);
  const practice = practiceOn(home, skillId);
  return [3, 2, 1, 0].map((back) => {
    const from = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() - back * 7);
    const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7);
    const week = practice.filter((h) => h.doneAt >= from && h.doneAt < to).sort((a, b) => +a.doneAt - +b.doneAt);
    return { key: from.toDateString(), label: back === 0 ? 'This week' : monthDay(from), count: week.length, ratings: week.map((h) => h.rating).filter((r): r is Rating => !!r) };
  });
}

const LEVEL_ORDER = { start: 0, next: 1, harder: 2 } as const;

/** The skill's drills, easiest first, and the one to do next: the easiest not logged yet. */
export function skillDrills(home: HomeActivity[], skillId: string): { drills: Drill[]; next: string | null } {
  const drills = [...drillsFor(skillId)].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  const done = new Set(home.map((h) => h.drillId).filter(Boolean));
  return { drills, next: drills.find((d) => !done.has(d.id))?.id ?? null };
}

/** Trainers' notes on sessions tagged with the skill (session_notes.skills holds the partner's tag labels). */
export function skillNotes(entries: LogEntry[], skillId: string): SkillNote[] {
  const skill = skillById(skillId);
  if (!skill) return [];
  const tags = [skill.label, ...skill.aliases].map((t) => t.toLowerCase());
  return entries
    .filter((e) => e.note && e.skills.some((t) => tags.includes(t.toLowerCase())))
    .sort((a, b) => +b.startsAt - +a.startsAt)
    .slice(0, 3)
    .map((e) => ({ key: e.bookingId, note: e.note!, by: [e.noteBy ?? e.trainer, monthDay(e.startsAt)].filter(Boolean).join(' · ') }));
}

/**
 * Today's practice (07): what the hero at the top of Log offers today, in this order. Done: something was logged at
 * home today. Class: a class later today, with a warm-up drill. Prompt: nothing picked to work on yet. Rest: the weekly
 * goal is met and there was practice on each of the last four days. Suggest: a drill for each focus skill, the one furthest behind this week first.
 */
export type TodayPractice =
  | { kind: 'done'; line: string }
  | { kind: 'class'; view: SessionView; drill: Drill | null }
  | { kind: 'prompt' }
  | { kind: 'rest' }
  | { kind: 'suggest'; drills: Drill[] };

export const REST_AFTER = 4;

export function todaysPractice(
  { tiles, home, classToday, activeDays, goalMet, at = clock() }: { tiles: SkillTile[]; home: HomeActivity[]; classToday: SessionView | null; activeDays: Set<string>; goalMet: boolean; at?: Date },
): TodayPractice {
  const today = home.filter((h) => dayOffset(h.doneAt, at) === 0).sort((a, b) => +b.doneAt - +a.doneAt)[0];
  if (today) {
    const what = [`${today.durationMin} min ${activityById(today.kind).label.toLowerCase()}`, ...today.skills.slice(0, 1).map((s) => skillLabel(s).toLowerCase())];
    return { kind: 'done', line: `Done for today. ${what.join(', ')}.` };
  }
  const drills = [...tiles]
    .map((t, i) => ({ t, i }))
    .sort((a, b) => a.t.done / a.t.target - b.t.done / b.t.target || a.i - b.i)
    .map(({ t }) => { const { drills: all, next } = skillDrills(home, t.id); return all.find((d) => d.id === next) ?? all[0]; })
    .filter((d): d is Drill => !!d);
  if (classToday) return { kind: 'class', view: classToday, drill: drills[0] ?? null };
  if (!tiles.length) return { kind: 'prompt' };
  const straight = Array.from({ length: REST_AFTER }, (_, i) => new Date(at.getFullYear(), at.getMonth(), at.getDate() - 1 - i).toDateString());
  if (goalMet && straight.every((d) => activeDays.has(d))) return { kind: 'rest' };
  return { kind: 'suggest', drills };
}
