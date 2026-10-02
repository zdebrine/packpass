// Partners work in Austin time whatever the browser's time zone is.
export const TZ = 'America/Chicago';

const parts = (d: Date) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' })
      .formatToParts(d).map((x) => [x.type, x.value]),
  );
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, wd: p.weekday as string };
};

/** "7:30 am" */
export const time = (d: Date) => {
  const { h, min } = parts(d);
  return `${h % 12 || 12}:${String(min).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`;
};
/** "7:30a" / "6p" for the week grid. */
export const shortTime = (d: Date) => time(d).replace(':00', '').replace(' am', 'a').replace(' pm', 'p');
/** Austin calendar date as YYYY-MM-DD. */
export const ymd = (d: Date) => { const p = parts(d); return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`; };
/** Hours since Austin midnight, e.g. 7.5 for 7:30 am. */
export const hourOf = (d: Date) => { const p = parts(d); return p.h + p.min / 60; };
export const weekday = (d: Date) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'long' }).format(d);
export const monthDay = (d: Date) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'short', day: 'numeric' }).format(d);
export const monthName = (d: Date) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'long' }).format(d);

/** The instant for an Austin wall-clock time (handles daylight saving). */
export function austin(dateYmd: string, hours: number): Date {
  const [y, m, d] = dateYmd.split('-').map(Number);
  const h = Math.floor(hours), min = Math.round((hours - h) * 60);
  const guess = new Date(Date.UTC(y, m - 1, d, h, min));
  const p = parts(guess);
  const asShown = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
  return new Date(guess.getTime() + (guess.getTime() - asShown));
}

/** Monday of the Austin week containing `d`, as YYYY-MM-DD. */
export function mondayOf(d: Date): string {
  const p = parts(d);
  const idx = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.wd);
  const base = new Date(Date.UTC(p.y, p.m - 1, p.d - idx));
  return base.toISOString().slice(0, 10);
}
export const addDays = (ymdStr: string, n: number) => {
  const [y, m, d] = ymdStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
/** Day-of-week index, Monday = 0, for an Austin date. */
export const dayIndex = (d: Date) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts(d).wd);
export const ageOf = (birthYear?: number | null, birthMonth?: number | null) => {
  if (!birthYear) return '';
  const now = new Date();
  const months = (now.getFullYear() - birthYear) * 12 + (now.getMonth() + 1 - (birthMonth ?? 1));
  return months < 12 ? `${Math.max(months, 1)} mo` : `${Math.floor(months / 12)} yr${months >= 24 ? 's' : ''}`;
};
export const money = (cents: number) => '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 });
