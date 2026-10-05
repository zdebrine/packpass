import { Check, ShieldCheck, UserRound, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { errorCopy, saveClass } from '@/lib/api';
import { emptyForm, estimate, payloadOf, TYPES, type ClassForm } from '@/lib/classForm';
import { usePartner } from '@/lib/partner';
import { Button, ClassCard, Chip, ErrorLine, Field, Row, Tag, photoUrl } from '@/ui/kit';
import { UploadNote } from './Classes';
import { Clearance, Description, Discipline, DropOff, Duration, Energy, Group, Intensity, Name, PhotoGrid, Requirements, Social, typeLabel, type Patch } from './classParts';

const STEPS: [string, string][] = [['Basics', 'Type, name, photo'], ['Format', 'Length, size, who leads'], ['Who it’s for', 'Fit and requirements'], ['Review', 'Send to PackPass']];
const TYPE_ICON = { class: Users, private: UserRound, assessment: ShieldCheck };

/** 03b Create a class: four steps, then the class goes to PackPass for a credit review. */
export function NewClass() {
  const { partner, gym, trainers, staff, reloadCatalog, trainerName } = usePartner();
  const nav = useNavigate();
  const [f, setF] = useState<ClassForm>(() => emptyForm(staff.trainer_id ?? trainers[0]?.id ?? null));
  const set: Patch = (p) => setF((x) => ({ ...x, ...p }));
  const [step, setStep] = useState(0);
  const [sentId, setSentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upload, setUpload] = useState(false);

  const group = f.type === 'class' ? f.group : 1;
  const needs = [
    [[f.title.trim().length < 3, 'Add a class name'], [!f.discipline, 'Pick a discipline'], [!f.image, 'Choose a cover photo']],
    [[f.description.trim().length < 20, 'Describe the session in a sentence or two']],
    [[!f.energy.length, 'Pick at least one energy level'], [group > 1 && !f.social.length, 'Pick who it suits around other dogs']],
    [],
  ].map((a) => (a as [boolean, string][]).filter((x) => x[0]).map((x) => x[1]));
  const firstGap = needs.findIndex((a) => a.length);
  const reach = firstGap === -1 ? 3 : firstGap;
  const missing = needs[step];
  const est = estimate(f);
  const card = (
    <ClassCard image={photoUrl(f.image)} discipline={f.discipline ?? typeLabel(f.type)} title={f.title.trim() || 'Class name'}
      meta={`${f.duration} min · ${partner.short_name || partner.name}`} credits={`${est} credit${est > 1 ? 's' : ''}`} spotsLeft={group} />
  );

  const next = async () => {
    if (missing.length) return;
    if (step < 3) return setStep(step + 1);
    setBusy(true); setError(null);
    try {
      const id = await saveClass(null, payloadOf(f));
      await reloadCatalog();
      setSentId(id);
    } catch (e) { setError(errorCopy(e)); } finally { setBusy(false); }
  };
  const again = () => { setF(emptyForm(f.trainerId)); setStep(0); setSentId(null); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 1240 }}>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="pk-wide pk-muted">Classes · New</span>
          <h1 className="pk-display-xl" style={{ margin: 0, whiteSpace: 'nowrap' }}>Create a class</h1>
        </div>
        <Button variant="quiet" size="sm" onClick={() => nav('/classes')}>{sentId ? 'Done' : 'Cancel'}</Button>
      </header>

      {sentId ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
          <div className="card" style={{ flex: '999 1 480px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18, padding: 32 }}>
            <span style={{ width: 56, height: 56, borderRadius: 9999, background: 'var(--inverse)', color: 'var(--on-inverse)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={26} /></span>
            <h2 className="pk-display-lg" style={{ margin: 0 }}>{`${f.title.trim()} is in review.`}</h2>
            <p className="pk-body" style={{ margin: 0, maxWidth: 560, textWrap: 'pretty' }}>PackPass reviews new classes and sets the credit cost within 2 business days. The class opens on Book, and you can schedule sessions, once it's live.</p>
            <Row style={{ paddingTop: 6 }}>
              <Button onClick={() => nav(`/classes?c=${sentId}`)}>See it in Classes</Button>
              <Button variant="quiet" style={{ background: 'var(--bg)' }} onClick={again}>Create another</Button>
            </Row>
          </div>
          <div style={{ flex: '1 1 280px', maxWidth: 300, minWidth: 0 }}>{card}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
          <nav aria-label="Steps" style={{ flex: '1 1 210px', maxWidth: 250, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {STEPS.map(([label, sub], i) => {
              const on = i === step, done = i < step && !needs[i].length, open = i <= reach;
              return (
                <button key={label} type="button" onClick={() => open && setStep(i)} aria-current={on ? 'step' : undefined} disabled={!open}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px 10px 10px', border: 0, borderRadius: 20, cursor: open ? 'pointer' : 'default', background: on ? 'var(--inverse)' : 'transparent', color: on ? 'var(--on-inverse)' : open ? 'var(--ink)' : 'var(--ink-faint)' }}>
                  <span style={{ width: 32, height: 32, flex: 'none', borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, background: on ? 'rgba(255,255,255,.16)' : 'var(--surface-raised)' }}>{done ? <Check size={16} /> : i + 1}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left', minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
                    <span style={{ fontSize: 12, opacity: 0.7, whiteSpace: 'nowrap' }}>{sub}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div style={{ flex: '999 1 440px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 28 }}>
            {step === 0 ? (
              <>
                <Field label="Session type">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8 }}>
                    {TYPES.map((t) => {
                      const on = f.type === t.key, Icon = TYPE_ICON[t.key];
                      return (
                        <button key={t.key} type="button" aria-pressed={on} onClick={() => set({ type: t.key, clearance: null })}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: 16, border: 0, borderRadius: 20, cursor: 'pointer', textAlign: 'left', background: on ? 'var(--inverse)' : 'var(--surface-raised)', color: on ? 'var(--on-inverse)' : 'var(--ink)' }}>
                          <Icon size={20} />
                          <span style={{ fontSize: 15, fontWeight: 600 }}>{t.label}</span>
                          <span style={{ fontSize: 12, lineHeight: '16px', opacity: 0.75, textWrap: 'pretty' }}>{t.note}</span>
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Name f={f} set={set} placeholder="Say what the dog does, like Scent Work I" />
                <Discipline f={f} set={set} />
                <Field label="Cover photo" note="Outdoor, in motion, one dog clearly in frame. Members see this first.">
                  {upload ? <UploadNote /> : null}
                  <PhotoGrid value={f.image} onPick={(image) => set({ image })} onUpload={() => setUpload(true)} />
                </Field>
              </>
            ) : step === 1 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '24px 32px' }}>
                <Duration f={f} set={set} />
                <Intensity f={f} set={set} note />
                <Group f={f} set={set} />
                <Field label="Location"><Row gap={6}><Chip on>{partner.street || partner.name}</Chip></Row></Field>
                {gym ? (
                  <Field label="Lead trainer">
                    <Row gap={6}>{trainers.map((t) => <Chip key={t.id} on={f.trainerId === t.id} onClick={() => set({ trainerId: t.id })}>{t.name}</Chip>)}</Row>
                  </Field>
                ) : null}
                <Description f={f} set={set} placeholder="Walk an owner through the hour. What does the dog do first, and how does it end?" />
              </div>
            ) : step === 2 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '24px 32px' }}>
                <Energy f={f} set={set} />
                {group > 1 ? <Social f={f} set={set} /> : null}
                <Clearance f={f} set={set} />
                <Requirements f={f} set={set} />
                <DropOff f={f} set={set} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Review title="Basics" onEdit={() => setStep(0)} rows={[['Type', typeLabel(f.type)], ['Name', f.title || '—'], ['Discipline', f.discipline || '—'], ['Cover photo', f.image ? 'Chosen' : '—']]} />
                <Review title="Format" onEdit={() => setStep(1)} rows={[
                  ['Duration', `${f.duration} min`], ['Intensity', `${f.intensity} of 5`], ['Group size', `${group} ${group === 1 ? 'dog' : 'dogs'}`], ['Location', partner.street || partner.name],
                  ...(gym ? [['Lead trainer', trainerName(f.trainerId) || '—'] as [string, string]] : []),
                ]} />
                <Review title="Who it’s for" onEdit={() => setStep(2)} rows={[
                  ['Energy', f.energy.join(', ') || '—'], ...(group > 1 ? [['With other dogs', f.social.join(', ') || '—'] as [string, string]] : []),
                  [f.type === 'assessment' ? 'Grants' : 'Requires', f.clearance === 'social' ? 'Social' : f.clearance === 'herding' ? 'Herding' : 'No clearance'], ['Requirements', f.reqs.join(', ') || 'None'],
                  ...(f.type === 'class' ? [['Owners', f.dropOff ? <Tag tone="signal">Drop-off</Tag> : 'Stay with their dog'] as [string, ReactNode]] : []),
                ]} />
                <div className="card" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span className="pk-title">What happens in the session</span>
                  <p className="pk-body" style={{ margin: 0, textWrap: 'pretty' }}>{f.description}</p>
                </div>
              </div>
            )}

            {missing.length ? <span className="pk-caption" style={{ color: 'var(--kennel-red)', fontWeight: 600 }}>{missing.join(' · ')}</span> : null}
            <Row gap={10}>
              {step > 0 ? <Button variant="quiet" onClick={() => setStep(step - 1)}>Back</Button> : null}
              <Button disabled={missing.length > 0 || busy} onClick={next}>{step === 3 ? (busy ? 'Sending…' : 'Send for review') : 'Continue'}</Button>
              <ErrorLine>{error}</ErrorLine>
            </Row>
          </div>

          <aside style={{ flex: '1 1 280px', maxWidth: 300, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 24 }}>
            <span className="pk-wide pk-muted">Member preview</span>
            {card}
            <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <span className="pk-label" style={{ fontWeight: 600 }}>Likely credit cost</span>
                <span className="pk-display-md">{`${est} credit${est > 1 ? 's' : ''}`}</span>
              </div>
              <span className="pk-caption pk-muted" style={{ textWrap: 'pretty' }}>Estimated from duration, intensity and group size. PackPass confirms it in review.</span>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function Review({ title, rows, onEdit }: { title: string; rows: [string, ReactNode][]; onEdit: () => void }) {
  return (
    <div className="card" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="pk-title">{title}</span>
        <button type="button" className="link" style={{ alignSelf: 'center', fontSize: 14 }} onClick={onEdit}>Edit</button>
      </div>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span className="pk-label pk-muted">{k}</span>
          <span className="pk-label" style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span>
        </div>
      ))}
    </div>
  );
}
