import { Phone, Trash2, Video } from 'lucide-react';
import { useState } from 'react';

import {
  addIntakeSlots, errorCopy, loadIntakeCalls, loadIntakeSettings, loadIntakeSlots, offerPrivate, removeIntakeSlot, saveIntake,
  type IntakeCall, type IntakeSetting, type IntakeSlot,
} from '@/lib/api';
import { useData, usePartner } from '@/lib/partner';
import { partnerTraits, useTraits } from '@/lib/traits';
import { addDays, austin, monthDay, time, weekday, ymd } from '@/lib/time';
import { useSigned } from '@/lib/useSigned';
import { Avatar, Badge, Button, Chip, ErrorLine, Field, IconButton, Page, Row, Segmented, Toggle, type BadgeTone } from '@/ui/kit';
import { Empty, Loading } from './Overview';

const day = (d: Date) => `${ymd(d) === ymd(new Date()) ? 'Today' : `${weekday(d).slice(0, 3)} ${monthDay(d)}`}`;
const when = (d: Date) => `${day(d)} · ${time(d)}`;
// Times a specialist can open, every 30 minutes from 8 am to 7:30 pm (Austin).
const TIMES = Array.from({ length: 24 }, (_, i) => 8 + i / 2);
const hourLabel = (h: number) => time(austin('2026-01-05', h));

/** What a call is waiting on, for the list and the detail. */
function callState(c: IntakeCall): [string, BadgeTone] {
  if (c.status === 'cancelled') return ['Cancelled', 'neutral'];
  if (c.offer_status === 'booked') return ['1:1 booked', 'cleared'];
  if (c.offer_status === 'offered') return ['1:1 offered', 'neutral'];
  if (c.offer_status === 'other_time') return ['Wants another time', 'needs'];
  if (c.offer_status === 'expired') return ['Offer expired', 'needs'];
  if (!c.starts_at) return ['Calendly', 'neutral'];
  return new Date(c.starts_at) < new Date() ? ['Offer a 1:1', 'signal'] : ['Booked', 'neutral'];
}

/**
 * Intake calls (23d to 23f, partner side): 15-minute calls members book for 0 credits from Book › Skills, then a 1:1
 * offered in the app. Each trainer pastes a meeting link and opens times, or a Calendly link that does the scheduling.
 */
export function Intake() {
  const [view, setView] = useState<'Calls' | 'How you take calls'>('Calls');
  const calls = useData(loadIntakeCalls, []);
  const settings = useData(loadIntakeSettings, []);
  const slots = useData(loadIntakeSlots, []);
  if (!calls.data || !settings.data || !slots.data) return <Loading />;
  const live = settings.data.filter((s) => s.link && s.active);

  return (
    <Page gap={20}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1 className="pp-page-title">Intake calls</h1>
        <span className="pp-caption pp-muted" style={{ textWrap: 'pretty' }}>15 minutes, free for members. You see the dog's profile and notes before the call, then offer a 1:1 in the app.</span>
      </header>
      <Segmented label="View" options={['Calls', 'How you take calls']} value={view} onChange={setView} />
      {view === 'Calls' ? (
        live.length || calls.data.length
          ? <Calls calls={calls.data} reload={calls.reload} />
          : <Empty>Nobody takes intake calls yet. Set it up under How you take calls.</Empty>
      ) : (
        <Setup settings={settings.data} slots={slots.data} reload={() => { settings.reload(); slots.reload(); }} />
      )}
    </Page>
  );
}

function Calls({ calls, reload }: { calls: IntakeCall[]; reload: () => void }) {
  const { gym } = usePartner();
  const [sel, setSel] = useState<string | null>(null);
  const photos = useSigned('dog-photos', calls.map((c) => c.photo_path));
  if (!calls.length) return <Empty>No calls booked yet. Members book from Book › Skills once you have open times.</Empty>;
  const c = calls.find((x) => x.id === sel) ?? calls.find((x) => callState(x)[0] === 'Offer a 1:1') ?? calls[0];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
      <div className="tbl" style={{ flex: '1 1 260px', maxWidth: 360 }}>
        {calls.map((x) => {
          const on = x.id === c.id;
          const [st, tone] = callState(x);
          return (
            <div key={x.id} role="button" tabIndex={0} aria-pressed={on} className="tbl-row tbl-click" onClick={() => setSel(x.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSel(x.id)}
              style={{ gridTemplateColumns: '36px minmax(0,1fr) auto', minHeight: 56, background: on ? 'var(--hover)' : undefined, boxShadow: on ? 'inset 2px 0 0 var(--ink),inset 0 -1px 0 var(--line)' : undefined }}>
              <Avatar name={x.dog_name} photo={x.photo_path ? photos[x.photo_path] : undefined} size={36} radius={8} />
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <span className="pp-heading ellipsis">{x.dog_name}{gym ? <span className="pp-muted">{` · ${x.trainer_name}`}</span> : null}</span>
                <span className="pp-caption pp-muted">{x.starts_at ? when(new Date(x.starts_at)) : `Asked ${day(new Date(x.created_at))}`}</span>
              </div>
              <Badge tone={tone}>{st}</Badge>
            </div>
          );
        })}
      </div>
      <CallDetail key={c.id} c={c} photo={c.photo_path ? photos[c.photo_path] : undefined} onOffered={reload} />
    </div>
  );
}

function CallDetail({ c, photo, onOffered }: { c: IntakeCall; photo?: string; onOffered: () => void }) {
  useTraits(); // re-renders once the trait catalog loads
  const traits = partnerTraits(c.traits);
  const [st] = callState(c);
  const how = c.mode === 'calendly' ? 'Booked through Calendly' : c.mode === 'phone' ? `Phone · ${c.phone ?? ''}` : 'Video';
  const first = c.owner_name.trim().split(' ')[0] || 'The owner';
  const canOffer = c.status === 'booked' && c.offer_status !== 'offered' && c.offer_status !== 'booked';

  return (
    <div style={{ flex: '999 1 440px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Avatar name={c.dog_name} photo={photo} size={56} radius={12} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span className="pp-caption pp-muted">{[c.starts_at ? when(new Date(c.starts_at)) : 'Time on Calendly', c.breed, c.owner_name].filter(Boolean).join(' · ')}</span>
          <h2 className="pp-page-title">{`${c.dog_name} · intake call`}</h2>
        </div>
      </div>
      <Row gap={8}>
        <Badge icon={c.mode === 'phone' ? Phone : Video}>{how}</Badge>
        {c.status === 'cancelled' ? <Badge>Cancelled by the owner</Badge> : null}
      </Row>
      <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="pp-label">{`What ${first} told PackPass`}</span>
        <span className="pp-caption" style={{ textWrap: 'pretty' }}>{traits.length ? traits.join(' · ') : 'No traits added.'}</span>
        <span className="pp-label" style={{ marginTop: 4 }}>Last trainer notes</span>
        {c.notes.length ? c.notes.map((n, i) => <span key={i} className="pp-caption pp-muted" style={{ textWrap: 'pretty' }}>{`“${n}”`}</span>)
          : <span className="pp-caption pp-muted">{`No trainer notes for ${c.dog_name} yet.`}</span>}
      </div>
      {c.offer_status ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 14px', borderRadius: 12, background: c.offer_status === 'booked' ? 'var(--turf-soft)' : 'var(--surface-sunken)' }}>
          <span className="pp-label" style={{ textWrap: 'pretty' }}>{offerLine(c, first)}</span>
        </div>
      ) : null}
      {canOffer ? <OfferForm c={c} onOffered={onOffered} later={st === 'Booked'} /> : null}
    </div>
  );
}

const offerLine = (c: IntakeCall, first: string) => {
  const what = `${c.offer_title ?? '1:1'}${c.offer_starts_at ? `, ${when(new Date(c.offer_starts_at))}` : ''}`;
  switch (c.offer_status) {
    case 'booked': return `${first} booked ${what}.`;
    case 'offered': return `Offered ${what}. Waiting on ${first}.`;
    case 'other_time': return `${first} asked for another time than ${what}. Offer a new one below.`;
    default: return `The offer of ${what} expired. Offer a new one below.`;
  }
};

/** Offer a 1:1: one of the partner's Private templates at a day and time, with a line for the owner. */
function OfferForm({ c, onOffered, later }: { c: IntakeCall; onOffered: () => void; later: boolean }) {
  const { classes } = usePartner();
  const privates = classes.filter((k) => k.session_type === 'private' && k.status === 'live' && !k.archived_at);
  const [cls, setCls] = useState(privates.find((k) => k.trainer_id === c.trainer_id)?.id ?? privates[0]?.id ?? '');
  const [date, setDate] = useState(addDays(ymd(new Date()), 3));
  const [hour, setHour] = useState(17);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const k = privates.find((x) => x.id === cls);

  if (!privates.length) return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <h3 className="pp-title">Offer a 1:1</h3>
      <span className="pp-caption pp-muted">Add a Private template on Classes first. Offers book one of your Private templates.</span>
    </section>
  );
  const send = async () => {
    setBusy(true); setError(null);
    try { await offerPrivate(c.id, cls, austin(date, hour), note); onOffered(); } catch (e) { setError(errorCopy(e)); setBusy(false); }
  };
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <h3 className="pp-title">Offer a 1:1</h3>
        <span className="pp-caption pp-muted" style={{ textWrap: 'pretty' }}>{`${later ? 'After the call, ' : ''}${c.dog_name}'s owner gets it in the app and books it for its credits. Only they see the slot. It stays open two days.`}</span>
      </div>
      <Field label="Session">
        <select className="field" aria-label="Session" value={cls} onChange={(e) => setCls(e.target.value)} style={{ maxWidth: 420 }}>
          {privates.map((x) => <option key={x.id} value={x.id}>{`${x.title} · ${x.duration_min} min · ${x.credits ?? '–'} credits`}</option>)}
        </select>
      </Field>
      <Row gap={12} wrap>
        <Field label="Day"><input className="field" type="date" aria-label="Day" min={ymd(new Date())} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ width: 180 }} /></Field>
        <Field label="Time">
          <select className="field" aria-label="Time" value={hour} onChange={(e) => setHour(Number(e.target.value))} style={{ width: 140 }}>
            {TIMES.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </select>
        </Field>
      </Row>
      <Field label="Note to owner" note="Shown on the offer, in quotes.">
        <input className="field" aria-label="Note to owner" maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder={`${c.dog_name} settles fast one-on-one. We'll start at distance and close the gap.`} />
      </Field>
      <Row gap={10}>
        <Button disabled={busy || !k} onClick={send}>{busy ? 'Sending…' : `Offer ${k ? `for ${k.credits} credits` : ''}`}</Button>
        <ErrorLine>{error}</ErrorLine>
      </Row>
    </section>
  );
}

/** How each trainer takes calls: the link (meeting or Calendly), a focus line, phone calls, and open times. */
function Setup({ settings, slots, reload }: { settings: IntakeSetting[]; slots: IntakeSlot[]; reload: () => void }) {
  const { staff, gym } = usePartner();
  const [sel, setSel] = useState(staff.trainer_id ?? settings[0]?.trainer_id);
  const s = settings.find((x) => x.trainer_id === sel) ?? settings[0];
  if (!s) return <Empty>Add a trainer on Team first.</Empty>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 }}>
      {gym ? (
        <Row gap={6}>{settings.map((x) => <Chip key={x.trainer_id} on={x.trainer_id === s.trainer_id} onClick={() => setSel(x.trainer_id)}>{x.name}</Chip>)}</Row>
      ) : null}
      <Settings key={s.trainer_id} s={s} onSaved={reload} />
      {s.link && !s.calendly ? <Times key={`t-${s.trainer_id}`} s={s} slots={slots.filter((x) => x.trainer_id === s.trainer_id)} onChange={reload} /> : null}
    </div>
  );
}

function Settings({ s, onSaved }: { s: IntakeSetting; onSaved: () => void }) {
  const [link, setLink] = useState(s.link ?? '');
  const [focus, setFocus] = useState(s.focus ?? '');
  const [phone, setPhone] = useState(s.phone);
  const [active, setActive] = useState(s.link ? s.active : true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const calendly = /^https:\/\/([a-z0-9-]+\.)?calendly\.com\//i.test(link.trim());
  const dirty = link !== (s.link ?? '') || focus !== (s.focus ?? '') || phone !== s.phone || active !== (s.link ? s.active : true);
  const edit = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setSaved(false); };
  const save = async () => {
    setBusy(true); setError(null);
    try { await saveIntake(s.trainer_id, link, focus, phone, active); setSaved(true); onSaved(); } catch (e) { setError(errorCopy(e)); } finally { setBusy(false); }
  };
  return (
    <section className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span className="pp-label" style={{ fontWeight: 600 }}>{`${s.name} takes intake calls`}</span>
          <span className="pp-caption pp-muted">Listed under 1:1 with a specialist on Book › Skills.</span>
        </div>
        <Toggle on={active} onChange={edit(setActive)} label={`${s.name} takes intake calls`} />
      </div>
      <Field label="Meeting or Calendly link" note={calendly
        ? 'Calendly does the scheduling: members book there, and PackPass shares the dog\'s profile with you.'
        : 'Members get it 10 minutes before a video call, never earlier. Add open times below.'}>
        <input className="field" aria-label="Meeting or Calendly link" value={link} onChange={(e) => edit(setLink)(e.target.value)} placeholder="https://meet.google.com/… or https://calendly.com/…" />
      </Field>
      <Field label="Helps with" note="One line under the name, like “reactivity, new dogs”.">
        <input className="field" aria-label="Helps with" maxLength={80} value={focus} onChange={(e) => edit(setFocus)(e.target.value)} placeholder="reactivity, new dogs" />
      </Field>
      {!calendly ? <Toggle on={phone} onChange={edit(setPhone)} label="Phone calls too">Phone calls too. You call the number they give.</Toggle> : null}
      <Row gap={10}>
        <Button disabled={!dirty || busy || !link.trim()} onClick={save}>{busy ? 'Saving…' : 'Save'}</Button>
        {saved && !dirty ? <span className="pp-caption pp-muted">Saved.</span> : null}
        <ErrorLine>{error}</ErrorLine>
      </Row>
    </section>
  );
}

/** Open times for the next two weeks: pick a day and times to add; unbooked ones can be removed. */
function Times({ s, slots, onChange }: { s: IntakeSetting; slots: IntakeSlot[]; onChange: () => void }) {
  const [date, setDate] = useState(addDays(ymd(new Date()), 1));
  const [picked, setPicked] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taken = new Set(slots.filter((x) => ymd(new Date(x.starts_at)) === date).map((x) => new Date(x.starts_at).getTime()));
  const add = async () => {
    setBusy(true); setError(null);
    try { await addIntakeSlots(s.trainer_id, picked.map((h) => austin(date, h))); setPicked([]); onChange(); } catch (e) { setError(errorCopy(e)); } finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    setError(null);
    try { await removeIntakeSlot(id); onChange(); } catch (e) { setError(errorCopy(e)); }
  };
  const byDay = slots.reduce<Record<string, IntakeSlot[]>>((m, x) => { const k = ymd(new Date(x.starts_at)); (m[k] ??= []).push(x); return m; }, {});
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <h3 className="pp-title">Open times</h3>
        <span className="pp-caption pp-muted">15 minutes each. Members see the next two weeks.</span>
      </div>
      <Field label="Day"><input className="field" type="date" aria-label="Day" min={ymd(new Date())} value={date} onChange={(e) => { if (e.target.value) { setDate(e.target.value); setPicked([]); } }} style={{ width: 180 }} /></Field>
      <Row gap={6}>
        {TIMES.map((h) => {
          const has = taken.has(austin(date, h).getTime());
          return <Chip key={h} on={has || picked.includes(h)} onClick={() => !has && setPicked((p) => (p.includes(h) ? p.filter((x) => x !== h) : [...p, h]))}>{hourLabel(h)}</Chip>;
        })}
      </Row>
      <Row gap={10}>
        <Button disabled={busy || !picked.length} onClick={add}>{busy ? 'Adding…' : picked.length ? `Add ${picked.length} ${picked.length === 1 ? 'time' : 'times'}` : 'Add times'}</Button>
        <ErrorLine>{error}</ErrorLine>
      </Row>
      {Object.keys(byDay).length ? (
        <div className="tbl">
          {Object.entries(byDay).map(([k, xs]) => (
            <div key={k} className="tbl-row" style={{ gridTemplateColumns: '120px minmax(0,1fr)', minHeight: 48, alignItems: 'center' }}>
              <span className="pp-label">{day(new Date(xs[0].starts_at))}</span>
              <Row gap={6}>
                {xs.map((x) => (
                  <span key={x.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    <Badge tone={x.booked ? 'cleared' : 'neutral'}>{`${time(new Date(x.starts_at))}${x.booked ? ' · booked' : ''}`}</Badge>
                    {!x.booked ? <IconButton icon={Trash2} label={`Remove ${day(new Date(x.starts_at))} ${time(new Date(x.starts_at))}`} onClick={() => remove(x.id)} /> : null}
                  </span>
                ))}
              </Row>
            </div>
          ))}
        </div>
      ) : <span className="pp-caption pp-muted">No open times yet.</span>}
    </section>
  );
}
