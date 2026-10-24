// What the Log (07) and Today's month header show. Sample mode keeps the designs' September; live mode
// works it out from the sessions the dog went to (my_log). Both add what the owner logged at home
// (home_activities), which counts toward the month's balance at half the weight of a class.
import { clearanceName } from '@/data/catalog';
import { activeDays, monthBalance, pastSessions } from '@/data/fixtures';
import { milestones as sampleMilestones, RECHECK_QUOTE } from '@/data/passport';
import { activityById, RATING_LABEL, skillLabel, type Balance } from '@/data/practice';
import type { HomeActivity, LogEntry, PhotoKey, PhotoSource } from '@/data/types';
import type { IconName } from '@/ds/Icon';
import type { SocialStage } from '@/store/app';
import { now as clock } from './clock';
import { dayOffset, monthDay, time } from './dates';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** A balanced month, from the designs: three physical sessions, two mental, two social. */
export const BALANCE_TARGETS = { physical: 3, mental: 2, social: 2 } as const;
/** Two home activities count as one class toward the balance (Zak, 2026-10-24). */
export const HOME_WEIGHT = 0.5;
const BALANCE_ROWS = [
  { key: 'physical', label: 'Physical', color: 'agility', home: 'walk' },
  { key: 'mental', label: 'Mental', color: 'turf', home: 'sniff walk' },
  { key: 'social', label: 'Social', color: 'pitch', home: 'patio visit' },
] as const;

export interface LogMonth {
  name: string; days: number; firstWeekday: number; active: Record<number, number>; today: number | null;
  /** Days with a class: a dot under the date. */
  classDays: number[];
}
/** A mark under a day in This week: a filled dot for a class, a ring for time at home. Null balance: Something else. */
export interface DayMark { balance: Balance | null; home: boolean }
export interface WeekDay { key: string; label: string; date: number; today: boolean; future: boolean; marks: DayMark[] }
/** This week (07): practice days against the weekly goal. No streak (Zak, 2026-10-24). */
export interface LogWeek { goal: number; practiced: number; days: WeekDay[] }
export interface Milestone { label: string; date: string; kind: 'on' | 'clr' | 'off' }
export interface LogSession {
  key: string; title: string; date: string; trainer: string; note: string | null; img: PhotoSource;
  /** "Cleared · Social" / "Not yet · Herding" */
  assessment: string | null; cleared: boolean; href: string | null;
  /** A no-show: the dog wasn't checked in and the booking wasn't cancelled in time. */
  missed: boolean;
}
export interface HomeRow {
  id: string; icon: IconName;
  /** "Walk · 30 min" */
  title: string;
  /** "At home · Good" */
  sub: string;
  tags: string[]; note: string | null; time: string;
}
export type FeedRow = ({ type: 'class'; at: Date } & LogSession) | ({ type: 'home'; at: Date } & HomeRow);
export interface FeedDay { key: string; day: string; rows: FeedRow[] }
export interface BalanceRow {
  key: Balance; label: string; color: 'agility' | 'turf' | 'pitch'; of: number;
  /** Classes and home activities this month; done counts home at half weight. */
  classes: number; home: number; done: number;
}
export interface LogView {
  balance: BalanceRow[];
  hint: string;
  stats: [string, string][];
  months: LogMonth[];
  /** Classes and home activities, newest first, grouped by day. */
  feed: FeedDay[];
  milestones: Milestone[];
  week: LogWeek;
  /** Nothing logged at home yet: the Log asks for a first walk. */
  noHome: boolean;
}

/** "September", and when credits reset ("Oct 1"): the 1st of next month. Sample mode's clock is the designs' Sep 29. */
export function monthHeader(at = clock()) {
  const next = new Date(at.getFullYear(), at.getMonth() + 1, 1);
  return { month: MONTH_NAMES[at.getMonth()], resets: monthDay(next) };
}

const sameMonth = (d: Date, at: Date) => d.getFullYear() === at.getFullYear() && d.getMonth() === at.getMonth();

const monthOf = (y: number, m: number, dates: Date[], at: Date, base: Record<number, number> = {}, classes: Date[] = []): LogMonth => {
  const active: Record<number, number> = { ...base };
  for (const d of dates) {
    if (d.getFullYear() === y && d.getMonth() === m) active[d.getDate()] = Math.min(3, (active[d.getDate()] ?? 0) + 1);
  }
  const first = new Date(y, m, 1);
  return {
    name: MONTH_NAMES[m], days: new Date(y, m + 1, 0).getDate(), firstWeekday: (first.getDay() + 6) % 7, active,
    today: at.getFullYear() === y && at.getMonth() === m ? at.getDate() : null,
    classDays: [...new Set(classes.filter((d) => d.getFullYear() === y && d.getMonth() === m).map((d) => d.getDate()))],
  };
};

const startOfWeek = (at: Date) => new Date(at.getFullYear(), at.getMonth(), at.getDate() - ((at.getDay() + 6) % 7));
const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Monday to Sunday around `at`, with each day's classes and home time. */
export function weekOf(classes: { at: Date; balance: Balance | null }[], home: HomeActivity[], goal: number, at: Date): LogWeek {
  const mon = startOfWeek(at);
  const days = WEEK_LABELS.map((label, i): WeekDay => {
    const d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
    const off = dayOffset(d, at);
    const marks: DayMark[] = [
      ...classes.filter((c) => dayOffset(c.at, d) === 0).map((c) => ({ balance: c.balance, home: false })),
      ...home.filter((h) => dayOffset(h.doneAt, d) === 0).map((h) => ({ balance: h.balance, home: true })),
    ];
    return { key: d.toDateString(), label, date: d.getDate(), today: off === 0, future: off > 0, marks: marks.slice(0, 3) };
  });
  const practiced = new Set(home.filter((h) => h.doneAt >= mon && dayOffset(h.doneAt, at) <= 0 && dayOffset(h.doneAt, mon) < 7).map((h) => h.doneAt.toDateString())).size;
  return { goal, practiced, days };
}

/** Milestones from time at home: the first one logged, the first week at the goal, and two counts. */
function homeMilestones(home: HomeActivity[], goal: number): Milestone[] {
  const ordered = [...home].sort((a, b) => +a.doneAt - +b.doneAt);
  const nth = (list: HomeActivity[], n: number, label: string, todo: string): Milestone => (list.length >= n
    ? { label, date: monthDay(list[n - 1].doneAt), kind: 'on' }
    : { label, date: list.length ? `${n - list.length} to go` : todo, kind: 'off' });
  // The first Monday-to-Sunday week with practice on `goal` different days, dated the day it got there.
  let fullWeek: Date | null = null;
  const seen = new Map<string, Set<string>>();
  for (const h of ordered) {
    const wk = startOfWeek(h.doneAt).toDateString();
    const set = seen.get(wk) ?? new Set<string>();
    set.add(h.doneAt.toDateString());
    seen.set(wk, set);
    if (set.size >= goal) { fullWeek = h.doneAt; break; }
  }
  return [
    nth(ordered, 1, 'First practice logged', 'Log a walk'),
    fullWeek ? { label: 'First full week', date: monthDay(fullWeek), kind: 'on' } : { label: 'First full week', date: 'Hit a weekly goal', kind: 'off' },
    nth(ordered.filter((h) => h.kind === 'walk' && h.skills.includes('loose_leash')), 10, '10 walks on a loose leash', '10 to go'),
    nth(ordered.filter((h) => h.kind === 'patio'), 5, '5 patio visits', '5 to go'),
  ];
}

/** Earned first, keeping each group's order. */
const earnedFirst = (list: Milestone[]) => [...list.filter((x) => x.kind !== 'off'), ...list.filter((x) => x.kind === 'off')];

const hoursLabel = (min: number) => String(Math.round((min / 60) * 10) / 10);
/** "1.5" or "2" */
export const countLabel = (n: number) => String(Math.round(n * 10) / 10);

/** The month's balance: each class counts one, each home activity half. */
export function balanceOf(classes: { balance: Balance }[], home: HomeActivity[]): BalanceRow[] {
  return BALANCE_ROWS.map((r) => {
    const c = classes.filter((e) => e.balance === r.key).length;
    const h = home.filter((e) => e.balance === r.key).length;
    return { key: r.key, label: r.label, color: r.color, of: BALANCE_TARGETS[r.key], classes: c, home: h, done: c + h * HOME_WEIGHT };
  });
}

function balanceHint(balance: BalanceRow[], dogName: string, empty: boolean) {
  if (empty) return `Book a class or log a walk to start ${dogName}'s month.`;
  const short = balance.filter((b) => b.done < b.of).sort((a, b) => (b.of - b.done) - (a.of - a.done))[0];
  if (!short) return `${dogName}'s month is balanced.`;
  const row = BALANCE_ROWS.find((r) => r.key === short.key)!;
  const label = short.label.toLowerCase();
  return short.of - short.done <= HOME_WEIGHT
    ? `${row.home.charAt(0).toUpperCase() + row.home.slice(1)} would round out ${dogName}'s ${label} work this month.`
    : `One more ${label} class or two ${row.home}s would round out ${dogName}'s month.`;
}

/** "Today", "Yesterday", "Mon Sep 21" */
function dayLabel(d: Date, at: Date) {
  const off = dayOffset(d, at);
  if (off === 0) return 'Today';
  if (off === -1) return 'Yesterday';
  return `${DAY_NAMES[d.getDay()]} ${monthDay(d)}`;
}

export function homeRow(h: HomeActivity): HomeRow {
  const a = activityById(h.kind);
  return {
    id: h.id, icon: a.icon, title: `${a.label} · ${h.durationMin} min`,
    sub: ['At home', h.rating ? RATING_LABEL[h.rating] : null].filter(Boolean).join(' · '),
    tags: h.skills.map(skillLabel), note: h.note, time: time(h.doneAt),
  };
}

function feedOf(classes: { session: LogSession; at: Date }[], home: HomeActivity[], at: Date): FeedDay[] {
  const rows: FeedRow[] = [
    ...classes.map(({ session, at: when }) => ({ type: 'class' as const, at: when, ...session })),
    ...home.map((h) => ({ type: 'home' as const, at: h.doneAt, ...homeRow(h) })),
  ].sort((a, b) => +b.at - +a.at);
  const days: FeedDay[] = [];
  for (const r of rows) {
    const key = r.at.toDateString();
    const last = days[days.length - 1];
    if (last?.key === key) last.rows.push(r);
    else days.push({ key, day: dayLabel(r.at, at), rows: [r] });
  }
  return days;
}

const activeDayCount = (dates: Date[], at: Date) => new Set(dates.filter((d) => sameMonth(d, at)).map((d) => d.getDate())).size;

/** all: sessions the dog went to. missed: no-shows, which show in the list but don't count towards anything. */
export function liveLog(all: LogEntry[], missed: LogEntry[], homeAll: HomeActivity[], dogId: string | undefined, dogName: string, social: SocialStage, goal = 3, at = clock()): LogView {
  const entries = all.filter((e) => e.dogId === dogId);
  const home = homeAll.filter((h) => h.dogId === dogId);
  const listed = [...entries, ...missed.filter((e) => e.dogId === dogId)];
  const y = at.getFullYear(), m = at.getMonth();
  const thisMonth = entries.filter((e) => sameMonth(e.startsAt, at));
  const homeMonth = home.filter((h) => sameMonth(h.doneAt, at));

  const balance = balanceOf(thisMonth, homeMonth);
  const hint = balanceHint(balance, dogName, !thisMonth.length && !homeMonth.length);
  const dates = [...entries.map((e) => e.startsAt), ...home.map((h) => h.doneAt)];
  const classDates = entries.map((e) => e.startsAt);
  const months = [monthOf(m === 0 ? y - 1 : y, (m + 11) % 12, dates, at, {}, classDates), monthOf(y, m, dates, at, {}, classDates)];

  const sessions = listed.map((e) => {
    const a = e.assessment;
    const session: LogSession = {
      key: e.bookingId, title: e.title, img: e.image, date: dayOffset(e.startsAt, at) === 0 ? 'Today' : monthDay(e.startsAt),
      trainer: [a?.assessor ?? e.noteBy ?? e.trainer, e.partner].filter(Boolean).join(' · '),
      note: a?.quote ?? e.note,
      assessment: a ? `${a.outcome === 'cleared' ? 'Cleared' : 'Not yet'} · ${clearanceName(a.type)}` : null,
      cleared: a?.outcome === 'cleared',
      href: e.missed ? `/missed/${e.bookingId}` : a ? `/assessment/${e.bookingId}` : null,
      missed: e.missed,
    };
    return { session, at: e.startsAt };
  });

  // Oldest first, for "first" milestones and counts.
  const ordered = [...entries].sort((a, b) => +a.startsAt - +b.startsAt);
  const nth = (n: number) => ordered[n - 1];
  const count = (n: number) => (nth(n) ? { label: `${n} sessions`, date: monthDay(nth(n)!.startsAt), kind: 'on' as const } : { label: `${n} sessions`, date: `${n - entries.length} to go`, kind: 'off' as const });
  const cleared = entries.find((e) => e.assessment?.type === 'social' && e.assessment.outcome === 'cleared');
  const milestones = earnedFirst([
    ordered[0] ? { label: `First ${ordered[0].title}`, date: monthDay(ordered[0].startsAt), kind: 'on' as const } : { label: 'First session', date: 'Book a class', kind: 'off' as const },
    social !== 'working'
      ? { label: 'Social cleared', date: cleared ? `${monthDay(cleared.startsAt)} · ${cleared.partner}` : 'On the Passport', kind: 'clr' as const }
      : { label: 'Social clearance', date: 'Calm around dogs', kind: 'off' as const },
    ...homeMilestones(home, goal),
    count(10), count(25), count(50),
  ]);

  return {
    balance, hint, months, milestones, feed: feedOf(sessions, home, at),
    week: weekOf(entries.map((e) => ({ at: e.startsAt, balance: e.balance })), home, goal, at),
    noHome: !home.length,
    stats: [
      [String(activeDayCount(dates, at)), `Active days in ${MONTH_NAMES[m].slice(0, 3)}`],
      [hoursLabel(thisMonth.reduce((t, e) => t + e.durationMin, 0) + homeMonth.reduce((t, h) => t + h.durationMin, 0)), 'Hours active'],
      [String(entries.length), 'Lifetime sessions'],
    ],
  };
}

/** "Sep 27" in the sample clock's year. */
const sampleDate = (label: string, at: Date) => {
  const [mon, day] = label.split(' ');
  return new Date(at.getFullYear(), MONTH_NAMES.findIndex((n) => n.startsWith(mon)), Number(day), 18);
};

// August is a lighter sample pattern; September is the design's heat map. Home activities add to both.
// The sample classes' balance, for This week's dots.
const SAMPLE_BALANCE: Record<string, Balance> = {
  'Lure Sprint Heats': 'physical', 'Herding Fundamentals': 'physical', 'Scent Work I': 'mental', 'Distance work': 'social', 'Social assessment': 'social', 'Social re-check': 'social',
};

export function sampleLog(dogName: string, social: SocialStage, homeAll: HomeActivity[], dogId: string, goal = 3, at = clock()): LogView {
  const home = homeAll.filter((h) => h.dogId === dogId);
  const homeMonth = home.filter((h) => sameMonth(h.doneAt, at));
  const sessions = [
    ...(social === 'cleared'
      ? [{ session: { key: 'recheck', title: 'Social re-check', date: 'Today', trainer: 'Sam Reyes · Eastside Dog Club', note: RECHECK_QUOTE, img: 'dogs_meeting_on_leash' as PhotoKey, assessment: 'Cleared · Social', cleared: true, href: '/assessment/social', missed: false }, at: new Date(at.getTime() - 3_600_000) }]
      : []),
    ...pastSessions.map((s) => ({ session: { ...s, key: s.title + s.date, assessment: null, cleared: false, href: null, missed: false }, at: sampleDate(s.date, at) })),
  ];
  // The designs' month as classes, plus what was logged at home.
  const classes = monthBalance.flatMap((b) => Array.from({ length: b.done }, () => ({ balance: b.label.toLowerCase() as Balance })));
  const balance = balanceOf(classes, homeMonth);
  const sept = Object.keys(activeDays).map((d) => new Date(at.getFullYear(), at.getMonth(), Number(d)));
  const classDates = sessions.map((s) => s.at);
  return {
    balance,
    hint: balanceHint(balance, dogName, false),
    stats: [
      [String(activeDayCount([...sept, ...homeMonth.map((h) => h.doneAt)], at)), `Active days in ${MONTH_NAMES[at.getMonth()].slice(0, 3)}`],
      [hoursLabel(11.5 * 60 + homeMonth.reduce((t, h) => t + h.durationMin, 0)), 'Hours active'],
      ['42', 'Lifetime sessions'],
    ],
    months: [
      monthOf(at.getFullYear(), at.getMonth() - 1, home.map((h) => h.doneAt), at, { 1: 2, 4: 1, 6: 3, 8: 2, 12: 1, 15: 3, 19: 2, 22: 1, 26: 2, 29: 3 }),
      monthOf(at.getFullYear(), at.getMonth(), home.map((h) => h.doneAt), at, activeDays, classDates),
    ],
    feed: feedOf(sessions, home, at),
    milestones: earnedFirst([...sampleMilestones(social), ...homeMilestones(home, goal)]),
    week: weekOf(sessions.map((s) => ({ at: s.at, balance: SAMPLE_BALANCE[s.session.title] ?? null })), home, goal, at),
    noHome: !home.length,
  };
}
