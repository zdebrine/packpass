import { AlertCircle, CalendarX, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { addSession, blockDates, cancelSession, errorCopy, loadSessions, updateSession } from '@/lib/api';
import { useData, usePartner } from '@/lib/partner';
import { credits, startHour, withClasses, type SessionView } from '@/lib/sessions';
import { db, check } from '@/lib/supabase';
import { addDays, austin, dayIndex, mondayOf, monthDay, shortTime, time, ymd } from '@/lib/time';
import { Badge, Button, Chip, ErrorLine, Field, Ico, IconButton, Modal, Page, PageHead, Row, Segmented, Stepper, Toggle } from '@/ui/kit';
import { Loading } from './Overview';

const HOUR_PX = 48;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** 02 Schedule and capacity: the week grid, a side panel for the picked session, Block dates, Add session. */
export function Schedule() {
  const { classById, classes, partner, gym, trainerName } = usePartner();
  const [params, setParams] = useSearchParams();
  const [week, setWeek] = useState(() => mondayOf(new Date()));
  const [modal, setModal] = useState<null | 'block' | 'add'>(() => (params.get('add') ? 'add' : null));
  const { data, reload } = useData(async () => {
    const [sessions, slots] = await Promise.all([
      loadSessions(austin(week, 0), austin(addDays(week, 7), 0)),
      db.from('timetable').select('class_id, weekday, starts').in('class_id', classes.map((c) => c.id)).then(check),
    ]);
    return { sessions: withClasses(sessions, classById), slots: slots as { class_id: string; weekday: number | null; starts: string }[] };
  }, [week]);

  const sessions = useMemo(() => data?.sessions ?? [], [data]);
  const selId = params.get('s');
  const sel = sessions.find((s) => s.id === selId) ?? sessions.find((s) => !s.cancelled_at && s.end > new Date()) ?? sessions[0];
  // Jump to the week of a session opened from elsewhere (e.g. Overview's "Adjust capacity").
  useEffect(() => {
    if (!selId || sessions.some((s) => s.id === selId)) return;
    db.from('sessions').select('starts_at').eq('id', selId).maybeSingle().then(({ data: s }) => s && setWeek(mondayOf(new Date(s.starts_at))));
  }, [selId, sessions]);

  if (!data) return <Loading />;
  const live = sessions.filter((s) => !s.cancelled_at);
  const lo = Math.min(7, ...sessions.map((s) => Math.floor(startHour(s))));
  const hi = Math.max(20, ...sessions.map((s) => Math.ceil(startHour(s) + s.cls.duration_min / 60)));
  const hours = Array.from({ length: hi - lo }, (_, i) => lo + i);
  const today = ymd(new Date());
  const repeats = (s: SessionView) => {
    const local = new Date(s.start);
    const t = time(local);
    const dow = (dayIndex(local) + 1) % 7;
    return data.slots.some((x) => x.class_id === s.class_id && (x.weekday === null || x.weekday === dow) && toLabel(x.starts) === t);
  };

  const range = `${monthDay(austin(week, 12))} – ${monthDay(austin(addDays(week, 6), 12))}`;
  return (
    <Page gap={20}>
      <PageHead title="Schedule" sub={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IconButton icon={ChevronLeft} label="Previous week" variant="ghost" onClick={() => setWeek(addDays(week, -7))} style={{ width: 24, height: 24 }} />
          <IconButton icon={ChevronRight} label="Next week" variant="ghost" onClick={() => setWeek(addDays(week, 7))} style={{ width: 24, height: 24 }} />
          {`${range} · ${live.reduce((a, s) => a + s.booked, 0)} of ${live.reduce((a, s) => a + s.packpass_spots, 0)} PackPass spots booked`}
        </span>}>
        <Button variant="outline" icon={CalendarX} onClick={() => setModal('block')}>Block dates</Button>
        <Button icon={Plus} onClick={() => setModal('add')}>Add session</Button>
      </PageHead>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 24, alignItems: 'start' }}>
        <div style={{ borderRadius: 16, boxShadow: 'inset 0 0 0 1px var(--line)', overflowX: 'auto', minWidth: 0 }}>
          <div style={{ minWidth: 720, display: 'grid', gridTemplateColumns: '52px repeat(7,minmax(0,1fr))' }}>
            <div style={{ boxShadow: 'inset 0 -1px 0 var(--line)' }} />
            {DAYS.map((d, i) => {
              const date = addDays(week, i);
              const blocked = sessions.some((s) => ymd(s.start) === date && s.cancelled_at) && !live.some((s) => ymd(s.start) === date);
              return (
                <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 8px', boxShadow: 'inset 0 -1px 0 var(--line),inset 1px 0 0 var(--line)', minWidth: 0 }}>
                  <span className="pp-label">{d}</span>
                  <span className="pp-label pp-muted pp-num">{Number(date.slice(8))}</span>
                  {date === today ? <span style={{ width: 6, height: 6, flex: 'none', borderRadius: 9999, background: 'var(--agility)' }} /> : null}
                  {blocked ? <span style={{ marginLeft: 'auto' }}><Badge tone="warning">Blocked</Badge></span> : null}
                </div>
              );
            })}
            <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 2 }}>
              {hours.map((h) => <span key={h} className="pp-caption pp-muted" style={{ height: HOUR_PX, padding: '0 8px', textAlign: 'right', boxSizing: 'border-box' }}>{`${h % 12 || 12} ${h >= 12 ? 'pm' : 'am'}`}</span>)}
            </div>
            {DAYS.map((d, i) => (
              <div key={d} style={{ position: 'relative', height: hours.length * HOUR_PX, boxShadow: 'inset 1px 0 0 var(--line)', background: `repeating-linear-gradient(180deg,transparent 0 ${HOUR_PX - 1}px,var(--line) ${HOUR_PX - 1}px ${HOUR_PX}px)` }}>
                {lanes(sessions.filter((s) => ymd(s.start) === addDays(week, i))).map(({ s, lane }) => {
                  const on = s.id === sel?.id, cx = !!s.cancelled_at;
                  return (
                    <button key={s.id} onClick={() => setParams({ s: s.id })} aria-pressed={on}
                      style={{ position: 'absolute', left: 3 + lane * 16, right: 3, top: (startHour(s) - lo) * HOUR_PX + 2, height: Math.max(30, (s.cls.duration_min / 60) * HOUR_PX - 4), boxSizing: 'border-box', padding: '3px 7px', border: 0, borderRadius: 8,
                        background: on ? 'var(--inverse)' : cx ? 'repeating-linear-gradient(135deg,var(--surface-sunken) 0 6px,var(--surface) 6px 12px)' : 'var(--surface-raised)',
                        color: on ? 'var(--on-inverse)' : cx ? 'var(--ink-muted)' : 'var(--ink)', textDecoration: cx ? 'line-through' : 'none', font: 'inherit',
                        display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start', textAlign: 'left', cursor: 'pointer', overflow: 'hidden', zIndex: on ? 10 : lane + 1, boxShadow: lane ? '0 0 0 2px var(--surface)' : 'none' }}>
                      {s.cls.duration_min < 60 ? (
                        // Too short for two lines: time and title on one.
                        <span style={{ maxWidth: '100%', fontSize: 11, lineHeight: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><b style={{ fontWeight: 500 }}>{shortTime(s.start)}</b>{` ${s.cls.title}`}</span>
                      ) : (
                        <>
                          <span style={{ maxWidth: '100%', fontSize: 12, fontWeight: 500, lineHeight: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.cls.title}</span>
                          <span className="pp-num" style={{ maxWidth: '100%', fontSize: 11, lineHeight: '14px', opacity: 0.72, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{`${shortTime(s.start)} · ${s.spots_left <= 0 ? 'Full' : `${s.booked}/${s.packpass_spots}`}`}</span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        {sel ? <SessionPanel key={sel.id + sel.packpass_spots + sel.capacity} s={sel} repeats={repeats(sel)} gym={gym} trainer={trainerName(sel.cls.trainer_id)} location={partner.name} onSaved={reload} /> : <span />}
      </div>
      {modal === 'block' ? <BlockDates onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); }} /> : null}
      {modal === 'add' ? <AddSession week={week} classes={classes.filter((c) => c.status === 'live')} sessions={sessions} onClose={() => { setModal(null); if (params.get('add')) setParams({}); }}
        onDone={(id, date) => { setModal(null); setWeek(mondayOf(date)); setParams({ s: id }); reload(); }} /> : null}
    </Page>
  );
}

/** Which indent each session gets: overlapping sessions cascade so every title stays readable. */
function lanes(day: SessionView[]) {
  const sorted = [...day].sort((a, b) => +a.start - +b.start);
  const out: { s: SessionView; lane: number; of: number }[] = [];
  let cluster: typeof out = [], ends: number[] = [], clusterEnd = 0;
  const close = () => { for (const x of cluster) x.of = ends.length; cluster = []; ends = []; };
  for (const s of sorted) {
    if (+s.start >= clusterEnd) close();
    let lane = ends.findIndex((e) => e <= +s.start);
    if (lane === -1) { lane = ends.length; ends.push(0); }
    ends[lane] = +s.end;
    clusterEnd = Math.max(clusterEnd, +s.end);
    const item = { s, lane, of: 1 };
    cluster.push(item); out.push(item);
  }
  close();
  return out;
}

const toLabel = (hhmmss: string) => { const [h, m] = hhmmss.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`; };

/** The side panel: capacity, PackPass spots, waitlist switches, weekly repeat, cancel. */
function SessionPanel({ s, repeats, gym, trainer, location, onSaved }: { s: SessionView; repeats: boolean; gym: boolean; trainer: string; location: string; onSaved: () => void }) {
  const taken = s.packpass_spots - s.spots_left;
  const [cap, setCap] = useState(s.capacity);
  const [pp, setPp] = useState(s.packpass_spots);
  const [wl, setWl] = useState(s.waitlist_open);
  const [promote, setPromote] = useState(s.auto_promote);
  const [rep, setRep] = useState(repeats);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const past = s.start <= new Date();
  const dirty = cap !== s.capacity || pp !== s.packpass_spots || wl !== s.waitlist_open || promote !== s.auto_promote || rep !== repeats;

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      if (cap !== s.capacity || pp !== s.packpass_spots || wl !== s.waitlist_open || promote !== s.auto_promote) await updateSession(s.id, cap, pp, wl, promote);
      if (rep !== repeats) check(await db.rpc('partner_set_repeat', { p_session: s.id, p_repeat: rep }));
      onSaved();
    } catch (e) { setMsg(errorCopy(e)); } finally { setBusy(false); }
  };
  const cancel = async () => {
    setBusy(true); setMsg(null);
    try { await cancelSession(s.id, 'Cancelled by the partner', ''); onSaved(); } catch (e) { setMsg(errorCopy(e)); } finally { setBusy(false); }
  };

  return (
    <aside className="card" style={{ position: 'sticky', top: 24, padding: 20, display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="pp-caption pp-muted">{`${DAYS[dayIndex(s.start)]} ${Number(ymd(s.start).slice(8))} · ${time(s.start)} · ${s.cls.duration_min} min`}</span>
        <h2 className="pp-title">{s.cls.title}</h2>
        <span className="pp-caption pp-muted">{s.cancelled_at ? `Cancelled · ${s.cancel_reason}` : `${s.booked} booked${s.waiting ? ` · ${s.waiting} on waitlist` : ''}${s.cls.premium ? ' · Premium class' : ''}`}</span>
      </div>
      {s.cancelled_at ? <span className="pp-label pp-muted">Members were refunded and told. This session no longer shows on Book.</span> : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="pp-label">Capacity</span>
            <Row gap={12} wrap={false}><Stepper label="spots" value={cap} onDec={() => setCap(Math.max(pp, cap - 1))} onInc={() => setCap(Math.min(40, cap + 1))} decDisabled={cap <= pp} /><span className="pp-caption pp-muted">{`${s.booked} booked`}</span></Row>
            <span className="pp-caption pp-muted" style={{ textWrap: 'pretty' }}>{cap <= pp ? 'Every spot is open to PackPass.' : `${cap - pp} kept for your direct clients.`}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="pp-label">Spots open to PackPass</span>
            <Row gap={12} wrap={false}><Stepper label="PackPass spots" value={pp} onDec={() => setPp(Math.max(taken, pp - 1))} onInc={() => setPp(Math.min(cap, pp + 1))} decDisabled={pp <= taken} incDisabled={pp >= cap} /><span className="pp-caption pp-muted">of {cap}</span></Row>
            <span className="pp-caption pp-muted" style={{ textWrap: 'pretty' }}>{pp <= taken ? `Can't go below ${taken}: that many are booked or held. Cancel from the roster first.` : `${taken} of ${pp} taken by PackPass members.`}</span>
          </div>
        </>
      )}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {s.cancelled_at ? null : (
          <>
            <ToggleRow label="Waitlist" sub="Open when the session is full" on={wl} set={setWl} />
            <ToggleRow label="Auto-promote" sub="Book the next dog in line when a spot opens, until 12 hours before" on={promote} set={setPromote} />
            <ToggleRow label="Repeats weekly" sub={`Every ${FULL_DAYS[dayIndex(s.start)]} at ${time(s.start)}`} on={rep} set={setRep} />
          </>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, boxShadow: 'inset 0 1px 0 var(--line)' }}>
          {gym && trainer ? <KV k="Trainer" v={trainer} /> : null}
          <KV k="Location" v={location} />
          <KV k="Credit cost" v={credits(s.cls.credits)} />
          <span className="pp-caption pp-muted">Credit cost is set by PackPass.</span>
        </div>
      </div>
      <ErrorLine>{msg}</ErrorLine>
      {s.cancelled_at || past ? null : confirmCancel ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="pp-label">{s.booked ? `Cancel and refund ${s.booked} dog${s.booked > 1 ? 's' : ''}? Their owners are told.` : 'Cancel this session? Nobody is booked yet.'}</span>
          <Button block variant="danger" disabled={busy} onClick={cancel}>{busy ? 'Cancelling…' : 'Yes, cancel it'}</Button>
          <Button block variant="ghost" onClick={() => setConfirmCancel(false)}>Keep it</Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Button block disabled={!dirty || busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</Button>
          <Button block variant="ghost" onClick={() => setConfirmCancel(true)}>Cancel this session</Button>
        </div>
      )}
    </aside>
  );
}

const KV = ({ k, v }: { k: string; v: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span className="pp-caption pp-muted">{k}</span><span className="pp-label" style={{ textAlign: 'right' }}>{v}</span></div>
);
function ToggleRow({ label, sub, on, set }: { label: string; sub: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', boxShadow: 'inset 0 1px 0 var(--line)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}><span className="pp-label">{label}</span><span className="pp-caption pp-muted">{sub}</span></div>
      <Toggle on={on} onChange={set} label={label} />
    </div>
  );
}

/** Block dates: a month calendar to pick a range, a reason, and a message to booked members. */
function BlockDates({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const today = ymd(new Date());
  const [month, setMonth] = useState(today.slice(0, 7));
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [reason, setReason] = useState('Weather');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = to ?? from;
  // The sessions in the picked range, to show what blocking it affects.
  const { data: range } = useData(async () => (from && end ? loadSessions(austin(from, 0), austin(addDays(end, 1), 0)) : []), [from, end]);
  const affected = (range ?? []).filter((s) => !s.cancelled_at && new Date(s.starts_at) > new Date());
  const dogs = affected.reduce((a, s) => a + s.booked, 0);
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  const pick = (d: string) => {
    if (d < today) return;
    if (!from || (from && to)) { setFrom(d); setTo(null); } else if (d < from) { setFrom(d); } else setTo(d);
  };
  const label = from ? (end === from ? monthDay(austin(from, 12)) : `${monthDay(austin(from, 12))} – ${monthDay(austin(end!, 12))}`) : 'Pick dates';
  const shift = (n: number) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); setMonth(d.toISOString().slice(0, 7)); };
  const confirm = async () => {
    if (!from) return;
    setBusy(true); setError(null);
    try { await blockDates(from, end!, reason, message); onDone(); } catch (e) { setError(errorCopy(e)); setBusy(false); }
  };

  return (
    <Modal eyebrow="Schedule · Block dates" title={label} onClose={onClose} width={640}
      footer={<><ErrorLine>{error}</ErrorLine><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!from || busy} onClick={confirm}>{busy ? 'Blocking…' : from ? `Block ${label}` : 'Block dates'}</Button></>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 24 }}>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span className="pp-label">{new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first)}</span>
            <Row gap={2} wrap={false}><IconButton icon={ChevronLeft} label="Previous month" variant="ghost" onClick={() => shift(-1)} /><IconButton icon={ChevronRight} label="Next month" variant="ghost" onClick={() => shift(1)} /></Row>
          </div>
          <span className="pp-caption pp-muted">{!from || to ? 'Pick the first day' : 'Pick the last day, or the same day again'}</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 2 }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((w, i) => <span key={i} className="pp-caption pp-muted" style={{ textAlign: 'center', paddingBottom: 4 }}>{w}</span>)}
            {cells.map((d, i) => {
              if (!d) return <span key={i} />;
              const isEnd = d === from || d === end, mid = !!from && !!end && d > from && d < end, gone = d < today;
              return <button key={d} onClick={() => pick(d)} disabled={gone}
                style={{ height: 36, border: 0, borderRadius: 8, cursor: gone ? 'default' : 'pointer', font: 'inherit', fontSize: 13, fontWeight: isEnd ? 600 : 400, fontVariantNumeric: 'tabular-nums', opacity: gone ? 0.35 : 1,
                  background: isEnd ? 'var(--inverse)' : mid ? 'var(--surface-raised)' : 'transparent', color: isEnd ? 'var(--on-inverse)' : 'var(--ink)' }}>{Number(d.slice(8))}</button>;
            })}
          </div>
        </div>
        <Field label="Reason">
          <Row gap={6}>{['Holiday', 'Weather', 'Maintenance', 'Private event', 'Trainer away'].map((r) => <Chip key={r} on={reason === r} onClick={() => setReason(r)}>{r}</Chip>)}</Row>
        </Field>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '12px 0', boxShadow: 'inset 0 1px 0 var(--line),inset 0 -1px 0 var(--line)' }}>
        <span className="pp-label">{!from ? 'Pick the dates to block' : affected.length ? `${affected.length} session${affected.length > 1 ? 's' : ''} · ${dogs} dog${dogs === 1 ? '' : 's'} booked` : 'No sessions affected'}</span>
        <span className="pp-caption pp-muted" style={{ textWrap: 'pretty' }}>Booked members get their credits back and the message below. Blocked sessions stop showing on Book.</span>
      </div>
      <Field label="Message to booked members" note="Optional">
        <textarea className="area" value={message} onChange={(e) => setMessage(e.target.value)} style={{ minHeight: 84 }} />
      </Field>
    </Modal>
  );
}

/** Add session: class, day, start, capacity, PackPass spots, weekly repeat. Warns about clashes. */
function AddSession({ week, classes, sessions, onClose, onDone }: { week: string; classes: SessionView['cls'][]; sessions: SessionView[]; onClose: () => void; onDone: (id: string, date: Date) => void }) {
  const [clsId, setClsId] = useState(classes[0]?.id ?? '');
  const cls = classes.find((c) => c.id === clsId);
  const todayIdx = Math.max(0, DAYS.findIndex((_, i) => addDays(week, i) >= ymd(new Date())));
  const [day, setDay] = useState(todayIdx);
  const [start, setStart] = useState(9);
  const [cap, setCap] = useState<number | null>(null);
  const [pp, setPp] = useState<number | null>(null);
  const [repeat, setRepeat] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!cls) return <Modal eyebrow="Schedule · New session" title="No live classes" onClose={onClose}><span className="pp-label pp-muted">Classes can be scheduled once PackPass has set their credits.</span></Modal>;
  const capacity = cap ?? cls.group_size, open = Math.min(capacity, pp ?? capacity);
  const date = addDays(week, day);
  const startsAt = austin(date, start);
  const endsAt = new Date(startsAt.getTime() + cls.duration_min * 60_000);
  const clash = sessions.find((s) => !s.cancelled_at && s.start < endsAt && startsAt < s.end && (s.cls.trainer_id === cls.trainer_id));
  const fmt = (h: number) => time(austin(date, h));
  const starts = Array.from({ length: (21 - 6) * 4 + 1 }, (_, i) => 6 + i / 4);
  const add = async () => {
    setBusy(true); setError(null);
    try { onDone(await addSession(cls.id, startsAt, capacity, open, repeat), startsAt); } catch (e) { setError(errorCopy(e)); setBusy(false); }
  };
  return (
    <Modal eyebrow="Schedule · New session" title={cls.title} onClose={onClose} width={560}
      footer={<><ErrorLine>{error}</ErrorLine><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy || startsAt <= new Date()} onClick={add}>{busy ? 'Adding…' : 'Add session'}</Button></>}>
      <Field label="Class">
        <select className="field" value={clsId} onChange={(e) => { setClsId(e.target.value); setCap(null); setPp(null); }}>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </Field>
      <Field label="Day"><Segmented label="Day" options={DAYS.map((d, i) => ({ value: String(i), label: `${d} ${Number(addDays(week, i).slice(8))}` }))} value={String(day)} onChange={(v) => setDay(Number(v))} /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 16 }}>
        <Field label="Start">
          <select className="field" aria-label="Start time" value={String(start)} onChange={(e) => setStart(Number(e.target.value))}>
            {starts.map((h) => <option key={h} value={String(h)}>{fmt(h)}</option>)}
          </select>
        </Field>
        <Field label="Capacity"><Stepper label="spots" value={capacity} onDec={() => setCap(Math.max(1, capacity - 1))} onInc={() => setCap(Math.min(40, capacity + 1))} /></Field>
        <Field label="Open to PackPass"><Stepper label="PackPass spots" value={open} onDec={() => setPp(Math.max(0, open - 1))} onInc={() => setPp(Math.min(capacity, open + 1))} /></Field>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', boxShadow: 'inset 0 1px 0 var(--line)' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}><span className="pp-label">Repeats weekly</span><span className="pp-caption pp-muted">{repeat ? `Every ${FULL_DAYS[day]} at ${fmt(start)}` : 'One time only'}</span></div>
        <Toggle on={repeat} onChange={setRepeat} label="Repeats weekly" />
      </div>
      {clash ? <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', borderRadius: 8, background: 'var(--kennel-red-soft)', color: 'var(--kennel-red)' }}><Ico icon={AlertCircle} /><span className="pp-label">{`The trainer is already on ${clash.cls.title} at ${time(clash.start)}.`}</span></div> : null}
      {startsAt <= new Date() ? <ErrorLine>That time has already passed.</ErrorLine> : null}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span className="pp-label">{`${DAYS[day]} ${Number(date.slice(8))} · ${time(startsAt)} – ${time(endsAt)}`}</span>
        <span className="pp-caption pp-muted">{cls.credits ? `${cls.credits} credits per dog. Set by PackPass.` : 'Credit cost pending review.'}</span>
      </div>
    </Modal>
  );
}
