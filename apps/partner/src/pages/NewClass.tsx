import { Check, ShieldCheck, UserRound, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { errorCopy, saveClass } from '@/lib/api';
import { emptyForm, estimate, payloadOf, TYPES, type ClassForm } from '@/lib/classForm';
import { usePartner } from '@/lib/partner';
import { Badge, Button, ClassCard, Chip, ErrorLine, Field, Ico, Page, Row, photoUrl } from '@/ui/kit';
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
    <Page>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="pp-caption pp-muted">Classes</span>
          <h1 className="pp-page-title">Create a class</h1>
        </div>
        <Button variant="outline" onClick={() => nav('/classes')}>{sentId ? 'Done' : 'Cancel'}</Button>
      </header>

      {sentId ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
          <div className="card" style={{ flex: '1 1 400px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14, padding: 28 }}>
            <span style={{ width: 40, height: 40, borderRadius: 9999, background: 'var(--pitch)', color: 'var(--on-pitch)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={20} /></span>
            <h2 className="pp-headline">{`${f.title.trim()} is in review.`}</h2>
            <p className="pp-body pp-muted" style={{ margin: 0, maxWidth: 560, textWrap: 'pretty' }}>PackPass reviews new classes and sets the credit cost within 2 business days. The class opens on Book, and you can schedule sessions, once it's live.</p>
            <Row style={{ paddingTop: 4 }}>
              <Button onClick={() => nav(`/classes?c=${sentId}`)}>See it in Classes</Button>
              <Button variant="outline" onClick={again}>Create another</Button>
            </Row>
          </div>
          <div style={{ flex: '0 0 232px' }}>{card}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
          <nav aria-label="Steps" style={{ flex: '0 0 180px', display: 'flex', flexDirection: 'column', gap: 2, position: 'sticky', top: 24 }}>
            {STEPS.map(([label, sub], i) => {
              const on = i === step, done = i < step && !needs[i].length, open = i <= reach;
              return (
                <button key={label} type="button" onClick={() => open && setStep(i)} aria-current={on ? 'step' : undefined} disabled={!open}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '6px 8px', border: 0, borderRadius: 8, font: 'inherit', textAlign: 'left', cursor: open ? 'pointer' : 'default', background: on ? 'var(--surface-raised)' : 'transparent', color: on || open ? 'var(--ink)' : 'var(--ink-faint)' }}>
                  <span style={{ width: 24, height: 24, flex: 'none', borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, background: on ? 'var(--inverse)' : 'transparent', color: on ? 'var(--on-inverse)' : 'inherit', boxShadow: on ? 'none' : 'inset 0 0 0 1px var(--line-strong)' }}>{done ? <Check size={13} /> : i + 1}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span className="pp-label">{label}</span>
                    <span className="pp-caption" style={{ opacity: 0.75, whiteSpace: 'nowrap' }}>{sub}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div style={{ flex: '1 1 360px', minWidth: 0, maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {step === 0 ? (
              <>
                <Field label="Session type">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
                    {TYPES.map((t) => {
                      const on = f.type === t.key, Icon = TYPE_ICON[t.key];
                      return (
                        <button key={t.key} type="button" aria-pressed={on} onClick={() => set({ type: t.key, clearance: null })}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: 14, border: 0, borderRadius: 12, cursor: 'pointer', font: 'inherit', textAlign: 'left', background: 'var(--surface)', color: 'var(--ink)', boxShadow: on ? 'inset 0 0 0 1.5px var(--ink)' : 'inset 0 0 0 1px var(--line)' }}>
                          <Ico icon={Icon} size={20} />
                          <span className="pp-heading">{t.label}</span>
                          <span className="pp-caption pp-muted" style={{ textWrap: 'pretty' }}>{t.note}</span>
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Name f={f} set={set} placeholder="Say what the dog does, like Scent Work I" />
                <Discipline f={f} set={set} />
                <Field label="Cover photo" note="Outdoor, in motion, one dog clearly in frame. Members see this first.">
                  <PhotoGrid value={f.image} onPick={(image) => set({ image })} />
                </Field>
              </>
            ) : step === 1 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '20px 24px' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '20px 24px' }}>
                <Energy f={f} set={set} />
                {group > 1 ? <Social f={f} set={set} /> : null}
                <Clearance f={f} set={set} />
                <Requirements f={f} set={set} />
                <DropOff f={f} set={set} />
              </div>
            ) : (
              <div style={{ borderRadius: 16, boxShadow: 'inset 0 0 0 1px var(--line)', overflow: 'hidden' }}>
                <Review title="Basics" onEdit={() => setStep(0)} rows={[['Type', typeLabel(f.type)], ['Name', f.title || '—'], ['Discipline', f.discipline || '—'], ['Cover photo', f.image ? 'Chosen' : '—']]} />
                <Review title="Format" onEdit={() => setStep(1)} rows={[
                  ['Duration', `${f.duration} min`], ['Intensity', `${f.intensity} of 5`], ['Group size', `${group} ${group === 1 ? 'dog' : 'dogs'}`], ['Location', partner.street || partner.name],
                  ...(gym ? [['Lead trainer', trainerName(f.trainerId) || '—'] as [string, string]] : []),
                ]} />
                <Review title="Who it’s for" onEdit={() => setStep(2)} rows={[
                  ['Energy', f.energy.join(', ') || '—'], ...(group > 1 ? [['With other dogs', f.social.join(', ') || '—'] as [string, string]] : []),
                  [f.type === 'assessment' ? 'Grants' : 'Requires', f.clearance === 'social' ? 'Social' : f.clearance === 'herding' ? 'Herding' : 'No clearance'], ['Requirements', f.reqs.join(', ') || 'None'],
                  ...(f.type === 'class' ? [['Owners', f.dropOff ? <Badge>Drop-off</Badge> : 'Stay with their dog'] as [string, ReactNode]] : []),
                ]} />
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span className="pp-title">What happens in the session</span>
                  <p className="pp-body" style={{ margin: 0, textWrap: 'pretty' }}>{f.description}</p>
                </div>
              </div>
            )}

            {missing.length ? <span className="pp-caption" style={{ color: 'var(--kennel-red)' }}>{missing.join(' · ')}</span> : null}
            <Row gap={8}>
              {step > 0 ? <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button> : null}
              <Button disabled={missing.length > 0 || busy} onClick={next}>{step === 3 ? (busy ? 'Sending…' : 'Send for review') : 'Continue'}</Button>
              <ErrorLine>{error}</ErrorLine>
            </Row>
          </div>

          <aside style={{ flex: '0 0 232px', display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 24 }}>
            <span className="pp-caption pp-muted">Member preview</span>
            {card}
            <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <span className="pp-label">Likely credit cost</span>
                <span className="pp-title pp-num">{`${est} credit${est > 1 ? 's' : ''}`}</span>
              </div>
              <span className="pp-caption pp-muted" style={{ textWrap: 'pretty' }}>Estimated from duration, intensity and group size. PackPass confirms it in review.</span>
            </div>
          </aside>
        </div>
      )}
    </Page>
  );
}

function Review({ title, rows, onEdit }: { title: string; rows: [string, ReactNode][]; onEdit: () => void }) {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, boxShadow: 'inset 0 -1px 0 var(--line)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span className="pp-title">{title}</span>
        <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>
      </div>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span className="pp-caption pp-muted">{k}</span>
          <span className="pp-label" style={{ textAlign: 'right' }}>{v}</span>
        </div>
      ))}
    </div>
  );
}
