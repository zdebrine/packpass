import { Check, CirclePlay, Send } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { errorCopy, loadHomeworkOptions, loadReportCards, sendReportCard, type Homework, type HomeworkOption, type ReportRow } from '@/lib/api';
import { useData, usePartner } from '@/lib/partner';
import { monthDay, time, weekday, ymd } from '@/lib/time';
import { useSigned } from '@/lib/useSigned';
import { Avatar, Badge, Button, Chip, ErrorLine, Field, Page, Row, Segmented, type BadgeTone } from '@/ui/kit';
import { Empty, Loading } from './Overview';

const SKILLS = ['Recall', 'Stop', 'Focus', 'Gate wait', 'Loose leash', 'Settle', 'Confidence', 'Play manners'];
const WORD: Record<number, string> = { 1: 'Working on it', 2: 'Getting there', 3: 'Strong' };
const RATINGS = ['focus', 'sociability', 'skill'] as const;
type Rating = typeof RATINGS[number];

/** What the trainer has filled in for one dog, sent or not. */
interface Draft { focus: number; sociability: number; skill: number; note: string; hw: Homework[]; custom: string; skills: string[] }

const draftOf = (r: ReportRow): Draft => ({
  focus: r.focus ?? 2, sociability: r.sociability ?? 2, skill: r.skill ?? 2, note: r.note ?? '', hw: r.homework, custom: '', skills: r.skills,
});
/** The homework as sent: the picked items, then the trainer's own line. */
const homeworkOf = (d: Draft): Homework[] => [...d.hw, ...(d.custom.trim() ? [{ text: d.custom.trim(), drill: null }] : [])].slice(0, 3);
const labelOf = (k: Rating, discipline: string) => (k === 'focus' ? 'Focus' : k === 'sociability' ? 'Sociability' : `Skill · ${discipline}`);
const first = (name: string) => name.trim().split(' ')[0];

/**
 * Report cards (v3, after Roster): per dog after class, Focus, Sociability and Skill rated 1 to 3, a one-line note and up
 * to three homework items. One dog at a time, or the whole class at once with the same homework. Owners see it as the
 * trainer note after class, and tick the homework off on Today.
 */
export function Notes() {
  const [params, setParams] = useSearchParams();
  const { data, reload } = useData(() => loadReportCards(7), []);
  const photos = useSigned('dog-photos', data?.map((n) => n.photo_path) ?? []);
  if (!data) return <Loading />;

  // One tab per session that ran in the last week; start on the one asked for, else the one with the most due.
  const bySession = new Map<string, ReportRow[]>();
  for (const n of data) bySession.set(n.session_id, [...(bySession.get(n.session_id) ?? []), n]);
  const due = (rows: ReportRow[]) => rows.filter((r) => !r.sent_at && r.status !== 'no_show').length;
  const picked = params.get('s');
  const current = (picked && bySession.has(picked)) ? picked
    : [...bySession.entries()].sort((a, b) => due(b[1]) - due(a[1]) || (a[1][0].starts_at < b[1][0].starts_at ? 1 : -1))[0]?.[0];
  if (!current) return (
    <Page gap={16}>
      <h1 className="pp-page-title">Report cards</h1>
      <Empty>No sessions in the last week yet. Report cards open here once a session has started.</Empty>
    </Page>
  );

  return (
    <Page gap={20}>
      {bySession.size > 1 ? (
        <Row gap={6}>
          {[...bySession.entries()].map(([id, r]) => {
            const d = new Date(r[0].starts_at);
            const n = due(r);
            return <Chip key={id} on={id === current} onClick={() => setParams({ s: id })}>{`${ymd(d) === ymd(new Date()) ? 'Today' : weekday(d).slice(0, 3)} ${time(d)} · ${r[0].class_title}${n ? ` · ${n} due` : ''}`}</Chip>;
          })}
        </Row>
      ) : null}
      <SessionCards key={current} rows={bySession.get(current)!} photos={photos} reload={reload} />
    </Page>
  );
}

function SessionCards({ rows, photos, reload }: { rows: ReportRow[]; photos: Record<string, string>; reload: () => void }) {
  const first0 = rows[0];
  const start = new Date(first0.starts_at);
  const present = rows.filter((r) => r.status !== 'no_show');
  const noShows = rows.filter((r) => r.status === 'no_show');
  const { data: options } = useData(() => loadHomeworkOptions(first0.session_id), [first0.session_id]);
  const [mode, setMode] = useState<'One dog' | 'Whole class'>('One dog');
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => Object.fromEntries(rows.map((r) => [r.booking_id, draftOf(r)])));
  const [sel, setSel] = useState<string | null>(present.find((r) => !r.sent_at)?.booking_id ?? present[0]?.booking_id ?? null);
  const [bulkHw, setBulkHw] = useState<Homework[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sent = present.filter((r) => r.sent_at).length;
  const update = (id: string, patch: Partial<Draft>) => setDrafts((x) => ({ ...x, [id]: { ...x[id], ...patch } }));
  const statusOf = (r: ReportRow): [string, BadgeTone] => (r.sent_at ? ['Sent', 'neutral'] : drafts[r.booking_id]?.note.trim() ? ['Draft', 'needs'] : ['Due', 'needs']);

  const send = async (ids: string[], hw?: Homework[]) => {
    setBusy(true); setError(null);
    try {
      for (const id of ids) {
        const d = drafts[id];
        await sendReportCard(id, { focus: d.focus, sociability: d.sociability, skill: d.skill, note: d.note, homework: hw ?? homeworkOf(d), skills: d.skills });
      }
      reload();
      return true;
    } catch (e) { setError(errorCopy(e)); return false; } finally { setBusy(false); }
  };

  const unsent = present.filter((r) => !r.sent_at);
  const noNote = unsent.filter((r) => !drafts[r.booking_id].note.trim()).length;

  return (
    <>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="pp-caption pp-muted">{`Report cards · ${ymd(start) === ymd(new Date()) ? 'Today' : `${weekday(start).slice(0, 3)} ${monthDay(start)}`} · ${time(start)}`}</span>
          <h1 className="pp-page-title">{first0.class_title}</h1>
          <span className="pp-caption pp-muted">{`Owners see this as the trainer note after class. ${sent} of ${present.length} sent.`}</span>
        </div>
        <Segmented label="Mode" options={['One dog', 'Whole class'] as const} value={mode} onChange={setMode} />
      </header>
      <ErrorLine>{error}</ErrorLine>
      {!present.length ? <Empty>Every dog on this session was a no-show.</Empty> : mode === 'One dog' ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
          <div className="tbl" style={{ flex: '1 1 220px', maxWidth: 300 }}>
            {present.map((r) => {
              const on = r.booking_id === sel;
              const [label, tone] = statusOf(r);
              return (
                <div key={r.booking_id} role="button" tabIndex={0} aria-current={on} className="tbl-row tbl-click" onClick={() => setSel(r.booking_id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSel(r.booking_id)}
                  style={{ gridTemplateColumns: '36px minmax(0,1fr) auto', background: on ? 'var(--hover)' : undefined, boxShadow: on ? 'inset 2px 0 0 var(--ink),inset 0 -1px 0 var(--line)' : undefined }}>
                  <Avatar name={r.dog_name} photo={r.photo_path ? photos[r.photo_path] : undefined} size={36} radius={8} />
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}><span className="pp-heading">{r.dog_name}</span><span className="pp-caption pp-muted ellipsis">{r.owner_name}</span></div>
                  <Badge tone={tone} icon={r.sent_at ? Check : undefined}>{label}</Badge>
                </div>
              );
            })}
            {noShows.map((r) => (
              <div key={r.booking_id} className="tbl-row" style={{ gridTemplateColumns: '36px minmax(0,1fr) auto', opacity: 0.7 }}>
                <Avatar name={r.dog_name} photo={r.photo_path ? photos[r.photo_path] : undefined} size={36} radius={8} />
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}><span className="pp-heading">{r.dog_name}</span><span className="pp-caption pp-muted ellipsis">No-show · no report card</span></div>
                <Badge tone="warning">No-show</Badge>
              </div>
            ))}
          </div>
          {sel && drafts[sel] ? (() => {
            const r = present.find((x) => x.booking_id === sel)!;
            const idx = present.indexOf(r);
            const next = () => setSel(present[(idx + 1) % present.length].booking_id);
            return <DogCard key={sel} r={r} d={drafts[sel]} options={options ?? []} photo={r.photo_path ? photos[r.photo_path] : undefined} busy={busy}
              onChange={(patch) => update(sel, patch)} onNext={next}
              onSend={async () => { if (await send([sel])) { const after = present.slice(idx + 1).concat(present.slice(0, idx)).find((x) => !x.sent_at && x.booking_id !== sel); if (after) setSel(after.booking_id); } }} />;
          })() : null}
        </div>
      ) : (
        <>
          <div style={{ padding: 16, borderRadius: 16, background: 'var(--surface-raised)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="pp-label">{`Homework for the whole class · ${bulkHw.length} of 3`}</span>
            <HomeworkChips options={options ?? []} picked={bulkHw} room={3} onChange={setBulkHw} />
            <span className="pp-caption pp-muted">Applies to every dog below that hasn't been sent yet. Change a single dog in One dog mode.</span>
          </div>
          <div className="tbl">
            <div className="tbl-head" style={{ gridTemplateColumns: BULK_COLS, minWidth: BULK_MIN }}>
              <span /><span>Dog</span><span>Focus</span><span>Sociability</span><span>{`Skill · ${first0.discipline}`}</span><span>Note</span><span>Status</span>
            </div>
            {present.map((r) => {
              const d = drafts[r.booking_id];
              const [label, tone] = statusOf(r);
              return (
                <div key={r.booking_id} className="tbl-row" style={{ gridTemplateColumns: BULK_COLS, minWidth: BULK_MIN, minHeight: 56 }}>
                  <Avatar name={r.dog_name} photo={r.photo_path ? photos[r.photo_path] : undefined} size={36} radius={8} />
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}><span className="pp-heading">{r.dog_name}</span><span className="pp-caption pp-muted ellipsis">{r.owner_name}</span></div>
                  {RATINGS.map((k) => <Segmented key={k} label={`${labelOf(k, r.discipline)} for ${r.dog_name}`} options={['1', '2', '3']} value={String(d[k])} onChange={(v) => update(r.booking_id, { [k]: Number(v) })} />)}
                  <input className="field" aria-label={`Note for ${r.dog_name}`} value={d.note} placeholder="One line for the owner" onChange={(e) => update(r.booking_id, { note: e.target.value })} />
                  <div><Badge tone={tone} icon={r.sent_at ? Check : undefined}>{label}</Badge></div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
            <span className="pp-caption pp-muted">{!unsent.length ? 'Every report card is sent.' : noNote ? `${noNote} without a note. They'll get ratings and homework only.` : 'Every dog has a note.'}</span>
            <Button icon={Send} disabled={busy || !unsent.length} onClick={() => send(unsent.map((r) => r.booking_id), bulkHw)}>
              {busy ? 'Sending…' : unsent.length ? `Send ${unsent.length} report card${unsent.length === 1 ? '' : 's'}` : 'All sent'}
            </Button>
          </div>
        </>
      )}
    </>
  );
}

const BULK_COLS = '36px minmax(0,1fr) 112px 112px 112px minmax(0,2fr) 88px';
const BULK_MIN = 900;

/** Drills to pick from (a play icon: it opens the drill in the member's app), plus items already on the card. */
function HomeworkChips({ options, picked, room, onChange }: { options: HomeworkOption[]; picked: Homework[]; room: number; onChange: (hw: Homework[]) => void }) {
  const extra = picked.filter((h) => !h.drill || !options.some((o) => o.drill_id === h.drill));
  const on = (h: Homework) => picked.some((p) => p.text === h.text && p.drill === h.drill);
  const toggle = (h: Homework) => onChange(on(h) ? picked.filter((p) => !(p.text === h.text && p.drill === h.drill)) : picked.length >= room ? picked : [...picked, h]);
  return (
    <Row gap={6}>
      {options.map((o) => { const h = { text: o.title, drill: o.drill_id }; return <Chip key={o.drill_id} icon={CirclePlay} on={on(h)} onClick={() => toggle(h)}>{o.title}</Chip>; })}
      {extra.map((h) => <Chip key={h.text} icon={h.drill ? CirclePlay : undefined} on onClick={() => toggle(h)}>{h.text}</Chip>)}
    </Row>
  );
}

function DogCard({ r, d, options, photo, busy, onChange, onNext, onSend }: {
  r: ReportRow; d: Draft; options: HomeworkOption[]; photo?: string; busy: boolean; onChange: (patch: Partial<Draft>) => void; onNext: () => void; onSend: () => void;
}) {
  const { partner, staff, trainerName, classById } = usePartner();
  const hw = homeworkOf(d);
  const coach = trainerName(staff.trainer_id ?? classById(r.class_id)?.trainer_id) || staff.name || partner.name;
  const owner = first(r.owner_name) || 'the owner';
  return (
    <div style={{ flex: '999 1 420px', minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
      <div className="card" style={{ flex: '3 1 380px', minWidth: 0, padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar name={r.dog_name} photo={photo} size={48} radius={12} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}><span className="pp-title">{r.dog_name}</span><span className="pp-caption pp-muted">{[r.breed ?? 'Dog', r.owner_name].filter(Boolean).join(' · ')}</span></div>
          {r.sent_at ? <Badge icon={Check}>Sent to owner</Badge> : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {RATINGS.map((k) => (
            <div key={k} style={{ display: 'grid', gridTemplateColumns: '130px auto 1fr', alignItems: 'center', gap: 12 }}>
              <span className="pp-label">{labelOf(k, r.discipline)}</span>
              <Segmented label={labelOf(k, r.discipline)} options={['1', '2', '3']} value={String(d[k])} onChange={(v) => onChange({ [k]: Number(v) })} />
              <span className="pp-caption pp-muted">{WORD[d[k]]}</span>
            </div>
          ))}
        </div>
        <Field label="Note" note="One line. It's the first thing the owner reads.">
          <input className="field" aria-label="Note" value={d.note} maxLength={280} onChange={(e) => onChange({ note: e.target.value })} placeholder={`What did ${r.dog_name} do well? What's next?`} />
        </Field>
        <Field label={`Homework · ${hw.length} of 3`} note="Items with a play icon open a step-by-step drill in the owner's app.">
          <HomeworkChips options={options} picked={d.hw} room={d.custom.trim() ? 2 : 3} onChange={(next) => onChange({ hw: next })} />
        </Field>
        <Field label="Or type your own">
          <input className="field" aria-label="Or type your own" value={d.custom} maxLength={140} disabled={!d.custom && d.hw.length >= 3} onChange={(e) => onChange({ custom: e.target.value })} placeholder="Short and doable at home" />
        </Field>
        <Field label="Skills worked on" note="Shows the note on the matching skill in the owner's Log.">
          <Row gap={6}>{SKILLS.map((s) => <Chip key={s} on={d.skills.includes(s)} onClick={() => onChange({ skills: d.skills.includes(s) ? d.skills.filter((x) => x !== s) : [...d.skills, s] })}>{s}</Chip>)}</Row>
        </Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="outline" onClick={onNext}>Next dog</Button>
          <Button icon={Send} disabled={busy} onClick={onSend}>{busy ? 'Sending…' : r.sent_at ? 'Send update' : `Send to ${first(r.owner_name) || 'owner'}`}</Button>
        </div>
      </div>
      <aside style={{ flex: '2 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="pp-caption pp-muted">{`What ${owner} sees after class`}</span>
        <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar name={coach} size={36} />
            <div style={{ display: 'flex', flexDirection: 'column' }}><span className="pp-label">{coach}</span><span className="pp-caption pp-muted">{partner.name}</span></div>
          </div>
          <p className="pp-label" style={{ textWrap: 'pretty', color: d.note.trim() ? undefined : 'var(--ink-muted)' }}>{d.note.trim() || 'Your note appears here.'}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {RATINGS.map((k) => (
              <div key={k} style={{ display: 'grid', gridTemplateColumns: '80px 72px 1fr', alignItems: 'center', gap: 10 }}>
                <span className="pp-caption">{k === 'skill' ? 'Skill' : labelOf(k, r.discipline)}</span>
                <span style={{ display: 'flex', gap: 3 }}>{[1, 2, 3].map((j) => <span key={j} style={{ flex: 1, height: 6, borderRadius: 3, background: j <= d[k] ? 'var(--ink)' : 'var(--surface-sunken)' }} />)}</span>
                <span className="pp-caption pp-muted">{WORD[d[k]]}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 12, boxShadow: 'inset 0 1px 0 var(--line)' }}>
            <span className="pp-caption pp-muted">Homework</span>
            {hw.length ? hw.map((h) => (
              <div key={h.text} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ width: 14, height: 14, marginTop: 2, borderRadius: 4, boxShadow: 'inset 0 0 0 1.5px var(--line-strong)', flex: 'none' }} />
                <span className="pp-caption">{h.text}</span>
              </div>
            )) : <span className="pp-caption pp-muted">None this week.</span>}
          </div>
        </div>
      </aside>
    </div>
  );
}
