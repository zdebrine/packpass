import { useState } from 'react';

import { errorCopy, saveTrainer, type Trainer } from '@/lib/api';
import { usePartner } from '@/lib/partner';
import { Avatar, Button, Chip, ErrorLine, Field, Row, Tag, Toggle } from '@/ui/kit';

const SPECS = ['Reactivity', 'Separation', 'Puppy foundations', 'Fitness and conditioning', 'Recall', 'Scent work', 'Herding', 'Behaviorist'];

/** 08 Trainer profile: bio, specialties and private sessions for each trainer (just "Your profile" for a solo trainer). */
export function Trainers() {
  const { trainers, staff, gym, classes } = usePartner();
  const [sel, setSel] = useState(staff.trainer_id ?? trainers[0]?.id);
  const t = trainers.find((x) => x.id === sel) ?? trainers[0];
  if (!t) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 className="pk-display-xl" style={{ margin: 0 }}>Trainers</h1>
      <span className="pk-body pk-muted">No trainers are listed for your location yet. PackPass adds them when your account is set up.</span>
    </div>
  );
  const teaches = (id: string) => Array.from(new Set(classes.filter((c) => c.trainer_id === id && c.status !== 'paused').map((c) => c.discipline)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 1240 }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="pk-wide pk-muted">{gym ? 'Trainers · Profile' : 'Your profile'}</span>
        <h1 className="pk-display-xl" style={{ margin: 0 }}>{t.name}</h1>
      </header>
      {gym ? (
        <Row gap={10}>
          {trainers.map((x) => {
            const on = x.id === t.id;
            return (
              <button key={x.id} type="button" aria-pressed={on} onClick={() => setSel(x.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px 8px 8px', border: 0, borderRadius: 9999, cursor: 'pointer', background: on ? 'var(--inverse)' : 'var(--surface-raised)', color: on ? 'var(--on-inverse)' : 'var(--ink)' }}>
                <Avatar name={x.name} size={36} />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{x.name}</span>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>{teaches(x.id).join(', ') || 'Trainer'}</span>
                </span>
              </button>
            );
          })}
        </Row>
      ) : null}
      <Profile key={t.id} t={t} teaches={teaches(t.id)} />
    </div>
  );
}

function Profile({ t, teaches }: { t: Trainer; teaches: string[] }) {
  const { reloadCatalog } = usePartner();
  const [bio, setBio] = useState(t.bio ?? '');
  const [specs, setSpecs] = useState<string[]>(t.specialties);
  const [priv, setPriv] = useState(t.private_sessions);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = bio !== (t.bio ?? '') || priv !== t.private_sessions || specs.join() !== t.specialties.join();
  const edit = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setSaved(false); };

  const save = async () => {
    setBusy(true); setError(null);
    try { await saveTrainer(t.id, bio, specs, priv); await reloadCatalog(); setSaved(true); } catch (e) { setError(errorCopy(e)); } finally { setBusy(false); }
  };

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
        <div style={{ flex: '999 1 480px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Row gap={20} wrap={false}>
            <Avatar name={t.name} size={112} />
            <span className="pk-label pk-muted" style={{ textWrap: 'pretty' }}>Your photo shows on class pages and booking confirmations. Send a new one to PackPass to change it.</span>
          </Row>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="pk-label" style={{ fontWeight: 600 }}>Bio</span>
            <textarea className="area" rows={4} value={bio} placeholder="How long you've trained, what you're known for, and what a session with you feels like." onChange={(e) => edit(setBio)(e.target.value)} />
          </label>
          <Field label="Credentials" note="PackPass checks credentials before they show to members.">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '14px 18px', borderRadius: 20, background: 'var(--surface-raised)' }}>
              <span className="pk-label" style={{ fontWeight: 600 }}>{t.credential || 'None listed yet'}</span>
              {t.credential ? <span className="pk-caption pk-muted">Verified</span> : null}
            </div>
          </Field>
          <Field label="Teaches">
            {teaches.length ? <Row gap={6}>{teaches.map((d) => <Tag key={d}>{d}</Tag>)}</Row> : <span className="pk-caption pk-muted">Set as lead trainer on a class to show here.</span>}
          </Field>
          <Field label="Specialties" note="Owners find you through specialties on training paths. PackPass checks credentials before Behaviorist goes live.">
            <Row gap={6}>{SPECS.map((s) => <Chip key={s} on={specs.includes(s)} onClick={() => edit(setSpecs)(specs.includes(s) ? specs.filter((x) => x !== s) : [...specs, s])}>{s}</Chip>)}</Row>
          </Field>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px', borderRadius: 20, background: 'var(--surface-raised)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="pk-label" style={{ fontWeight: 600 }}>Private 1:1 sessions</span>
              <span className="pk-caption pk-muted">Listed as Private on Book and on training paths. Credit cost set by PackPass.</span>
            </div>
            <Toggle on={priv} onChange={edit(setPriv)} label="Private 1:1 sessions" />
          </div>
        </div>
        <aside style={{ flex: '1 1 300px', maxWidth: 420, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="pk-wide pk-muted">How members see it</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 18, borderRadius: 28, background: 'var(--surface-raised)' }}>
            <Avatar name={t.name} size={56} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
              <span className="pk-heading" style={{ fontWeight: 600 }}>{t.name}</span>
              {t.credential ? <span className="pk-caption pk-muted">{t.credential}</span> : null}
              {specs.length ? <span className="pk-caption" style={{ fontWeight: 600 }}>{specs.join(' · ')}</span> : null}
            </div>
            {t.rating ? <span className="pk-label" style={{ fontWeight: 600 }}>{Number(t.rating).toFixed(1)}</span> : null}
          </div>
          {bio.trim() ? <p className="pk-body" style={{ margin: '8px 0 0', textWrap: 'pretty' }}>{bio.trim()}</p> : null}
        </aside>
      </div>
      <Row gap={10}>
        <Button disabled={!dirty || busy} onClick={save}>{busy ? 'Saving…' : 'Save profile'}</Button>
        {saved && !dirty ? <span className="pk-label pk-muted">Saved.</span> : null}
        <ErrorLine>{error}</ErrorLine>
      </Row>
    </>
  );
}
