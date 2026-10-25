import { useState } from 'react';

import { errorCopy, loadSessions, scheduleSeries, type ClassType } from '@/lib/api';
import { useData, usePartner } from '@/lib/partner';
import { addDays, austin, monthDay, time, ymd } from '@/lib/time';
import { Button, Chip, ErrorLine, Field, Modal, Row, Segmented, Stepper } from '@/ui/kit';

// Monday first, as dow values (0 = Sunday) the series function takes.
const DAYS = [{ dow: 1, label: 'Mon' }, { dow: 2, label: 'Tue' }, { dow: 3, label: 'Wed' }, { dow: 4, label: 'Thu' }, { dow: 5, label: 'Fri' }, { dow: 6, label: 'Sat' }, { dow: 0, label: 'Sun' }];
const STARTS = Array.from({ length: (21 - 6) * 4 + 1 }, (_, i) => 6 + i / 4);
const dowOf = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();
const and = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const hhmm = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

/** What a series of this template follows, for the sheet and the editor. */
export const rulesLine = (cls: ClassType, capacity: number, packpass: number) => [
  `${packpass} of ${capacity} spots on PackPass`,
  cls.waiver_required ? 'your waiver' : 'no waiver',
  cls.waitlist_auto ? 'waitlist auto-books' : 'waitlist offers the spot',
  cls.min_dogs != null ? `runs with ${cls.min_dogs}+ dogs (checked ${cls.min_cutoff_hours} hours before)` : null,
  `free cancel until ${cls.cancel_hours} hours before`,
].filter(Boolean).join(', ');

/**
 * Schedule series (11a): a template on some weekdays at one time, from a start date for N weeks or to an end date.
 * Every session is written out at once; dates that passed or already have the class at that time are skipped.
 */
export function SeriesSheet({ cls, onClose, onDone }: { cls: ClassType; onClose: () => void; onDone: (toast: string) => void }) {
  const { partner, gym, trainerName } = usePartner();
  const today = ymd(new Date());
  const [days, setDays] = useState<number[]>([]);
  const [start, setStart] = useState(17.5);
  const [first, setFirst] = useState(addDays(today, 1));
  const [ends, setEnds] = useState<'weeks' | 'date'>('weeks');
  const [weeks, setWeeks] = useState(6);
  const [lastPick, setLastPick] = useState(addDays(today, 42));
  const [cap, setCap] = useState(cls.group_size);
  const [pp, setPp] = useState(Math.min(cls.group_size, cls.packpass_spots ?? cls.group_size));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const last = ends === 'weeks' ? addDays(first, weeks * 7 - 1) : lastPick;
  const span = Math.round((Date.parse(last) - Date.parse(first)) / 86_400_000);
  const rangeOk = first >= today && span >= 0 && span <= 182;
  const { data: existing } = useData(() => (rangeOk ? loadSessions(austin(first, 0), austin(addDays(last, 1), 0)) : Promise.resolve([])), [first, last, rangeOk]);
  const taken = new Set((existing ?? []).filter((s) => s.class_id === cls.id).map((s) => new Date(s.starts_at).getTime()));
  const now = new Date();
  const all: Date[] = [];
  if (rangeOk) for (let i = 0; i <= span; i++) { const d = addDays(first, i); if (days.includes(dowOf(d))) all.push(austin(d, start)); }
  const dates = all.filter((d) => d > now && !taken.has(d.getTime()));
  const skipped = all.length - dates.length;
  const dayNames = and(DAYS.filter((d) => days.includes(d.dow)).map((d) => d.label));
  const at = time(austin(first, start));

  const toggle = (dow: number) => setDays((xs) => (xs.includes(dow) ? xs.filter((x) => x !== dow) : [...xs, dow]));
  const go = async () => {
    setBusy(true); setError(null);
    try {
      const r = await scheduleSeries(cls.id, days, hhmm(start), first, last, cap, pp);
      onDone(`${cls.title} scheduled. ${r.sessions} session${r.sessions === 1 ? '' : 's'}, ${dayNames} at ${at}, ${monthDay(dates[0] ?? austin(first, start))} to ${monthDay(dates[dates.length - 1] ?? austin(last, start))}.`);
    } catch (e) { setError(errorCopy(e)); setBusy(false); }
  };

  return (
    <Modal eyebrow="Schedule series" title={cls.title} width={600} onClose={onClose}
      footer={<><ErrorLine>{error}</ErrorLine><Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={busy || dates.length === 0} onClick={go}>{busy ? 'Scheduling…' : dates.length ? `Schedule ${dates.length} session${dates.length === 1 ? '' : 's'}` : 'Schedule'}</Button></>}>
      <Field label="Days">
        <Row gap={6}>{DAYS.map((d) => <Chip key={d.dow} on={days.includes(d.dow)} onClick={() => toggle(d.dow)}>{d.label}</Chip>)}</Row>
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 16 }}>
        <Field label="Start time">
          <select className="field" aria-label="Start time" value={String(start)} onChange={(e) => setStart(Number(e.target.value))}>
            {STARTS.map((h) => <option key={h} value={String(h)}>{time(austin(first, h))}</option>)}
          </select>
        </Field>
        <Field label="First day">
          <input className="field" type="date" aria-label="First day" min={today} value={first} onChange={(e) => e.target.value && setFirst(e.target.value)} />
        </Field>
      </div>
      <Field label="Ends">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <Segmented label="Ends" options={[{ value: 'weeks', label: 'After' }, { value: 'date', label: 'On a date' }]} value={ends} onChange={setEnds} />
          {ends === 'weeks' ? (
            <Row gap={8} style={{ alignItems: 'center' }}>
              <Stepper label="weeks" value={weeks} onDec={() => setWeeks((w) => Math.max(1, w - 1))} onInc={() => setWeeks((w) => Math.min(26, w + 1))} decDisabled={weeks <= 1} incDisabled={weeks >= 26} />
              <span className="pp-label">{weeks === 1 ? 'week' : 'weeks'}</span>
            </Row>
          ) : (
            <input className="field" type="date" aria-label="Last day" min={first} value={lastPick} onChange={(e) => e.target.value && setLastPick(e.target.value)} style={{ maxWidth: 200 }} />
          )}
        </div>
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 16 }}>
        <Field label="Capacity"><Stepper label="spots" value={cap} onDec={() => { const c = Math.max(1, cap - 1); setCap(c); setPp((p) => Math.min(p, c)); }} onInc={() => setCap(Math.min(40, cap + 1))} /></Field>
        <Field label="Open to PackPass"><Stepper label="PackPass spots" value={pp} onDec={() => setPp(Math.max(0, pp - 1))} onInc={() => setPp(Math.min(cap, pp + 1))} /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 16 }}>
        <Field label="Location"><span className="pp-label">{partner.street || partner.address}</span></Field>
        <Field label="Trainer"><span className="pp-label">{gym ? trainerName(cls.trainer_id) : partner.short_name || partner.name}</span></Field>
      </div>

      <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!rangeOk ? <span className="pp-label">Pick a first day from today and an end within 26 weeks.</span>
          : days.length === 0 ? <span className="pp-label pp-muted">Pick the days it runs.</span>
          : dates.length === 0 ? <span className="pp-label">No open dates. Every one has passed or already has this class at that time.</span>
          : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <span className="pp-heading">{`${dates.length} session${dates.length === 1 ? '' : 's'} · ${dayNames} · ${at}`}</span>
                <span className="pp-caption pp-muted">{`${monthDay(dates[0])} to ${monthDay(dates[dates.length - 1])}`}</span>
              </div>
              <Row gap={6}>
                {dates.slice(0, 8).map((d) => <span key={d.getTime()} className="pp-badge pp-badge-neutral">{monthDay(d)}</span>)}
                {dates.length > 8 ? <span className="pp-badge pp-badge-neutral">{`+${dates.length - 8} more`}</span> : null}
              </Row>
              {skipped ? <span className="pp-caption pp-muted">{`${skipped} date${skipped === 1 ? '' : 's'} skipped: already passed or already on the schedule at that time.`}</span> : null}
            </>
          )}
      </div>
      <span className="pp-caption pp-muted" style={{ textWrap: 'pretty' }}>{`Each session uses this template's rules: ${rulesLine(cls, cap, pp)}. Edit or cancel any single session later from the schedule.`}</span>
    </Modal>
  );
}
