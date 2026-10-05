import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { checkIn, checkVaccines, errorCopy, loadRoster, loadSessions, loadWaitlist, type RosterDog } from '@/lib/api';
import { useData, usePartner } from '@/lib/partner';
import { credits, withClasses, type SessionView } from '@/lib/sessions';
import { db } from '@/lib/supabase';
import { partnerTraits, useTraits } from '@/lib/traits';
import { addDays, ageOf, austin, monthDay, time, weekday, ymd } from '@/lib/time';
import { useSigned } from '@/lib/useSigned';
import { Avatar, Button, Chip, ErrorLine, Modal, Tag } from '@/ui/kit';
import { checkInPayload, Qr } from '@/ui/Qr';
import { Empty, Loading } from './Overview';

const ENERGY: Record<string, string> = { couch: 'Couch', medium: 'Medium', high: 'High', working: 'Working dog' };
const SOCIAL: Record<string, string> = { loves_dogs: 'Loves dogs', selective: 'Selective', prefers_solo: 'Prefers solo' };

/** 04 Roster: who's booked for a session, check-in by hand or by QR, vaccine status, waitlist. */
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1240 }}>
      <h1 className="pk-display-xl" style={{ margin: 0 }}>Roster</h1>
      <Empty>No sessions today. Open a session from Schedule to see its roster.</Empty>
    </div>
  );
  const meta = [gym ? trainerName(s.cls.trainer_id) : null, `${s.cls.duration_min} min`, credits(s.cls.credits)].filter(Boolean).join(' · ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 1240 }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {sessions.map((x) => <Chip key={x.id} on={x.id === s.id} onClick={() => setParams({ s: x.id })}>{`${ymd(x.start) === today ? '' : `${weekday(x.start).slice(0, 3)} `}${time(x.start)} · ${x.cls.title}`}</Chip>)}
        </div>
        <SessionRoster key={s.id} s={s} meta={meta} onQr={() => setQr(true)} />
      </header>
      {qr ? <QrModal s={s} onClose={() => setQr(false)} /> : null}
    </div>
  );
}

function SessionRoster({ s, meta, onQr }: { s: SessionView; meta: string; onQr: () => void }) {
  const { data, reload } = useData(async () => ({ dogs: await loadRoster(s.id), waiting: await loadWaitlist(s.id) }), [s.id]);
  const photos = useSigned('dog-photos', data?.dogs.map((d) => d.photo_path) ?? []);
  const records = useSigned('vaccine-docs', data?.dogs.map((d) => d.record_path) ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const today = ymd(s.start) === ymd(new Date());
  const act = async (id: string, fn: () => Promise<void>) => {
    setBusy(id); setError(null);
    try { await fn(); reload(); } catch (e) { setError(errorCopy(e)); } finally { setBusy(null); }
  };
  useTraits(); // re-renders the rows once the trait catalog loads
  const dogs = data?.dogs ?? [];
  const nIn = dogs.filter((d) => d.status === 'checked_in').length;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="pk-wide pk-muted">{`${today ? 'Today' : `${weekday(s.start)} ${monthDay(s.start)}`} · ${time(s.start)} · ${s.cls.duration_min} min`}</span>
          <h1 className="pk-display-xl" style={{ margin: 0 }}>{s.cls.title}</h1>
          <span className="pk-label pk-muted">{meta}</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className="pk-display-md">{`${nIn} of ${dogs.length} checked in`}</span>
          <Button variant="quiet" size="sm" onClick={onQr}>Show check-in QR</Button>
        </div>
      </div>
      <ErrorLine>{error}</ErrorLine>
      {!data ? <Loading /> : dogs.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {dogs.map((d) => <DogRow key={d.booking_id} d={d} photo={d.photo_path ? photos[d.photo_path] : undefined} record={d.record_path ? records[d.record_path] : undefined}
            busy={busy === d.booking_id || busy === d.dog_id}
            onToggle={() => act(d.booking_id, () => checkIn(d.booking_id, d.status === 'checked_in'))}
            onVerify={() => act(d.dog_id, () => checkVaccines(d.dog_id))} />)}
        </div>
      ) : <Empty>No PackPass dogs booked yet.</Empty>}
      {data?.waiting.length ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 className="pk-title" style={{ margin: 0 }}>{`Waitlist · ${data.waiting.length}`}</h2>
          {data.waiting.map((w) => (
            <div key={w.place} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px 12px 12px', borderRadius: 20, background: 'var(--surface-raised)' }}>
              <Avatar name={w.dog_name} size={48} radius={12} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="pk-label" style={{ fontWeight: 600 }}>{w.dog_name}</span>
                <span className="pk-caption pk-muted">{`${w.breed ?? 'Dog'} · ${ordinal(w.place)} in line · joined ${monthDay(new Date(w.joined_at))}`}</span>
              </div>
            </div>
          ))}
          <span className="pk-caption pk-muted">{s.auto_promote ? 'When a spot opens more than 12 hours ahead, the first dog in line is booked automatically. Raise PackPass spots on Schedule to open one.' : 'Auto-promote is off: when a spot opens, everyone waiting is told and the first to book gets it.'}</span>
        </section>
      ) : null}
    </>
  );
}

function DogRow({ d, photo, record, busy, onToggle, onVerify }: { d: RosterDog; photo?: string; record?: string; busy: boolean; onToggle: () => void; onVerify: () => void }) {
  const on = d.status === 'checked_in';
  const traits = partnerTraits(d.traits);
  const warn = /expire|missing/i.test(d.vaccine_line);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 20px', alignItems: 'center', padding: '14px 20px 14px 14px', borderRadius: 20, background: 'var(--surface-raised)' }}>
      <Avatar name={d.dog_name} photo={photo} size={64} radius={12} />
      <div style={{ flex: '1 1 180px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span className="pk-title">{d.dog_name}</span>
        <span className="pk-caption pk-muted">{[d.mixed ? 'Mixed breed' : d.breed, ageOf(d.birth_year, d.birth_month), d.owner_name].filter(Boolean).join(' · ')}</span>
      </div>
      <div style={{ flex: '2 1 220px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {d.energy ? <Tag>{ENERGY[d.energy] ?? d.energy}</Tag> : null}
          {d.sociability ? <Tag>{SOCIAL[d.sociability] ?? d.sociability}</Tag> : null}
          {d.clearances.map((k) => (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 22, padding: '0 10px 0 8px', borderRadius: 9999, background: 'var(--pitch)', color: 'var(--on-pitch)', fontSize: 12, fontWeight: 600 }}><ShieldCheck size={12} />{k}</span>
          ))}
        </div>
        {d.last_note ? <span className="pk-caption pk-muted" style={{ textWrap: 'pretty' }}>{`Last note · ${d.last_note}`}</span> : null}
        {traits.length ? <span className="pk-caption pk-muted" style={{ textWrap: 'pretty' }}>{`From owner · ${traits.join(' · ')}`}</span> : null}
      </div>
      <div style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="pk-caption" style={{ color: warn ? 'var(--kennel-red)' : 'var(--ink-muted)', fontWeight: warn ? 600 : 400 }}>{d.vaccine_line}</span>
        {record ? <a className="pk-caption" href={record} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>Vet record</a> : null}
        {d.record_path && !d.record_verified && !warn ? <button className="link" style={{ fontSize: 12 }} disabled={busy} onClick={onVerify}>Mark checked</button> : null}
      </div>
      <Button variant={on ? 'quiet' : 'primary'} size="sm" block disabled={busy} onClick={onToggle} style={{ width: 136, flex: 'none' }}>{on ? 'Checked in' : 'Check in'}</Button>
    </div>
  );
}

/** The check-in QR for one session, plus its 4-digit code and who has checked in. */
export function QrModal({ s, onClose }: { s: SessionView; onClose: () => void }) {
  const { data } = useData(() => loadRoster(s.id), [s.id]);
  const photos = useSigned('dog-photos', data?.map((d) => d.photo_path) ?? []);
  const inList = (data ?? []).filter((d) => d.checked_in_at).sort((a, b) => (a.checked_in_at! < b.checked_in_at! ? 1 : -1));
  return (
    <Modal eyebrow={`Check-in · ${ymd(s.start) === ymd(new Date()) ? 'Today' : monthDay(s.start)} · ${time(s.start)}`} title={s.cls.title} onClose={onClose}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
        <div style={{ flex: 'none', width: 300, maxWidth: '100%', boxSizing: 'border-box', padding: 24, borderRadius: 28, background: '#fff', color: '#0e0f0e', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', boxShadow: 'inset 0 0 0 1px var(--line)' }}>
          <Qr value={checkInPayload(s.id, s.check_in_code)} />
          <span className="pk-wide" style={{ fontSize: 12 }}>Scan with the PackPass app</span>
        </div>
        <div style={{ flex: '1 1 240px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 22 }}>
          <p className="pk-body" style={{ margin: 0, textWrap: 'pretty' }}>Owners scan this with the PackPass app when they arrive. Check-in opens an hour before the start and closes when the session ends. Each scan checks the dog in on the roster.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="pk-caption pk-muted">No camera? Members enter this code</span>
            <span className="pk-display-lg pk-num" style={{ letterSpacing: '.2em' }}>{s.check_in_code}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="pk-label" style={{ fontWeight: 600 }}>{`${inList.length} of ${data?.length ?? s.booked} checked in`}</span>
            {inList.slice(0, 4).map((d) => (
              <div key={d.booking_id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar name={d.dog_name} size={36} photo={d.photo_path ? photos[d.photo_path] : undefined} />
                <span className="pk-label" style={{ flex: 1, fontWeight: 600 }}>{d.dog_name}</span>
                <span className="pk-caption pk-muted">{time(new Date(d.checked_in_at!))}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
        <Button variant="quiet" onClick={() => window.print()}>Print poster</Button>
        <Button onClick={() => document.querySelector('[role=dialog]')?.requestFullscreen?.()}>Open full screen</Button>
      </div>
    </Modal>
  );
}

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
