import { useRef, useState, type ReactNode } from 'react';
import { ShieldCheck, Star, Upload, UserRound } from 'lucide-react';

import { errorCopy, removePartnerPhoto, saveTrainer, setTrainerPhoto, uploadPartnerPhoto, type Trainer } from '@/lib/api';
import { usePartner } from '@/lib/partner';
import { isUpload } from '@/lib/photos';
import { Avatar, Badge, Button, Chip, EmptyState, ErrorLine, Field, Ico, Page, PageHead, Row, Toggle, photoUrl } from '@/ui/kit';

const SPECS = ['Reactivity', 'Separation', 'Leash skills', 'Puppy foundations', 'Fitness and conditioning', 'Recall', 'Scent work', 'Herding', 'Behaviorist'];

/** 08 Trainer profile: bio, specialties and private sessions for each trainer (just "Your profile" for a solo trainer). */
export function Trainers() {
  const { trainers, staff, gym, classes } = usePartner();
  const [sel, setSel] = useState(staff.trainer_id ?? trainers[0]?.id);
  const t = trainers.find((x) => x.id === sel) ?? trainers[0];
  if (!t) return (
    <Page>
      <PageHead title="Trainers" />
      <EmptyState icon={UserRound} title="No trainers yet" body="No trainers are listed for your location yet. Owners add them on Team." />
    </Page>
  );
  const teaches = (id: string) => Array.from(new Set(classes.filter((c) => c.trainer_id === id && c.status !== 'paused').map((c) => c.discipline)));

  return (
    <Page>
      <Profile key={t.id} t={t} teaches={teaches(t.id)} eyebrow={gym ? 'Trainers · Profile' : 'Your profile'}>
        {gym ? (
          <Row gap={8}>
            {trainers.map((x) => {
              const on = x.id === t.id;
              return (
                <button key={x.id} type="button" aria-pressed={on} onClick={() => setSel(x.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px 6px 6px', borderRadius: 12, cursor: 'pointer', font: 'inherit', textAlign: 'left', background: on ? 'var(--surface-raised)' : 'transparent', color: 'var(--ink)', border: `1px solid ${on ? 'var(--line-strong)' : 'var(--line)'}` }}>
                  <Avatar name={x.name} size={32} />
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span className="pp-label" style={{ fontWeight: 600 }}>{x.name}</span>
                    <span className="pp-caption pp-muted">{teaches(x.id).join(', ') || 'Trainer'}</span>
                  </span>
                </button>
              );
            })}
          </Row>
        ) : null}
      </Profile>
    </Page>
  );
}

function Profile({ t, teaches, eyebrow, children }: { t: Trainer; teaches: string[]; eyebrow: string; children?: ReactNode }) {
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
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span className="pp-caption pp-muted">{eyebrow}</span>
          <h1 className="pp-page-title">{t.name}</h1>
        </div>
        <Row gap={10}>
          {saved && !dirty ? <span className="pp-caption pp-muted">Saved.</span> : null}
          <ErrorLine>{error}</ErrorLine>
          <Button disabled={!dirty || busy} onClick={save}>{busy ? 'Saving…' : 'Save profile'}</Button>
        </Row>
      </header>
      {children}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 32, alignItems: 'start' }}>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 640 }}>
          <TrainerPhoto t={t} />
          <Field label="Bio">
            <textarea className="area" rows={4} value={bio} placeholder="How long you've trained, what you're known for, and what a session with you feels like." onChange={(e) => edit(setBio)(e.target.value)} />
          </Field>
          <Field label="Credentials" note="PackPass checks credentials before they show to members.">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
              <span className="pp-label" style={{ fontWeight: 500 }}>{t.credential || 'None listed yet'}</span>
              {t.credential ? <Badge tone="cleared" icon={ShieldCheck}>Verified</Badge> : null}
            </div>
          </Field>
          <Field label="Teaches">
            {teaches.length ? <Row gap={6}>{teaches.map((d) => <Badge key={d}>{d}</Badge>)}</Row> : <span className="pp-caption pp-muted">Set as lead trainer on a class to show here.</span>}
          </Field>
          <Field label="Specialties" note="Owners find you through specialties on training paths. PackPass checks credentials before Behaviorist goes live.">
            <Row gap={6}>{SPECS.map((s) => <Chip key={s} on={specs.includes(s)} onClick={() => edit(setSpecs)(specs.includes(s) ? specs.filter((x) => x !== s) : [...specs, s])}>{s}</Chip>)}</Row>
          </Field>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 0', borderTop: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="pp-label" style={{ fontWeight: 600 }}>Private 1:1 sessions</span>
              <span className="pp-caption pp-muted">Listed as Private on Book and on training paths. Credit cost set by PackPass.</span>
            </div>
            <Toggle on={priv} onChange={edit(setPriv)} label="Private 1:1 sessions" />
          </div>
        </div>
        <aside style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="pp-caption pp-muted">How members see it</span>
          <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar name={t.name} size={44} photo={t.photo_url ? photoUrl(t.photo_url) : null} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span className="pp-label" style={{ fontWeight: 600 }}>{t.name}</span>
                {t.credential ? <span className="pp-caption pp-muted">{t.credential}</span> : null}
              </div>
              {t.rating ? <span className="pp-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}><Ico icon={Star} size={14} />{Number(t.rating).toFixed(1)}</span> : null}
            </div>
            {specs.length ? <span className="pp-caption" style={{ fontWeight: 500 }}>{specs.join(' · ')}</span> : null}
            {bio.trim() ? <p className="pp-body pp-muted" style={{ margin: 0, textWrap: 'pretty' }}>{bio.trim()}</p> : null}
          </div>
        </aside>
      </div>
    </>
  );
}

/** The trainer's photo: upload a new one (cropped square in the browser); the previous upload is deleted. */
function TrainerPhoto({ t }: { t: Trainer }) {
  const { partner, reloadCatalog } = usePartner();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError(null);
    let path: string | null = null;
    try {
      path = await uploadPartnerPhoto(partner.id, file, 'portrait');
      await setTrainerPhoto(t.id, path);
      await removePartnerPhoto(t.photo_url).catch(() => undefined);
      await reloadCatalog();
    } catch (e) {
      if (path) await removePartnerPhoto(path).catch(() => undefined);
      setError(errorCopy(e));
    } finally { setBusy(false); if (input.current) input.current.value = ''; }
  };
  return (
    <Row gap={16} wrap={false}>
      <Avatar name={t.name} size={72} photo={t.photo_url ? photoUrl(t.photo_url) : null} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
        <span className="pp-caption pp-muted" style={{ textWrap: 'pretty' }}>Your photo shows on class pages and booking confirmations. A clear, friendly headshot works best.</span>
        <Button size="sm" variant="outline" icon={Upload} disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Uploading…' : isUpload(t.photo_url) ? 'Change photo' : 'Upload a photo'}</Button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files?.[0])} />
        <ErrorLine>{error}</ErrorLine>
      </div>
    </Row>
  );
}
