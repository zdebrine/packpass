import { NOW } from '@/data/fixtures';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Whole days between today and `d` (0 = today). */
export const dayOffset = (d: Date, now = NOW) =>
  Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86_400_000);

/** "7:30 am", "6:00 pm" */
export function time(d: Date) {
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/** "Thursday" */
export const weekday = (d: Date) => DAYS[d.getDay()];

/** "Thu 1", "Wed 30" (Book's day chips) */
export const shortDay = (d: Date) => `${DAYS[d.getDay()].slice(0, 3)} ${d.getDate()}`;

/** "Sep 29" */
export const monthDay = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;

/** "Today", "Tomorrow", or the weekday, for times within the next week. */
export function relativeDay(d: Date, now = NOW) {
  const off = dayOffset(d, now);
  if (off === 0) return 'Today';
  if (off === 1) return 'Tomorrow';
  return weekday(d);
}

/** "Thursday 7:30 am" */
export const dayTime = (d: Date) => `${relativeDay(d)} ${time(d)}`;

/** Same, for use mid-sentence: "until tomorrow 7:30 pm". */
export const dayTimeInline = (d: Date) => dayTime(d).replace(/^(Today|Tomorrow)/, (m) => m.toLowerCase());

/**
 * Cancellation copy for a session, using the 12-hour free-cancel rule.
 * "Free cancellation until Wednesday 7:30 pm"
 */
export function cancelCopy(startsAt: Date, now = NOW) {
  const deadline = new Date(startsAt.getTime() - 12 * 3_600_000);
  if (deadline <= now) return 'Inside 12 hours, so cancelling now uses the credits';
  return `Free cancellation until ${dayTimeInline(deadline)}`;
}

/** "Starts in 6 min · 7:30 am" or "Thursday · 7:30 am" */
export function startsCopy(startsAt: Date, now = NOW) {
  const mins = Math.round((startsAt.getTime() - now.getTime()) / 60_000);
  if (mins > 0 && mins <= 60) return `Starts in ${mins} min · ${time(startsAt)}`;
  return `${relativeDay(startsAt, now)} · ${time(startsAt)}`;
}

export const addMinutes = (d: Date, mins: number) => new Date(d.getTime() + mins * 60_000);
