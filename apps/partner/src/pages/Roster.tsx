import { Check, Maximize2, NotebookPen, Printer, ScanLine, ShieldAlert, ShieldCheck, Syringe, Zap } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { checkIn, checkVaccines, errorCopy, loadRoster, loadSessions, loadWaitlist, markNoShow, type RosterDog } from '@/lib/api';
import { useData, usePartner } from '@/lib/partner';
import { credits, withClasses, type SessionView } from '@/lib/sessions';
import { db } from '@/lib/supabase';
import { partnerTraits, useTraits } from '@/lib/traits';
import { addDays, ageOf, austin, monthDay, time, weekday, ymd } from '@/lib/time';
import { useSigned } from '@/lib/useSigned';
import { Avatar, Badge, Button, Chip, ErrorLine, Modal, Page, Row } from '@/ui/kit';
import { checkInPayload, Qr } from '@/ui/Qr';
import { ReassessModal, undoReassessment } from '@/ui/Reassess';
import { Empty, Loading } from './Overview';
import { clearanceFromLabel, clearanceName } from '@/lib/clearances';

const ENERGY: Record<string, string> = { couch: 'Couch', medium: 'Medium', high: 'High', working: 'Working dog' };
const SOCIAL: Record<string, string> = { loves_dogs: 'Loves dogs', selective: 'Selective', prefers_solo: 'Prefers solo' };

/** 04 Roster (v3 Roster · check-in): who's booked, check-in by hand or by QR, no-shows once it has started, vaccines, waitlist. */
export function Roster() {
  const { classById, gym, trainerName } = usePartner();
  const [params, setParams] = useSearchParams();
  const [qr, setQr] = useState(false);
  const today = ymd(new Date());
  const picked = params.get('s');
  const { data: sessions } = useData(async () => {
    const list = withClasses(await loadSessions(austin(today, 0), austin(addDays(today, 1), 0)), classById).filter((s) => !s.cancelled_at);
    // A session opened from another day (Schedule, Overview) joins the tabs.
    if (picked && !list.some((s) => s.id === picked)) {
      const { data: row } = await db.from('sessions').select('starts_at').eq('id', picked).maybeSingle();
      if (row) {
        const day = ymd(new Date(row.starts_at));
        const more = withClasses(await loadSessions(austin(day, 0), austin(addDays(day, 1), 0)), classById).find((s) => s.id === picked);
        if (more) list.push(more);
      }
    }
    return list;
  }, [today, picked]);

  if (!sessions) return <Loading />;
  const now = new Date();
  const s = sessions.find((x) => x.id === picked) ?? sessions.find((x) => x.end > now) ?? sessions[sessions.length - 1];
  if (!s) return (
    <Page gap={16}>
      <h1 className="pp-page-title">Roster</h1>
      <Empty>No sessions today. Open a session from Schedule to see its roster.</Empty>
    </Page>
  );
  const meta = [gym ? trainerName(s.cls.trainer_id) : null, `${s.cls.duration_min} min`, credits(s.cls.credits)].filter(Boolean).join(' · ');

  return (
    <Page gap={16}>
      <Row gap={6}>
        {sessions.map((x) => <Chip key={x.id} on={x.id === s.id} onClick={() => setParams({ s: x.id })}>{`${ymd(x.start) === today ? '' : `${weekday(x.start).slice(0, 3)} `}${time(x.start)} · ${x.cls.title}`}</Chip>)}
      </Row>
      <SessionRoster key={s.id} s={s} meta={meta} onQr={() => setQr(true)} />
      {qr ? <QrModal s={s} onClose={() => setQr(false)} /> : null}
    </Page>
  );
}

function SessionRoster({ s, meta, onQr }: { s: SessionView; meta: string; onQr: () => void }) {
  const nav = useNavigate();
  const { data, reload } = useData(async () => ({ dogs: await loadRoster(s.id), waiting: await loadWaitlist(s.id) }), [s.id]);
  const photos = useSigned('dog-photos', data?.dogs.map((d) => d.photo_path) ?? []);
  const records = useSigned('vaccine-docs', data?.dogs.map((d) => d.record_path) ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [flagging, setFlagging] = useState<{ d: RosterDog; types: Kind[] } | null>(null);
  const now = new Date();
  const started = s.start <= now;
  const today = ymd(s.start) === ymd(now);
  const act = async (id: string, fn: () => Promise<void>) => {
    setBusy(id); setError(null);
    try { await fn(); reload(); } catch (e) { setError(errorCopy(e)); } finally { setBusy(null); }
  };
  useTraits(); // re-renders the rows once the trait catalog loads
  const dogs = data?.dogs ?? [];
  const nIn = dogs.filter((d) => d.status === 'checked_in').length;
  const nNo = dogs.filter((d) => d.status === 'no_show').length;
  const mins = Math.round((s.start.getTime() - now.getTime()) / 60_000);
  const status = !started
    ? (mins <= 90 ? `Starts in ${mins} min` : `${nIn} of ${dogs.length} checked in`)
    : `${nIn} of ${dogs.length} checked in${nNo ? ` · ${nNo} no-show` : ''}`;
  const ago = Math.round((now.getTime() - s.start.getTime()) / 60_000);

  return (
    <>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="pp-caption pp-muted">{`${today ? 'Today' : `${weekday(s.start).slice(0, 3)} ${monthDay(s.start)}`} · ${time(s.start)}`}</span>
          <h1 className="pp-page-title">{s.cls.title}</h1>
          <span className="pp-caption pp-muted">{`${meta} · ${s.cls.drop_off ? 'Drop-off' : 'Owners stay'} · ${dogs.length} booked of ${s.capacity}`}</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="pp-label pp-num">{status}</span>
          <Button variant="outline" icon={ScanLine} onClick={onQr}>Scan code</Button>
          {started && dogs.length ? <Button icon={NotebookPen} onClick={() => nav(`/notes?s=${s.id}`)}>Start report cards</Button> : null}
        </div>
      </header>
      {started && dogs.some((d) => d.status === 'booked') ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, background: 'var(--surface-raised)' }}>
          <span style={{ width: 8, height: 8, borderRadius: 9999, background: 'var(--signal)', flex: 'none' }} />
          <span className="pp-label">{`Started ${ago < 90 ? `${ago} min ago` : `at ${time(s.start)}`}. Mark dogs who didn't come as no-shows. No-shows are still paid and show in Earnings.`}</span>
        </div>
      ) : null}
      <ErrorLine>{error}</ErrorLine>
      {!data ? <Loading /> : dogs.length ? (
        <div className="tbl">
          <div className="tbl-head" style={{ gridTemplateColumns: ROSTER_COLS, minWidth: TABLE_MIN }}>
            <span /><span>Dog</span><span>Owner</span><span>Traits</span><span>Clearances</span><span>Vaccines</span><span>Check-in</span><span />
          </div>
          {dogs.map((d) => <DogRow key={d.booking_id} d={d} started={started} photo={d.photo_path ? photos[d.photo_path] : undefined} record={d.record_path ? records[d.record_path] : undefined}
            busy={busy === d.booking_id || busy === d.dog_id}
            onCheckIn={(undo) => act(d.booking_id, () => checkIn(d.booking_id, undo))}
            onNoShow={(undo) => act(d.booking_id, () => markNoShow(d.booking_id, undo))}
            onVerify={() => act(d.dog_id, () => checkVaccines(d.dog_id))}
            onReassess={(types) => setFlagging({ d, types })}
            onUndo={(type) => act(d.dog_id, () => undoReassessment(d.dog_id, type))} />)}
        </div>
      ) : <Empty>No PackPass dogs booked yet.</Empty>}
      {flagging ? <ReassessModal dogId={flagging.d.dog_id} dogName={flagging.d.dog_name} types={flagging.types} onClose={() => setFlagging(null)} onDone={reload} /> : null}
      {!started && data?.waiting.length ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
          <Row gap={10} style={{ alignItems: 'center' }}>
            <h2 className="pp-title">{`Waitlist · ${data.waiting.length}`}</h2>
            <Badge icon={Zap}>{s.auto_promote ? 'Auto-book on' : 'Auto-book off'}</Badge>
          </Row>
          <div className="tbl">
            {data.waiting.map((w) => (
              <div key={w.place} className="tbl-row" style={{ gridTemplateColumns: '36px minmax(0,1fr)', minHeight: 48 }}>
                <Avatar name={w.dog_name} size={36} radius={8} />
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span className="pp-heading">{w.dog_name}</span>
                  <span className="pp-caption pp-muted">{w.offer_until
                    ? `${w.breed ?? 'Dog'} · Spot offered · accept by ${time(new Date(w.offer_until))}`
                    : `${w.breed ?? 'Dog'} · ${ordinal(w.place)} in line · joined ${monthDay(new Date(w.joined_at))}`}</span>
                </div>
              </div>
            ))}
          </div>
          <span className="pp-caption pp-muted">{s.auto_promote ? `If a spot opens, PackPass books the first dog and holds their credits. Inside your ${s.cls.cancel_hours}-hour window, the owner gets 2 hours to accept, then it moves to the next dog.` : 'Auto-book is off: when a spot opens, everyone waiting is told and the first to book gets it.'}</span>
        </section>
      ) : null}
    </>
  );
}

const ROSTER_COLS = '36px minmax(0,1.1fr) minmax(0,0.8fr) minmax(0,1.2fr) 130px 180px 140px 210px';
const TABLE_MIN = 1060;

type Kind = string;

function DogRow({ d, started, photo, record, busy, onCheckIn, onNoShow, onVerify, onReassess, onUndo }: {
  d: RosterDog; started: boolean; photo?: string; record?: string; busy: boolean; onCheckIn: (undo: boolean) => void; onNoShow: (undo: boolean) => void;
  onVerify: () => void; onReassess: (types: Kind[]) => void; onUndo: (type: Kind) => void;
}) {
  // "Herding" is current; "Herding · re-assess" was flagged and waits on a new assessment.
  const kind = (k: string) => clearanceFromLabel(k);
  const current = d.clearances.filter((k) => !k.includes('re-assess')).map(kind);
  const flagged = d.clearances.filter((k) => k.includes('re-assess')).map(kind);
  const traits = [d.energy ? ENERGY[d.energy] ?? d.energy : null, d.sociability ? SOCIAL[d.sociability] ?? d.sociability : null, ...partnerTraits(d.traits)].filter(Boolean).join(' · ');
  const warn = /expire|missing/i.test(d.vaccine_line);
  const inAt = d.status === 'checked_in' && d.checked_in_at ? new Date(d.checked_in_at) : null;
  const [label, tone] = d.status === 'checked_in' ? [inAt ? `Checked in ${time(inAt)}` : 'Checked in', 'cleared' as const]
    : d.status === 'no_show' ? ['No-show', 'warning' as const] : started ? ['Not checked in', 'needs' as const] : ['Booked', 'neutral' as const];
  return (
    <div className="tbl-row" style={{ gridTemplateColumns: ROSTER_COLS, minWidth: TABLE_MIN, minHeight: 48 }}>
      <Avatar name={d.dog_name} photo={photo} size={36} radius={8} />
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span className="pp-heading">{d.dog_name}</span>
        <span className="pp-caption pp-muted ellipsis">{[d.mixed ? 'Mixed breed' : d.breed, ageOf(d.birth_year, d.birth_month)].filter(Boolean).join(' · ')}</span>
      </div>
      <span className="pp-caption ellipsis">{d.owner_name || '–'}</span>
      <span className="pp-caption ellipsis" title={traits}>{traits || '–'}</span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        {d.clearances.length ? d.clearances.map((k) => k.includes('re-assess')
          ? <Badge key={k} tone="warning" icon={ShieldAlert}>{k}</Badge>
          : <Badge key={k} tone="cleared" icon={ShieldCheck}>{k}</Badge>) : <Badge tone="needs">None yet</Badge>}
        {current.length ? <button className="link pp-caption" disabled={busy} onClick={() => onReassess(current)}>Re-assess</button> : null}
        {flagged.map((t) => <button key={t} className="link pp-caption" disabled={busy} onClick={() => onUndo(t)}>{`Undo ${clearanceName(t)}`}</button>)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, minWidth: 0 }}>
        {warn ? <Badge tone="warning" icon={Syringe}>{d.vaccine_line}</Badge> : <Badge icon={Check}>{d.vaccine_line}</Badge>}
        {record ? <a className="pp-caption" href={record} target="_blank" rel="noreferrer" style={{ fontWeight: 500 }}>Vet record</a> : null}
        {d.record_path && !d.record_verified && !warn ? <button className="link" disabled={busy} onClick={onVerify}>Mark checked</button> : null}
      </div>
      <div><Badge tone={tone} dot={d.status === 'checked_in'}>{label}</Badge></div>
      <Row gap={6} wrap={false} style={{ justifyContent: 'flex-end' }}>
        {d.status === 'checked_in' ? <Button variant="ghost" size="sm" disabled={busy} onClick={() => onCheckIn(true)}>Undo</Button>
          : d.status === 'no_show' ? <Button variant="ghost" size="sm" disabled={busy} onClick={() => onNoShow(true)}>Undo</Button>
          : started ? <>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => onCheckIn(false)}>Check in late</Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => onNoShow(false)}>Mark no-show</Button>
          </> : <Button variant="outline" size="sm" disabled={busy} onClick={() => onCheckIn(false)}>Check in</Button>}
      </Row>
    </div>
  );
}

/** The check-in QR for one session, plus its 4-digit code and who has checked in. */
export function QrModal({ s, onClose }: { s: SessionView; onClose: () => void }) {
  const { data } = useData(() => loadRoster(s.id), [s.id]);
  const photos = useSigned('dog-photos', data?.map((d) => d.photo_path) ?? []);
  const inList = (data ?? []).filter((d) => d.checked_in_at).sort((a, b) => (a.checked_in_at! < b.checked_in_at! ? 1 : -1));
  return (
    <Modal eyebrow={`Check-in · ${ymd(s.start) === ymd(new Date()) ? 'Today' : monthDay(s.start)} · ${time(s.start)}`} title={s.cls.title} onClose={onClose} width={560}
      footer={<><Button variant="outline" icon={Printer} onClick={() => window.print()}>Print poster</Button><Button icon={Maximize2} onClick={() => document.querySelector('[role=dialog]')?.requestFullscreen?.()}>Open full screen</Button></>}>
      <QrBody value={checkInPayload(s.id, s.check_in_code)} code={s.check_in_code}
        body="Owners scan this with the PackPass app when they arrive. Check-in opens an hour before the start and closes when the session ends. Each scan checks the dog in on the roster.">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="pp-label" style={{ paddingBottom: 4 }}>{`${inList.length} of ${data?.length ?? s.booked} checked in`}</span>
          {inList.slice(0, 4).map((d) => (
            <div key={d.booking_id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40, boxShadow: 'inset 0 -1px 0 var(--line)' }}>
              <Avatar name={d.dog_name} size={28} photo={d.photo_path ? photos[d.photo_path] : undefined} />
              <span className="pp-label" style={{ flex: 1 }}>{d.dog_name}</span>
              <span className="pp-caption pp-muted pp-num">{time(new Date(d.checked_in_at!))}</span>
            </div>
          ))}
        </div>
      </QrBody>
    </Modal>
  );
}

/** The QR card on white beside the explanation and the 4-digit fallback code (session and location QR modals). */
export function QrBody({ value, code, body, children }: { value: string; code: string; body: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 24, alignItems: 'start' }}>
      <div style={{ padding: 16, borderRadius: 12, background: '#fff', color: '#0e0f0e', boxShadow: 'inset 0 0 0 1px var(--line)', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
        <Qr value={value} size={188} />
        <span style={{ fontSize: 11, fontWeight: 500, textAlign: 'center' }}>Scan with the PackPass app</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <p className="pp-body" style={{ textWrap: 'pretty' }}>{body}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="pp-caption pp-muted">No camera? Members enter this code</span>
          <span className="pp-stat-num" style={{ letterSpacing: '.2em' }}>{code}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
