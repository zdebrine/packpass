// Busy times from an iCalendar (.ics) feed: Gingr, Clicks!, Acuity, Google's or Apple's secret address.
// Timed events only (all-day events are usually holidays or reminders, not client time), skipping cancelled and
// free ("transparent") ones. Daily and weekly repeats are expanded with INTERVAL, COUNT, UNTIL, BYDAY and EXDATE;
// other repeat rules count their first time only. Times with no zone are read as Austin time, like the rest of
// PackPass.

export interface Busy { starts_at: string; ends_at: string; title: string }

const DEFAULT_TZ = 'America/Chicago';
const DAY_MS = 86_400_000;
const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** Joins folded lines (a continuation starts with a space or tab) and splits them. */
export function unfold(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

interface Prop { name: string; params: Record<string, string>; value: string }

function prop(line: string): Prop | null {
  const colon = line.indexOf(':');
  if (colon < 1) return null;
  const [name, ...params] = line.slice(0, colon).split(';');
  return {
    name: name.toUpperCase(),
    params: Object.fromEntries(params.map((p) => { const [k, v = ''] = p.split('='); return [k.toUpperCase(), v.replace(/^"|"$/g, '')]; })),
    value: line.slice(colon + 1),
  };
}

const text = (v: string) => v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();

/** Minutes the zone is ahead of UTC at this instant. */
function offsetMin(tz: string, at: number): number {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(at)).map((p) => [p.type, p.value]));
  const local = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((local - at) / 60_000);
}

/** A wall-clock time in a zone as a UTC instant (the second pass settles daylight saving changes). */
export function zoned(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const first = guess - offsetMin(tz, guess) * 60_000;
  return guess - offsetMin(tz, first) * 60_000;
}

const validZone = (tz: string | undefined) => {
  if (!tz) return null;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return tz; } catch { return null; }
};

/** A DATE-TIME value as UTC ms, or null for a DATE (all-day) or anything unreadable. */
export function parseTime(value: string, tzid?: string): number | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (z) return Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  return zoned(+y, +mo, +d, +h, +mi, +s, validZone(tzid) ?? DEFAULT_TZ);
}

/** ISO 8601 durations as used by DURATION: P1D, PT1H30M, P1W. */
export function parseDuration(v: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim());
  if (!m) return null;
  const [, sign, w, d, h, mi, s] = m;
  const ms = (((+(w ?? 0) * 7 + +(d ?? 0)) * 24 + +(h ?? 0)) * 60 + +(mi ?? 0)) * 60_000 + +(s ?? 0) * 1000;
  return sign === '-' ? -ms : ms;
}

interface Event { uid: string; start: number; end: number; title: string; tz: string; rrule?: string; exdates: Set<number> }

/** Each start of a daily or weekly repeat inside [from, to), keeping the wall-clock time across DST changes. */
function repeats(e: Event, from: number, to: number): number[] {
  const rule = Object.fromEntries(e.rrule!.split(';').map((p) => p.split('=') as [string, string]).map(([k, v]) => [k.toUpperCase(), v]));
  const freq = rule.FREQ;
  if (freq !== 'DAILY' && freq !== 'WEEKLY') return [e.start];
  const interval = Math.max(1, +(rule.INTERVAL ?? 1) || 1);
  const count = rule.COUNT ? +rule.COUNT : Infinity;
  const until = rule.UNTIL ? (parseTime(rule.UNTIL.length === 8 ? `${rule.UNTIL}T235959` : rule.UNTIL, e.tz) ?? Infinity) : Infinity;
  // The wall-clock date and time of the first start, in the event's zone.
  const wall = new Date(e.start + offsetMin(e.tz, e.start) * 60_000);
  const [h, mi, s] = [wall.getUTCHours(), wall.getUTCMinutes(), wall.getUTCSeconds()];
  const day0 = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate());
  const byday = freq === 'WEEKLY'
    ? (rule.BYDAY ? rule.BYDAY.split(',').map((x) => WEEKDAYS.indexOf(x.slice(-2))).filter((x) => x >= 0) : [wall.getUTCDay()])
    : null;
  const week0 = day0 - wall.getUTCDay() * DAY_MS;
  const out: number[] = [];
  let n = 0;
  for (let day = day0; n < count && day <= day0 + 400 * DAY_MS; day += DAY_MS) {
    const dt = new Date(day);
    const step = freq === 'DAILY' ? Math.round((day - day0) / DAY_MS) : Math.floor(Math.round((day - week0) / DAY_MS) / 7);
    if (step % interval !== 0) continue;
    if (byday && !byday.includes(dt.getUTCDay())) continue;
    const at = zoned(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate(), h, mi, s, e.tz);
    if (at < e.start) continue;
    if (at > until || at >= to) break;
    n++;
    if (!e.exdates.has(at) && at + (e.end - e.start) > from) out.push(at);
  }
  return out;
}

/** Busy times from the feed that touch [from, to). */
export function parseIcs(feed: string, from: Date, to: Date): Busy[] {
  const lo = from.getTime(), hi = to.getTime();
  const events: Event[] = [];
  // Instances moved or cancelled one at a time (RECURRENCE-ID) replace that date of the series.
  const overrides = new Map<string, Set<number>>();
  let cur: Record<string, Prop[]> | null = null;
  let depth = 0;
  for (const line of unfold(feed)) {
    const p = prop(line);
    if (!p) continue;
    if (p.name === 'BEGIN') { if (p.value.toUpperCase() === 'VEVENT' && depth === 0) cur = {}; else if (cur) depth++; continue; }
    if (p.name === 'END') {
      if (depth > 0) { depth--; continue; }
      if (p.value.toUpperCase() !== 'VEVENT' || !cur) continue;
      const ev = cur;
      cur = null;
      const one = (k: string) => ev[k]?.[0];
      const ds = one('DTSTART');
      if (!ds || ds.params.VALUE === 'DATE') continue;
      const tz = validZone(ds.params.TZID) ?? DEFAULT_TZ;
      const start = parseTime(ds.value, ds.params.TZID);
      if (start == null) continue;
      const rid = one('RECURRENCE-ID');
      const uid = one('UID')?.value ?? '';
      if (rid) {
        const at = parseTime(rid.value, rid.params.TZID);
        if (at != null) (overrides.get(uid) ?? overrides.set(uid, new Set()).get(uid)!).add(at);
      }
      if ((one('STATUS')?.value ?? '').toUpperCase() === 'CANCELLED') continue;
      if ((one('TRANSP')?.value ?? '').toUpperCase() === 'TRANSPARENT') continue;
      const de = one('DTEND');
      const dur = one('DURATION');
      const end = de ? parseTime(de.value, de.params.TZID) : dur ? (parseDuration(dur.value) ?? 0) + start : start + 3_600_000;
      if (end == null || end <= start) continue;
      const exdates = new Set<number>();
      for (const x of ev.EXDATE ?? []) for (const v of x.value.split(',')) { const t = parseTime(v, x.params.TZID); if (t != null) exdates.add(t); }
      events.push({ uid, start, end, title: text(one('SUMMARY')?.value ?? ''), tz, rrule: rid ? undefined : one('RRULE')?.value, exdates });
      continue;
    }
    if (cur && depth === 0) (cur[p.name] ??= []).push(p);
  }
  const out: Busy[] = [];
  for (const e of events) {
    const moved = overrides.get(e.uid);
    const starts = e.rrule ? repeats(e, lo, hi).filter((t) => !moved?.has(t)) : [e.start];
    for (const s of starts) {
      const end = s + (e.end - e.start);
      if (end > lo && s < hi) out.push({ starts_at: new Date(s).toISOString(), ends_at: new Date(end).toISOString(), title: e.title });
    }
  }
  return out.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

/** Only public https feeds (webcal is https by another name): no local or private addresses. */
export function feedUrl(raw: string): URL | null {
  let u: URL;
  try { u = new URL(raw.trim().replace(/^webcal:/i, 'https:')); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password) return null;
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || /^[\d.]+$/.test(host) || host.includes(':')) return null;
  return u;
}
