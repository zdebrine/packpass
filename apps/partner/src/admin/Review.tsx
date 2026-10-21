import { useState } from 'react';

import { adminRemovePhoto, decideBreedOnly, errorCopy, loadAdminPathClasses, loadClearanceTypes, loadPartnerPhotos, loadPathSteps, loadReviewQueue, setClassClearance, setClassReview, setPathSteps, type AdminClearanceType, type PartnerPhoto, type PathStepOption, type ReviewClass } from '@/lib/api';
import { APTITUDES, estimateFor } from '@/lib/classForm';
import { useData } from '@/lib/partner';
import { Button, ErrorLine, Field, Row, Stepper, Tag, Toggle, photoUrl } from '@/ui/kit';
import { Empty, Loading } from '@/pages/Overview';
import { PathStepPicker, stepKey } from './Paths';

const TYPE = { class: 'Class', private: 'Private', assessment: 'Assessment' } as const;
// class_types.credits is checked to 1–8 in the schema.
const MAX_CREDITS = 8;

/** PackPass › Review: new classes waiting for a credit cost, and live classes whose pricing changed. */
export function Review() {
  const { data, reload } = useData(loadReviewQueue, []);
  const { data: steps } = useData(loadPathSteps, []);
  const { data: pathClasses } = useData(loadAdminPathClasses, []);
  const { data: clearances } = useData(loadClearanceTypes, []);
  if (!data) return <Loading />;
  // The steps each class counts for now, and the clearances to pick from; PackPass decides both while reviewing.
  const paths = { steps: steps ?? [], of: (id: string) => (pathClasses?.find((c) => c.id === id)?.steps ?? []).map(stepKey), clearances: clearances ?? [] };
  const fresh = data.filter((c) => c.status === 'in_review');
  const repriced = data.filter((c) => c.status !== 'in_review' && c.credit_review);
  const breedOnly = data.filter((c) => c.breed_only_status === 'pending');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1040, margin: '0 auto', width: '100%' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="pp-caption pp-muted">PackPass · Review</span>
        <h1 className="pp-page-title" style={{ margin: 0 }}>Classes to review</h1>
        <span className="pp-label pp-muted">Set the credit cost and put each class live. Live classes open on Book and partners can schedule them.</span>
      </header>
      {data.length ? null : <Empty>Nothing waiting. New classes and price changes from partners show up here.</Empty>}
      {fresh.length ? <Section title={`New classes · ${fresh.length}`} rows={fresh} paths={paths} onDone={reload} /> : null}
      {repriced.length ? <Section title={`Pricing changed · ${repriced.length}`} rows={repriced} paths={paths} onDone={reload} /> : null}
      {breedOnly.length ? <BreedOnly rows={breedOnly} onDone={reload} /> : null}
      <Photos />
    </div>
  );
}

/**
 * "Only these breeds" requests. Approving stops dogs outside the class's Built for breeds booking it (dogs the partner
 * marked Assessed fit still can); turning it down leaves the class open to every dog.
 */
function BreedOnly({ rows, onDone }: { rows: ReviewClass[]; onDone: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const decide = async (c: ReviewClass, approve: boolean) => {
    setBusy(c.id); setError(null);
    try { await decideBreedOnly(c.id, approve); onDone(); } catch (e) { setError(errorCopy(e)); } finally { setBusy(null); }
  };
  const groups = (c: ReviewClass) => c.built_for.map((k) => APTITUDES.find((a) => a.key === k)?.label ?? k).join(', ');
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 className="pp-title" style={{ margin: 0 }}>{`Only these breeds · ${rows.length}`}</h2>
      <span className="pp-label pp-muted">Partners asking to close a class to other breeds. Until you decide, every dog can book it.</span>
      <ErrorLine>{error}</ErrorLine>
      {rows.map((c) => (
        <div key={c.id} className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: 20, alignItems: 'center' }}>
          <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <Row gap={8}><span className="pp-title">{c.title}</span><Tag>{c.discipline}</Tag></Row>
            <span className="pp-label pp-muted">{[c.partner_name, c.trainer_name].filter(Boolean).join(' · ')}</span>
            <span className="pp-label">{`Only ${groups(c)}`}</span>
            <span className="pp-body">{`Why: ${c.breed_only_reason ?? '—'}`}</span>
          </div>
          <Row gap={8}>
            <Button disabled={busy === c.id} onClick={() => decide(c, true)}>Approve</Button>
            <Button variant="quiet" disabled={busy === c.id} onClick={() => decide(c, false)}>Turn down</Button>
          </Row>
        </div>
      ))}
    </section>
  );
}

/** Photos partners uploaded that are in use. Take down puts the library's default photo back and deletes the file. */
function Photos() {
  const { data, reload } = useData(loadPartnerPhotos, []);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!data?.length) return null;
  const takeDown = async (p: PartnerPhoto) => {
    setBusy(p.path); setError(null);
    try { await adminRemovePhoto(p.kind === 'class' ? { classId: p.id } : { trainerId: p.id }, p.path); reload(); } catch (e) { setError(errorCopy(e)); } finally { setBusy(null); }
  };
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 className="pp-title" style={{ margin: 0 }}>{`Partner photos · ${data.length}`}</h2>
      <span className="pp-label pp-muted">Covers and trainer photos partners uploaded. They show to members as soon as they're saved.</span>
      <ErrorLine>{error}</ErrorLine>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
        {data.map((p) => (
          <div key={p.path} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
            <img src={photoUrl(p.path)} alt="" style={{ width: '100%', aspectRatio: p.kind === 'class' ? '4 / 5' : '1', borderRadius: 14, objectFit: 'cover' }} />
            <span className="pp-label" style={{ fontWeight: 600 }}>{p.name}</span>
            <span className="pp-caption pp-muted">{`${p.kind === 'class' ? 'Class cover' : 'Trainer'} · ${p.partner_name}`}</span>
            <Button size="sm" variant="quiet" disabled={busy === p.path} onClick={() => takeDown(p)}>{busy === p.path ? 'Taking down…' : 'Take down'}</Button>
          </div>
        ))}
      </div>
    </section>
  );
}

type Paths = { steps: PathStepOption[]; of: (id: string) => string[]; clearances: AdminClearanceType[] };

function Section({ title, rows, paths, onDone }: { title: string; rows: ReviewClass[]; paths: Paths; onDone: () => void }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 className="pp-title" style={{ margin: 0 }}>{title}</h2>
      {rows.map((c) => <ReviewCard key={c.id} c={c} paths={paths} onDone={onDone} />)}
    </section>
  );
}

function ReviewCard({ c, paths, onDone }: { c: ReviewClass; paths: Paths; onDone: () => void }) {
  const suggested = estimateFor(c.duration_min, c.intensity, c.session_type, c.group_size);
  const [credits, setCredits] = useState(Math.min(MAX_CREDITS, c.credits ?? suggested));
  const [premium, setPremium] = useState(c.premium);
  const saved = paths.of(c.id);
  const [steps, setSteps] = useState<string[] | null>(null);
  const assessment = c.session_type === 'assessment';
  // An assessment grants a clearance; any other class can require one. The partner's choice is the starting point.
  const [clearance, setClearance] = useState((assessment ? c.grants : c.requires) ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const act = async (status: 'live' | 'paused') => {
    setBusy(true); setError(null);
    try {
      if (clearance !== ((assessment ? c.grants : c.requires) ?? '')) await setClassClearance(c.id, assessment ? null : clearance || null, assessment ? clearance || null : null);
      if (steps && JSON.stringify(steps) !== JSON.stringify(saved)) await setPathSteps(c.id, steps);
      await setClassReview(c.id, credits, premium, status); onDone();
    } catch (e) { setError(errorCopy(e)); setBusy(false); }
  };
  const facts = [
    TYPE[c.session_type], `${c.duration_min} min`, `Intensity ${c.intensity} of 5`,
    c.session_type === 'class' ? `Up to ${c.group_size} dogs` : 'One dog',
  ].filter(Boolean).join(' · ');
  const pickable = paths.clearances.filter((k) => k.status !== 'retired' || k.id === clearance);

  return (
    <div className="card" style={{ display: 'grid', gridTemplateColumns: '120px minmax(0,1fr) 260px', gap: 22, padding: 20, alignItems: 'start' }}>
      <img src={photoUrl(c.image)} alt="" style={{ width: 120, height: 120, borderRadius: 16, objectFit: 'cover' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        <Row gap={8}>
          <span className="pp-title">{c.title}</span>
          <Tag>{c.discipline}</Tag>
          {c.credit_review && c.status === 'live' ? <Tag tone="warning">{`Live at ${c.credits} credits`}</Tag> : null}
        </Row>
        <span className="pp-label pp-muted">{[c.partner_name, c.trainer_name].filter(Boolean).join(' · ')}</span>
        <span className="pp-label">{facts}</span>
        {c.energy.length || c.sociability.length ? <span className="pp-caption pp-muted">{[c.energy.join(', '), c.sociability.join(', ')].filter(Boolean).join(' · ')}</span> : null}
        {c.description ? <p className="pp-body" style={{ margin: '4px 0 0', textWrap: 'pretty' }}>{c.description}</p> : null}
        <Field label={assessment ? 'Grants' : 'Requires'} note={assessment ? 'Passing this assessment gives the dog this clearance.' : 'Dogs need this clearance to book.'}>
          <select className="field" style={{ maxWidth: 320 }} value={clearance} onChange={(e) => setClearance(e.target.value)} aria-label={assessment ? 'Clearance it grants' : 'Clearance it requires'}>
            <option value="">{assessment ? 'Pick a clearance…' : 'No clearance'}</option>
            {pickable.map((k) => <option key={k.id} value={k.id}>{`${k.name}${k.status === 'draft' ? ' (draft)' : ''}`}</option>)}
          </select>
        </Field>
        {c.session_type !== 'assessment' && paths.steps.length ? <PathStepPicker steps={paths.steps} value={steps ?? saved} onChange={setSteps} /> : null}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span className="pp-label" style={{ fontWeight: 600 }}>Credit cost</span>
        <Stepper label="credits" value={credits} onDec={() => setCredits(Math.max(1, credits - 1))} onInc={() => setCredits(Math.min(MAX_CREDITS, credits + 1))} decDisabled={credits <= 1} incDisabled={credits >= MAX_CREDITS} />
        <span className="pp-caption pp-muted">{`Formula suggests ${suggested}.${c.credits != null && c.credit_review ? ` Was ${c.credits}; current bookings keep their price.` : ''}`}</span>
        <Row gap={10} wrap={false} style={{ justifyContent: 'space-between' }}>
          <span className="pp-label">Premium</span>
          <Toggle on={premium} onChange={setPremium} label="Premium" />
        </Row>
        <Button block disabled={busy} onClick={() => act('live')}>{busy ? 'Saving…' : c.status === 'live' ? `Keep live at ${credits}` : `Put live at ${credits}`}</Button>
        <Button block variant="quiet" disabled={busy} onClick={() => act('paused')}>Pause</Button>
        <ErrorLine>{error}</ErrorLine>
      </div>
    </div>
  );
}
