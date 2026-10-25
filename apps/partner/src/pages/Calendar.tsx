import { CalendarDays, Rss, Trash2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';

import { addCalendarFeed, errorCopy, loadCalendar, readFeed, removeCalendarFeed, setHideWhenBusy, type CalendarFeed } from '@/lib/api';
import { useData, usePartner } from '@/lib/partner';
import { monthDay, time } from '@/lib/time';
import { Badge, Button, ErrorLine, Field, Ico, IconButton, Page, Row, Toggle } from '@/ui/kit';
import { Loading } from './Overview';

/** "4 min ago", "just now", or the day and time past a day. */
export const ago = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} hr ago`;
  return `${monthDay(new Date(iso))}, ${time(new Date(iso))}`;
};

/**
 * Settings › Calendar sync (P6c, 14a, 14b): the calendars PackPass reads busy times from, and whether those times
 * close PackPass spots. iCal feeds for now (Gingr, Clicks!, Acuity, or any calendar's secret .ics address); Google's
 * two-way sync comes next.
 */
export function Calendar() {
  const { data, reload } = useData(loadCalendar, []);
  if (!data) return <Loading />;
  const feeds = data.filter((f): f is CalendarFeed & { id: string } => !!f.id);
  const broken = feeds.filter((f) => f.status === 'error');
  return (
    <Page gap={24}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 760 }}>
        <h1 className="pp-page-title">Calendar sync</h1>
        <span className="pp-caption pp-muted" style={{ textWrap: 'pretty' }}>Keep PackPass and the calendar you already book clients in from double-booking each other.</span>
      </header>
      {broken.map((f) => <Broken key={f.id} f={f} onRead={reload} />)}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 760 }}>
        {feeds.length ? (
          <div className="tbl">
            {feeds.map((f) => <FeedRow key={f.id} f={f} onChange={reload} />)}
          </div>
        ) : null}
        <HideToggle on={data[0]?.hide_when_busy ?? true} hidden={data[0]?.hidden_sessions ?? 0} onChange={reload} />
        <AddFeed first={!feeds.length} onAdded={reload} />
      </div>
    </Page>
  );
}

function Broken({ f, onRead }: { f: CalendarFeed & { id: string }; onRead: () => void }) {
  const [busy, setBusy] = useState(false);
  const retry = async () => {
    setBusy(true);
    try { await readFeed(f.id); } catch { /* the row shows what the read stored */ } finally { setBusy(false); onRead(); }
  };
  return (
    <div role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderRadius: 12, background: 'var(--kennel-red-soft)', maxWidth: 760, boxSizing: 'border-box' }}>
      <span style={{ color: 'var(--kennel-red)', paddingTop: 2 }}><Ico icon={TriangleAlert} /></span>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="pp-label" style={{ fontWeight: 600 }}>{`${f.name} stopped sharing your busy times${f.last_read_at ? ` on ${monthDay(new Date(f.last_read_at))}` : ''}.`}</span>
        <span className="pp-caption" style={{ textWrap: 'pretty' }}>{`${f.error ?? ''} PackPass keeps the busy times it last read${f.busy_count ? ` (${f.busy_count})` : ''} until it can read the feed again.`.trim()}</span>
      </div>
      <Button size="sm" variant="outline" disabled={busy} onClick={retry}>{busy ? 'Reading…' : 'Try again'}</Button>
    </div>
  );
}

function FeedRow({ f, onChange }: { f: CalendarFeed & { id: string }; onChange: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    try { await removeCalendarFeed(f.id); onChange(); } catch (e) { setError(errorCopy(e)); }
  };
  const meta = [f.trainer_name ?? null, f.host, 'busy times only', f.last_read_at ? `read every 15 min · last read ${ago(f.last_read_at)}` : 'reading now'].filter(Boolean).join(' · ');
  return (
    <div className="tbl-row" style={{ gridTemplateColumns: '28px minmax(0,1fr) auto auto', minHeight: 56, alignItems: 'center' }}>
      <Ico icon={Rss} />
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span className="pp-heading ellipsis">{f.name}</span>
        <span className="pp-caption pp-muted" style={{ textWrap: 'pretty' }}>{meta}</span>
        <ErrorLine>{error}</ErrorLine>
      </div>
      {f.status === 'error' ? <Badge tone="warning" icon={TriangleAlert}>Error</Badge> : f.status === 'ok' ? <Badge tone="cleared" dot>Connected</Badge> : <Badge>Reading</Badge>}
      {confirm ? (
        <Row gap={6} wrap={false}>
          <Button size="sm" variant="danger" onClick={remove}>Remove</Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Keep</Button>
        </Row>
      ) : <IconButton icon={Trash2} label={`Remove ${f.name}`} onClick={() => setConfirm(true)} />}
    </div>
  );
}

function HideToggle({ on, hidden, onChange }: { on: boolean; hidden: number; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = async (v: boolean) => {
    setBusy(true); setError(null);
    try { await setHideWhenBusy(v); onChange(); } catch (e) { setError(errorCopy(e)); } finally { setBusy(false); }
  };
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '14px 0', boxShadow: 'inset 0 1px 0 var(--line), inset 0 -1px 0 var(--line)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span className="pp-label" style={{ fontWeight: 600 }}>Hide PackPass spots when you're busy</span>
        <span className="pp-caption pp-muted" style={{ textWrap: 'pretty' }}>
          {`Busy times from your calendars close PackPass spots at those times. Dogs already booked keep their spots, and direct clients aren't affected.${on && hidden ? ` ${hidden === 1 ? '1 session is' : `${hidden} sessions are`} closed right now.` : ''}`}
        </span>
        <ErrorLine>{error}</ErrorLine>
      </div>
      <Toggle on={on} disabled={busy} onChange={set} label="Hide PackPass spots when you're busy" />
    </div>
  );
}

function AddFeed({ first, onAdded }: { first: boolean; onAdded: () => void }) {
  const { trainers, gym } = usePartner();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [who, setWho] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const add = async () => {
    setBusy(true); setError(null); setResult(null);
    try {
      const id = await addCalendarFeed(name.trim(), url.trim(), who || null);
      setName(''); setUrl('');
      let readError: string | null;
      try { readError = await readFeed(id); } catch (e) { readError = errorCopy(e); }
      const rows = await loadCalendar();
      const f = rows.find((x) => x.id === id);
      setResult(readError ? readError
        : `Found ${f?.busy_count === 1 ? '1 busy time' : `${f?.busy_count ?? 0} busy times`} in the next two weeks.${f?.hide_when_busy ? ' PackPass spots are hidden at those times.' : ''}`);
      onAdded();
    } catch (e) {
      setError((e as Error).message === 'too_many' ? 'Connect up to 10 feeds.' : errorCopy(e));
    } finally { setBusy(false); }
  };
  return (
    <section className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <Ico icon={CalendarDays} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span className="pp-label" style={{ fontWeight: 600 }}>{first ? 'Connect your calendar' : 'Add another calendar'}</span>
          <span className="pp-caption pp-muted" style={{ textWrap: 'pretty' }}>Use Gingr, Clicks! or Acuity? Paste its iCal feed. Google and Apple calendars have one too, under the calendar's settings (the secret address in iCal format). PackPass reads busy times every 15 minutes and never writes to it.</span>
        </div>
      </div>
      <Row gap={12} wrap>
        <div style={{ flex: '1 1 180px', minWidth: 0 }}>
          <Field label="Name"><input className="field" aria-label="Name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Gingr" /></Field>
        </div>
        {gym ? (
          <div style={{ flex: '1 1 180px', minWidth: 0 }}>
            <Field label="Whose calendar">
              <select className="field" aria-label="Whose calendar" value={who} onChange={(e) => setWho(e.target.value)}>
                <option value="">Everyone here</option>
                {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
          </div>
        ) : null}
      </Row>
      <Field label="iCal feed URL" note="Busy times only. PackPass keeps the address private.">
        <input className="field" aria-label="iCal feed URL" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… .ics" inputMode="url" />
      </Field>
      {gym && who === '' ? <span className="pp-caption pp-muted">Busy times close every class here. Pick a trainer to close only their classes.</span> : null}
      <Row gap={10}>
        <Button disabled={busy || !name.trim() || !url.trim()} onClick={add}>{busy ? 'Reading the feed…' : 'Add feed'}</Button>
        <ErrorLine>{error}</ErrorLine>
      </Row>
      {result ? <span className="pp-label" role="status" style={{ textWrap: 'pretty' }}>{result}</span> : null}
    </section>
  );
}
