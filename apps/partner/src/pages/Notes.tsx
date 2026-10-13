import { Check, Send } from 'lucide-react';
import { useState } from 'react';

import { errorCopy, loadNotes, sendNote, type NoteRow } from '@/lib/api';
import { useData, usePartner } from '@/lib/partner';
import { monthDay, time, weekday, ymd } from '@/lib/time';
import { useSigned } from '@/lib/useSigned';
import { Avatar, Badge, Button, Chip, ErrorLine, Field, Page, Row } from '@/ui/kit';
import { Empty, Loading } from './Overview';

const SKILLS = ['Recall', 'Stop', 'Focus', 'Gate wait', 'Loose leash', 'Settle', 'Confidence', 'Play manners'];
const BALANCE: Record<string, string> = { physical: 'Physical', mental: 'Mental', social: 'Social' };

/** 05 Session notes: a short note per dog after each session, sent to the owner's training log. */
export function Notes() {
  const { classes } = usePartner();
  const { data, reload } = useData(() => loadNotes(7), []);
  const [picked, setPicked] = useState<string | null>(null);
  const [dog, setDog] = useState<string | null>(null);
  const photos = useSigned('dog-photos', data?.map((n) => n.photo_path) ?? []);
  if (!data) return <Loading />;

  // One tab per session that ran in the last week; start on the one with the most notes due.
  const bySession = new Map<string, NoteRow[]>();
  for (const n of data) bySession.set(n.session_id, [...(bySession.get(n.session_id) ?? []), n]);
  const sessions = [...bySession.entries()];
  const due = (rows: NoteRow[]) => rows.filter((r) => !r.note).length;
  const current = (picked && bySession.get(picked)) ? picked : sessions.sort((a, b) => due(b[1]) - due(a[1]) || (a[1][0].starts_at < b[1][0].starts_at ? 1 : -1))[0]?.[0];
  if (!current) return (
    <Page gap={16}>
      <h1 className="pp-page-title">Session notes</h1>
      <Empty>No sessions in the last week yet. Notes open here once a session has run.</Empty>
    </Page>
  );
  const rows = bySession.get(current)!;
  const first = rows[0];
  const start = new Date(first.starts_at);
  const cls = classes.find((c) => c.title === first.class_title);
  const sent = rows.filter((r) => r.note).length;

  const sel = rows.find((r) => r.booking_id === dog) ?? rows.find((r) => !r.note) ?? rows[0];
  const afterSend = () => {
    setPicked(current);
    const next = rows.find((r) => r.booking_id !== sel.booking_id && !r.note);
    if (next) setDog(next.booking_id);
    reload();
  };

  return (
    <Page gap={20}>
      {sessions.length > 1 ? (
        <Row gap={6}>
          {[...bySession.entries()].map(([id, r]) => {
            const d = new Date(r[0].starts_at);
            const n = due(r);
            return <Chip key={id} on={id === current} onClick={() => { setPicked(id); setDog(null); }}>{`${ymd(d) === ymd(new Date()) ? 'Today' : weekday(d).slice(0, 3)} ${time(d)} · ${r[0].class_title}${n ? ` · ${n} due` : ''}`}</Chip>;
          })}
        </Row>
      ) : null}
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="pp-caption pp-muted">{`Session notes · ${ymd(start) === ymd(new Date()) ? 'Today' : monthDay(start)} ${time(start)}`}</span>
          <h1 className="pp-page-title">{first.class_title}</h1>
          <span className="pp-caption pp-muted">Notes appear in each dog's training log. Keep them short and specific.</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {cls ? <><span className="pp-caption pp-muted">Counts toward the month as</span><Badge>{BALANCE[cls.balance]}</Badge></> : null}
          <span className="pp-label pp-num" style={{ marginLeft: 12 }}>{`${sent} of ${rows.length} sent`}</span>
        </div>
      </header>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
        <div className="tbl" style={{ flex: '1 1 260px', maxWidth: 360 }}>
          {rows.map((r) => {
            const on = r.booking_id === sel.booking_id;
            return (
              <div key={r.booking_id} role="button" tabIndex={0} aria-current={on} className="tbl-row tbl-click" onClick={() => setDog(r.booking_id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setDog(r.booking_id)}
                style={{ gridTemplateColumns: '36px minmax(0,1fr) auto', background: on ? 'var(--hover)' : undefined, boxShadow: on ? 'inset 2px 0 0 var(--ink),inset 0 -1px 0 var(--line)' : undefined }}>
                <Avatar name={r.dog_name} photo={r.photo_path ? photos[r.photo_path] : undefined} size={36} radius={8} />
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}><span className="pp-heading">{r.dog_name}</span><span className="pp-caption pp-muted ellipsis">{`${r.breed ?? 'Dog'} · ${r.owner_name}`}</span></div>
                {r.note ? <Badge icon={Check}>Sent</Badge> : <Badge tone="needs">Due</Badge>}
              </div>
            );
          })}
        </div>
        <NoteCard key={sel.booking_id} r={sel} photo={sel.photo_path ? photos[sel.photo_path] : undefined} onSent={afterSend} />
      </div>
    </Page>
  );
}

function NoteCard({ r, photo, onSent }: { r: NoteRow; photo?: string; onSent: () => void }) {
  const [editing, setEditing] = useState(!r.note);
  const [note, setNote] = useState(r.note ?? '');
  const [skills, setSkills] = useState<string[]>(r.skills);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    setBusy(true); setError(null);
    try { await sendNote(r.booking_id, note, skills); setEditing(false); onSent(); } catch (e) { setError(errorCopy(e)); } finally { setBusy(false); }
  };
  const toggle = (s: string) => editing && setSkills((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]));
  return (
    <div className="card" style={{ flex: '999 1 420px', minWidth: 0, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar name={r.dog_name} photo={photo} size={48} radius={12} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}><span className="pp-title">{r.dog_name}</span><span className="pp-caption pp-muted">{`${r.breed ?? 'Dog'} · ${r.owner_name}`}</span></div>
        {!editing ? <Row gap={10} wrap={false}><Badge icon={Check}>Sent to owner</Badge><button className="link" onClick={() => setEditing(true)}>Edit</button></Row> : null}
      </div>
      {editing ? (
        <Field label="Note to owner">
          <textarea className="area" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={`What did ${r.dog_name} do well? What should ${r.dog_name} work on?`} />
        </Field>
      ) : <p className="pp-body" style={{ padding: '12px 0', boxShadow: 'inset 0 1px 0 var(--line),inset 0 -1px 0 var(--line)', textWrap: 'pretty' }}>{`“${r.note}”`}</p>}
      <Field label="Skills worked on">
        <Row gap={6}>{(editing ? SKILLS : skills).map((s) => <Chip key={s} on={skills.includes(s)} onClick={() => toggle(s)}>{s}</Chip>)}</Row>
      </Field>
      {editing ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
          <ErrorLine>{error}</ErrorLine>
          <Button icon={Send} disabled={busy || note.trim().length < 3} onClick={send}>{busy ? 'Sending…' : r.note ? 'Save note' : 'Send to owner'}</Button>
        </div>
      ) : null}
    </div>
  );
}
