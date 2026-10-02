import { useState } from 'react';

import { errorCopy, loadNotes, sendNote, type NoteRow } from '@/lib/api';
import { useData, usePartner } from '@/lib/partner';
import { monthDay, time, weekday, ymd } from '@/lib/time';
import { useSigned } from '@/lib/useSigned';
import { Avatar, Button, Chip, ErrorLine, Tag } from '@/ui/kit';
import { Empty, Loading } from './Overview';

const SKILLS = ['Recall', 'Stop', 'Focus', 'Gate wait', 'Loose leash', 'Settle', 'Confidence', 'Play manners'];
const BALANCE: Record<string, string> = { physical: 'Physical', mental: 'Mental', social: 'Social' };

/** 05 Session notes: a short note per dog after each session, sent to the owner's training log. */
export function Notes() {
  const { classes } = usePartner();
  const { data, reload } = useData(() => loadNotes(7), []);
  const [picked, setPicked] = useState<string | null>(null);
  const photos = useSigned('dog-photos', data?.map((n) => n.photo_path) ?? []);
  if (!data) return <Loading />;

  // One tab per session that ran in the last week; start on the one with the most notes due.
  const bySession = new Map<string, NoteRow[]>();
  for (const n of data) bySession.set(n.session_id, [...(bySession.get(n.session_id) ?? []), n]);
  const sessions = [...bySession.entries()];
  const due = (rows: NoteRow[]) => rows.filter((r) => !r.note).length;
  const current = (picked && bySession.get(picked)) ? picked : sessions.sort((a, b) => due(b[1]) - due(a[1]) || (a[1][0].starts_at < b[1][0].starts_at ? 1 : -1))[0]?.[0];
  if (!current) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1040 }}>
      <h1 className="pk-display-xl" style={{ margin: 0 }}>Session notes</h1>
      <Empty>No sessions in the last week yet. Notes open here once a session has run.</Empty>
    </div>
  );
  const rows = bySession.get(current)!;
  const first = rows[0];
  const start = new Date(first.starts_at);
  const cls = classes.find((c) => c.title === first.class_title);
  const sent = rows.filter((r) => r.note).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 1040 }}>
      {sessions.length > 1 ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[...bySession.entries()].map(([id, r]) => {
            const d = new Date(r[0].starts_at);
            const n = due(r);
            return <Chip key={id} on={id === current} onClick={() => setPicked(id)}>{`${ymd(d) === ymd(new Date()) ? 'Today' : weekday(d).slice(0, 3)} ${time(d)} · ${r[0].class_title}${n ? ` · ${n} due` : ''}`}</Chip>;
          })}
        </div>
      ) : null}
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="pk-wide pk-muted">{`Session notes · ${ymd(start) === ymd(new Date()) ? 'Today' : monthDay(start)} ${time(start)}`}</span>
          <h1 className="pk-display-xl" style={{ margin: 0 }}>{first.class_title}</h1>
          <span className="pk-label pk-muted">Notes appear in each dog's training log. Keep them short and specific.</span>
          {cls ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}><span className="pk-caption pk-muted">Counts toward the month as</span><Tag>{BALANCE[cls.balance]}</Tag></div> : null}
        </div>
        <span className="pk-display-md">{`${sent} of ${rows.length} sent`}</span>
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((r) => <NoteCard key={r.booking_id} r={r} photo={r.photo_path ? photos[r.photo_path] : undefined} onSent={() => { setPicked(current); reload(); }} />)}
      </div>
    </div>
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
    <div style={{ display: 'grid', gridTemplateColumns: '64px minmax(0,1fr)', gap: 18, padding: 18, borderRadius: 28, background: 'var(--surface-raised)' }}>
      <Avatar name={r.dog_name} photo={photo} size={64} radius={12} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span className="pk-title">{r.dog_name}</span><span className="pk-caption pk-muted">{`${r.breed ?? 'Dog'} · ${r.owner_name}`}</span></div>
          {!editing ? <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Tag>Sent</Tag><button className="link" onClick={() => setEditing(true)}>Edit</button></div> : null}
        </div>
        {editing ? (
          <textarea className="area" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={`What did ${r.dog_name} do well? What should ${r.dog_name} work on?`} style={{ background: 'var(--bg)' }} />
        ) : <p className="pk-body" style={{ margin: 0, textWrap: 'pretty' }}>{`“${r.note}”`}</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {(editing ? SKILLS : skills).map((s) => <Chip key={s} on={skills.includes(s)} onClick={() => toggle(s)}>{s}</Chip>)}
          {editing ? <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}><ErrorLine>{error}</ErrorLine><Button size="sm" disabled={busy || note.trim().length < 3} onClick={send}>{busy ? 'Sending…' : r.note ? 'Save note' : 'Send to owner'}</Button></span> : null}
        </div>
      </div>
    </div>
  );
}
