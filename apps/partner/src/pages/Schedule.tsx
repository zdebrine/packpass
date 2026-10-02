import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { addSession, blockDates, cancelSession, errorCopy, loadSessions, updateSession } from '@/lib/api';
import { useData, usePartner } from '@/lib/partner';
import { credits, startHour, withClasses, type SessionView } from '@/lib/sessions';
import { db, check } from '@/lib/supabase';
import { addDays, austin, dayIndex, mondayOf, monthDay, shortTime, time, ymd } from '@/lib/time';
import { Button, Chip, ErrorLine, Field, Modal, Row, Stepper, Toggle } from '@/ui/kit';
import { Loading } from './Overview';

const HOUR_PX = 64;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** 02 Schedule and capacity: the week grid, a side panel for the picked session, Block dates, Add session. */
export function Schedule() {
  const { classById, classes, partner, gym, trainerName } = usePartner();
  const [params, setParams] = useSearchParams();
  const [week, setWeek] = useState(() => mondayOf(new Date()));
  const [modal, setModal] = useState<null | 'block' | 'add'>(null);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="pk-wide pk-muted">Schedule and capacity</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 className="pk-display-xl" style={{ margin: 0, whiteSpace: 'nowrap' }}>{`${monthDay(austin(week, 12))} – ${monthDay(austin(addDays(week, 6), 12))}`}</h1>
            <RoundButton label="Previous week" onClick={() => setWeek(addDays(week, -7))}><ChevronLeft size={20} /></RoundButton>
            <RoundButton label="Next week" onClick={() => setWeek(addDays(week, 7))}><ChevronRight size={20} /></RoundButton>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="pk-label pk-muted">{`${live.reduce((a, s) => a + s.booked, 0)} of ${live.reduce((a, s) => a + s.packpass_spots, 0)} PackPass spots booked`}</span>
          <Button variant="quiet" size="sm" onClick={() => setModal('block')}>Block dates</Button>
          <Button size="sm" onClick={() => setModal('add')}>Add session</Button>
        </div>
      </header>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'flex-start' }}>
        <div style={{ flex: '999 1 640px', minWidth: 0, overflowX: 'auto' }}>
          <div style={{ minWidth: 720, display: 'grid', gridTemplateColumns: '48px repeat(7,minmax(0,1fr))', gap: 8 }}>
            <div />
            {DAYS.map((d, i) => {
              const date = addDays(week, i);
              const blocked = sessions.some((s) => ymd(s.start) === date && s.cancelled_at) && !live.some((s) => ymd(s.start) === date);
              return (
                <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px 6px' }}>
                  <span className="pk-label" style={{ fontWeight: 600 }}>{d}</span>
                  <span className="pk-label pk-muted">{Number(date.slice(8))}</span>
                  {date === today ? <span style={{ width: 8, height: 8, borderRadius: 9999, background: 'var(--agility)' }} /> : null}
                  {blocked ? <span className="pk-caption" style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--kennel-red)' }}>Blocked</span> : null}
                </div>
              );
            })}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {hours.map((h) => <span key={h} className="pk-caption pk-muted" style={{ height: HOUR_PX, lineHeight: 1 }}>{`${h % 12 || 12} ${h >= 12 ? 'pm' : 'am'}`}</span>)}
            </div>
            {DAYS.map((d, i) => (
              <div key={d} style={{ position: 'relative', height: hours.length * HOUR_PX, borderRadius: 20, background: 'var(--surface-raised)' }}>
                {lanes(sessions.filter((s) => ymd(s.start) === addDays(week, i))).map(({ s, lane }) => {
                  const on = s.id === sel?.id, cx = !!s.cancelled_at;
                  return (
                    <button key={s.id} onClick={() => setParams({ s: s.id })} aria-pressed={on}
                      style={{ position: 'absolute', left: 4 + lane * 16, right: 4, top: (startHour(s) - lo) * HOUR_PX + 2, height: (s.cls.duration_min / 60) * HOUR_PX - 4, boxSizing: 'border-box', padding: '5px 8px', border: 0, borderRadius: 12,
                        background: on ? 'var(--inverse)' : cx ? 'repeating-linear-gradient(135deg,var(--surface-sunken) 0 6px,var(--bg) 6px 12px)' : 'var(--bg)',
                        color: on ? 'var(--on-inverse)' : cx ? 'var(--ink-muted)' : 'var(--ink)', textDecoration: cx ? 'line-through' : 'none',
                        display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start', textAlign: 'left', cursor: 'pointer', overflow: 'hidden', zIndex: on ? 10 : lane + 1, boxShadow: lane ? '0 0 0 2px var(--surface-raised)' : 'none' }}>
                      {s.cls.duration_min < 45 ? (
                        // Too short for two lines: time and title on one.
                        <span style={{ maxWidth: '100%', fontSize: 11, lineHeight: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><b>{shortTime(s.start)}</b>{` ${s.cls.title}`}</span>
                      ) : (
                        <>
                          <span style={{ fontSize: 12, fontWeight: 600, lineHeight: '15px', display: '-webkit-box', WebkitLineClamp: s.cls.duration_min < 60 ? 1 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{s.cls.title}</span>
                          <span style={{ fontSize: 11, lineHeight: '14px', opacity: 0.72, whiteSpace: 'nowrap' }}>{`${shortTime(s.start)} · ${s.spots_left <= 0 ? 'Full' : `${s.booked}/${s.packpass_spots}`}`}</span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        {sel ? <SessionPanel key={sel.id + sel.packpass_spots + sel.capacity} s={sel} repeats={repeats(sel)} gym={gym} trainer={trainerName(sel.cls.trainer_id)} location={partner.name} onSaved={reload} /> : null}
      </div>
      {modal === 'block' ? <BlockDates onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); }} /> : null}
      {modal === 'add' ? <AddSession week={week} classes={classes.filter((c) => c.status === 'live')} sessions={sessions} onClose={() => setModal(null)}
        onDone={(id, date) => { setModal(null); setWeek(mondayOf(date)); setParams({ s: id }); reload(); }} /> : null}
    </div>
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

function RoundButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return <button aria-label={label} onClick={onClick} style={{ width: 44, height: 44, border: 0, borderRadius: 9999, background: 'var(--surface-raised)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)' }}>{children}</button>;
}

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
    <aside style={{ flex: '1 1 320px', maxWidth: 420, minWidth: 0, boxSizing: 'border-box', position: 'sticky', top: 24, background: 'var(--surface-raised)', borderRadius: 28, padding: 24, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="pk-wide pk-muted">{`${DAYS[dayIndex(s.start)]} ${Number(ymd(s.start).slice(8))} · ${time(s.start)} · ${s.cls.duration_min} min`}</span>
        <h2 className="pk-display-md" style={{ margin: 0 }}>{s.cls.title}</h2>
        <span className="pk-caption pk-muted">{s.cancelled_at ? `Cancelled · ${s.cancel_reason}` : `${s.booked} booked${s.waiting ? ` · ${s.waiting} on waitlist` : ''}${s.cls.premium ? ' · Premium class' : ''}`}</span>
      </div>
      {s.cancelled_at ? <span className="pk-label pk-muted">Members were refunded and told. This session no longer shows on Book.</span> : (
        <>
          <Field label="Capacity" note={cap <= pp ? 'Every spot is open to PackPass.' : `${cap - pp} kept for your direct clients.`}>
            <Row gap={14}><Stepper label="spots" value={cap} onDec={() => setCap(Math.max(pp, cap - 1))} onInc={() => setCap(Math.min(40, cap + 1))} decDisabled={cap <= pp} /></Row>
          </Field>
          <Field label="Spots open to PackPass" note={pp <= taken ? `Can't go below ${taken}: that many are booked or held. Cancel from the roster first.` : `${taken} of ${pp} taken by PackPass members.`}>
            <Row gap={14}><Stepper label="PackPass spots" value={pp} onDec={() => setPp(Math.max(taken, pp - 1))} onInc={() => setPp(Math.min(cap, pp + 1))} decDisabled={pp <= taken} incDisabled={pp >= cap} /><span className="pk-label pk-muted">of {cap}</span></Row>
          </Field>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <ToggleRow label="Waitlist" sub="Open when the session is full" on={wl} set={setWl} />
            <ToggleRow label="Auto-promote" sub="Book the next dog in line when a spot opens, until 12 hours before" on={promote} set={setPromote} />
            <ToggleRow label="Repeats weekly" sub={`Every ${FULL_DAYS[dayIndex(s.start)]} at ${time(s.start)}`} on={rep} set={setRep} />
          </div>
        </>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {gym && trainer ? <KV k="Trainer" v={trainer} /> : null}
        <KV k="Location" v={location} />
        <KV k="Credit cost" v={credits(s.cls.credits)} />
        <span className="pk-caption pk-muted">Credit cost is set by PackPass.</span>
      </div>
      <ErrorLine>{msg}</ErrorLine>
      {s.cancelled_at || past ? null : confirmCancel ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="pk-label" style={{ fontWeight: 600 }}>{s.booked ? `Cancel and refund ${s.booked} dog${s.booked > 1 ? 's' : ''}? Their owners are told.` : 'Cancel this session? Nobody is booked yet.'}</span>
          <Button block disabled={busy} onClick={cancel}>{busy ? 'Cancelling…' : 'Yes, cancel it'}</Button>
          <Button block variant="quiet" onClick={() => setConfirmCancel(false)}>Keep it</Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Button block disabled={!dirty || busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</Button>
          <Button block variant="quiet" onClick={() => setConfirmCancel(true)}>Cancel this session</Button>
        </div>
      )}
    </aside>
  );
}

const KV = ({ k, v }: { k: string; v: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span className="pk-label pk-muted">{k}</span><span className="pk-label" style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span></div>
);
function ToggleRow({ label, sub, on, set }: { label: string; sub: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span className="pk-label" style={{ fontWeight: 600 }}>{label}</span><span className="pk-caption pk-muted">{sub}</span></div>
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
    <Modal eyebrow="Schedule · Block dates" title={label} onClose={onClose} width={760}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28 }}>
        <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span className="pk-title">{new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first)}</span>
            <Row gap={4}><RoundButton label="Previous month" onClick={() => shift(-1)}><ChevronLeft size={18} /></RoundButton><RoundButton label="Next month" onClick={() => shift(1)}><ChevronRight size={18} /></RoundButton></Row>
          </div>
          <span className="pk-caption pk-muted">{!from || to ? 'Pick the first day' : 'Pick the last day, or the same day again'}</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 4 }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((w, i) => <span key={i} className="pk-caption pk-muted" style={{ textAlign: 'center', paddingBottom: 4 }}>{w}</span>)}
            {cells.map((d, i) => {
              if (!d) return <span key={i} />;
              const isEnd = d === from || d === end, mid = !!from && !!end && d > from && d < end, gone = d < today;
              return <button key={d} onClick={() => pick(d)} disabled={gone}
                style={{ height: 44, border: 0, borderRadius: 9999, cursor: gone ? 'default' : 'pointer', fontSize: 14, fontWeight: isEnd ? 600 : 500, opacity: gone ? 0.35 : 1,
                  background: isEnd ? 'var(--inverse)' : mid ? 'var(--surface-raised)' : 'transparent', color: isEnd ? 'var(--on-inverse)' : 'var(--ink)' }}>{Number(d.slice(8))}</button>;
            })}
          </div>
        </div>
        <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Field label="Reason">
            <Row>{['Holiday', 'Weather', 'Maintenance', 'Private event', 'Trainer away'].map((r) => <Chip key={r} on={reason === r} onClick={() => setReason(r)}>{r}</Chip>)}</Row>
          </Field>
        </div>
      </div>
      <div style={{ marginTop: 24, padding: 20, borderRadius: 20, background: 'var(--surface-raised)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="pk-display-md">{!from ? 'Pick the dates to block' : affected.length ? `${affected.length} session${affected.length > 1 ? 's' : ''} · ${dogs} dog${dogs === 1 ? '' : 's'} booked` : 'No sessions affected'}</span>
        <span className="pk-caption pk-muted" style={{ textWrap: 'pretty' }}>Booked members get their credits back and the message below. Blocked sessions stop showing on Book.</span>
      </div>
      <textarea className="area" placeholder="Message to booked members (optional)" value={message} onChange={(e) => setMessage(e.target.value)} style={{ marginTop: 12, minHeight: 84 }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 20 }}>
        <ErrorLine>{error}</ErrorLine>
        <Button variant="quiet" onClick={onClose}>Cancel</Button>
        <Button disabled={!from || busy} onClick={confirm}>{busy ? 'Blocking…' : from ? `Block ${label}` : 'Block dates'}</Button>
      </div>
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
  if (!cls) return <Modal eyebrow="Schedule · New session" title="No live classes" onClose={onClose}><span className="pk-label pk-muted">Classes can be scheduled once PackPass has set their credits.</span></Modal>;
  const capacity = cap ?? cls.group_size, open = Math.min(capacity, pp ?? capacity);
  const date = addDays(week, day);
  const startsAt = austin(date, start);
  const endsAt = new Date(startsAt.getTime() + cls.duration_min * 60_000);
  const clash = sessions.find((s) => !s.cancelled_at && s.start < endsAt && startsAt < s.end && (s.cls.trainer_id === cls.trainer_id));
  const fmt = (h: number) => time(austin(date, h));
  const add = async () => {
    setBusy(true); setError(null);
    try { onDone(await addSession(cls.id, startsAt, capacity, open, repeat), startsAt); } catch (e) { setError(errorCopy(e)); setBusy(false); }
  };
  return (
    <Modal eyebrow="Schedule · New session" title={cls.title} onClose={onClose} width={760}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <Field label="Class"><Row>{classes.map((c) => <Chip key={c.id} on={c.id === clsId} onClick={() => { setClsId(c.id); setCap(null); setPp(null); }}>{c.title}</Chip>)}</Row></Field>
        <Field label="Day"><Row>{DAYS.map((d, i) => <Chip key={d} on={i === day} onClick={() => setDay(i)}>{`${d} ${Number(addDays(week, i).slice(8))}`}</Chip>)}</Row></Field>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 20 }}>
          <Field label="Start"><Stepper label="start time" value={<span style={{ whiteSpace: 'nowrap' }}>{fmt(start)}</span>} onDec={() => setStart(Math.max(6, start - 0.25))} onInc={() => setStart(Math.min(21, start + 0.25))} /></Field>
          <Field label="Capacity"><Stepper label="spots" value={capacity} onDec={() => setCap(Math.max(1, capacity - 1))} onInc={() => setCap(Math.min(40, capacity + 1))} /></Field>
          <Field label="Open to PackPass"><Stepper label="PackPass spots" value={open} onDec={() => setPp(Math.max(0, open - 1))} onInc={() => setPp(Math.min(capacity, open + 1))} /></Field>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span className="pk-label" style={{ fontWeight: 600 }}>Repeats weekly</span><span className="pk-caption pk-muted">{repeat ? `Every ${FULL_DAYS[day]} at ${fmt(start)}` : 'One time only'}</span></div>
          <Toggle on={repeat} onChange={setRepeat} label="Repeats weekly" />
        </div>
        {clash ? <div style={{ padding: '14px 16px', borderRadius: 20, background: 'var(--kennel-red-soft)', color: 'var(--kennel-red)' }}><span className="pk-label" style={{ fontWeight: 600 }}>{`The trainer is already on ${clash.cls.title} at ${time(clash.start)}.`}</span></div> : null}
        {startsAt <= new Date() ? <ErrorLine>That time has already passed.</ErrorLine> : null}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginTop: 24, paddingTop: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span className="pk-label" style={{ fontWeight: 600 }}>{`${DAYS[day]} ${Number(date.slice(8))} · ${time(startsAt)} – ${time(endsAt)}`}</span>
          <span className="pk-caption pk-muted">{cls.credits ? `${cls.credits} credits per dog. Set by PackPass.` : 'Credit cost pending review.'}</span>
        </div>
        <Row><ErrorLine>{error}</ErrorLine><Button variant="quiet" onClick={onClose}>Cancel</Button><Button disabled={busy || startsAt <= new Date()} onClick={add}>{busy ? 'Adding…' : 'Add session'}</Button></Row>
      </div>
    </Modal>
  );
}
