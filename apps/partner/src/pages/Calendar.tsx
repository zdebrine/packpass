import { CalendarDays, CalendarSync, Rss, Trash2, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  addCalendarFeed, connectGoogle, disconnectGoogle, errorCopy, googleReady, isGoogle, loadCalendar, readFeed, removeCalendarFeed, setHideWhenBusy,
  type CalendarFeed,
} from '@/lib/api';
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
 * close PackPass spots: iCal feeds (Gingr, Clicks!, Acuity, or any calendar's secret .ics address), and Google Calendar
 * two-way, which also gets PackPass bookings written to it. Google sign-in comes back here with ?google=<result>.
 */
export function Calendar() {
  const { data, reload } = useData(loadCalendar, []);
  const { data: google } = useData(googleReady, []);
  const [params, setParams] = useSearchParams();
  const [signIn] = useState(() => params.get('google'));
  useEffect(() => { if (params.has('google')) setParams({}, { replace: true }); }, [params, setParams]);
  if (!data) return <Loading />;
  const feeds = data.filter((f): f is CalendarFeed & { id: string } => !!f.id);
  const broken = feeds.filter((f) => f.status === 'error');
  return (
    <Page gap={24}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 760 }}>
        <h1 className="pp-page-title">Calendar sync</h1>
        <span className="pp-caption pp-muted" style={{ textWrap: 'pretty' }}>Keep PackPass and the calendar you already book clients in from double-booking each other.</span>
      </header>
      {signIn ? <SignInResult result={signIn} /> : null}
      {broken.map((f) => <Broken key={f.id} f={f} onRead={reload} />)}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 760 }}>
        {feeds.length ? (
          <div className="tbl">
            {feeds.map((f) => <FeedRow key={f.id} f={f} onChange={reload} />)}
          </div>
        ) : null}
        <HideToggle on={data[0]?.hide_when_busy ?? true} hidden={data[0]?.hidden_sessions ?? 0} onChange={reload} />
        {google ? <ConnectGoogle first={!feeds.length} /> : null}
        <AddFeed first={!feeds.length && !google} google={!!google} onAdded={reload} />
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
        <span className="pp-caption" style={{ textWrap: 'pretty' }}>{`${f.error ?? ''} PackPass keeps the busy times it last read${f.busy_count ? ` (${f.busy_count})` : ''} until it can read ${isGoogle(f) ? 'the calendar' : 'the feed'} again.`.trim()}</span>
      </div>
      <Button size="sm" variant="outline" disabled={busy} onClick={retry}>{busy ? 'Reading…' : 'Try again'}</Button>
    </div>
  );
}

function FeedRow({ f, onChange }: { f: CalendarFeed & { id: string }; onChange: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const google = isGoogle(f);
  const remove = async () => {
    setBusy(true); setError(null);
    try { await (google ? disconnectGoogle(f.id) : removeCalendarFeed(f.id)); onChange(); } catch (e) { setError(errorCopy(e)); } finally { setBusy(false); }
  };
  const meta = [
    f.trainer_name ?? null, google ? 'busy times and PackPass bookings' : `${f.host} · busy times only`,
    f.last_read_at ? `synced every 15 min · last synced ${ago(f.last_read_at)}` : 'syncing now',
  ].filter(Boolean).join(' · ');
  return (
    <div className="tbl-row" style={{ gridTemplateColumns: '28px minmax(0,1fr) auto auto', minHeight: 56, alignItems: 'center' }}>
      <Ico icon={google ? CalendarSync : Rss} />
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span className="pp-heading ellipsis">{f.name}</span>
        <span className="pp-caption pp-muted" style={{ textWrap: 'pretty' }}>{meta}</span>
        <ErrorLine>{error}</ErrorLine>
      </div>
      {f.status === 'error' ? <Badge tone="warning" icon={TriangleAlert}>Error</Badge> : f.status === 'ok' ? <Badge tone="cleared" dot>Connected</Badge> : <Badge>Syncing</Badge>}
      {confirm ? (
        <Row gap={6} wrap={false}>
          <Button size="sm" variant="danger" disabled={busy} onClick={remove}>{google ? (busy ? 'Disconnecting…' : 'Disconnect') : 'Remove'}</Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Keep</Button>
        </Row>
      ) : <IconButton icon={Trash2} label={`${google ? 'Disconnect' : 'Remove'} ${f.name}`} onClick={() => setConfirm(true)} />}
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

function AddFeed({ first, google, onAdded }: { first: boolean; google: boolean; onAdded: () => void }) {
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
          <span className="pp-label" style={{ fontWeight: 600 }}>{first ? 'Connect your calendar' : google ? 'Add an iCal feed' : 'Add another calendar'}</span>
          <span className="pp-caption pp-muted" style={{ textWrap: 'pretty' }}>{`Use Gingr, Clicks! or Acuity? Paste its iCal feed. ${google ? 'Apple calendars have' : 'Google and Apple calendars have'} one too, under the calendar's settings (the secret address in iCal format). PackPass reads busy times every 15 minutes and never writes to it.`}</span>
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

const SIGN_IN: Record<string, string> = {
  connected: 'Google Calendar is connected. Every 15 minutes PackPass reads your busy times and adds PackPass bookings to it, with the dogs\' names and a roster link.',
  cancelled: 'Google sign-in was cancelled. Nothing was connected.',
  no_calendar: 'PackPass needs to see and edit your calendar events. Connect again and leave that permission ticked.',
  expired: 'That sign-in took too long. Connect Google Calendar again.',
  too_many: 'Connect up to 10 calendars.',
  no_refresh_token: 'Google didn\'t give PackPass lasting access. Remove PackPass under Third-party access in your Google account, then connect again.',
  not_ready: 'Google Calendar isn\'t set up on PackPass yet. Paste an iCal feed for now.',
};

function SignInResult({ result }: { result: string }) {
  const ok = result === 'connected';
  return (
    <div role={ok ? 'status' : 'alert'} style={{ padding: '12px 16px', borderRadius: 12, maxWidth: 760, boxSizing: 'border-box', background: ok ? 'var(--surface-raised)' : 'var(--kennel-red-soft)' }}>
      <span className="pp-label" style={{ textWrap: 'pretty' }}>{SIGN_IN[result] ?? 'Google Calendar couldn\'t be connected. Try again.'}</span>
    </div>
  );
}

/** Google Calendar, two-way: sign in with Google for the whole place or one trainer. */
function ConnectGoogle({ first }: { first: boolean }) {
  const { trainers, gym } = usePartner();
  const [who, setWho] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setError(null);
    try { await connectGoogle(who || null); } catch (e) { setError(errorCopy(e)); setBusy(false); }
  };
  return (
    <section className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <Ico icon={CalendarSync} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span className="pp-label" style={{ fontWeight: 600 }}>{first ? 'Connect your calendar' : 'Connect Google Calendar'}</span>
          <span className="pp-caption pp-muted" style={{ textWrap: 'pretty' }}>Book clients in Google Calendar? Sign in with Google. PackPass reads your busy times and adds PackPass bookings to your calendar with the dogs' names and a roster link.</span>
        </div>
      </div>
      {gym ? (
        <div style={{ maxWidth: 320 }}>
          <Field label="Whose calendar" note={who === '' ? 'Busy times close every class here, and every class\'s bookings are added.' : 'Only this trainer\'s classes.'}>
            <select className="field" aria-label="Whose Google calendar" value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="">Everyone here</option>
              {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
        </div>
      ) : null}
      <Row gap={10}>
        <Button icon={CalendarSync} disabled={busy} onClick={go}>{busy ? 'Opening Google…' : 'Connect Google Calendar'}</Button>
        <ErrorLine>{error}</ErrorLine>
      </Row>
    </section>
  );
}
