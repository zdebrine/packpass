import { useState } from 'react';

import { errorCopy, loadReviewQueue, setClassReview, type ReviewClass } from '@/lib/api';
import { estimateFor } from '@/lib/classForm';
import { useData } from '@/lib/partner';
import { Button, ErrorLine, Row, Stepper, Tag, Toggle, photoUrl } from '@/ui/kit';
import { Empty, Loading } from '@/pages/Overview';

const TYPE = { class: 'Class', private: 'Private', assessment: 'Assessment' } as const;

/** PackPass › Review: new classes waiting for a credit cost, and live classes whose pricing changed. */
export function Review() {
  const { data, reload } = useData(loadReviewQueue, []);
  if (!data) return <Loading />;
  const fresh = data.filter((c) => c.status === 'in_review');
  const repriced = data.filter((c) => c.status !== 'in_review');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 1040 }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="pk-wide pk-muted">PackPass · Review</span>
        <h1 className="pk-display-xl" style={{ margin: 0 }}>Classes to review</h1>
        <span className="pk-label pk-muted">Set the credit cost and put each class live. Live classes open on Book and partners can schedule them.</span>
      </header>
      {data.length ? null : <Empty>Nothing waiting. New classes and price changes from partners show up here.</Empty>}
      {fresh.length ? <Section title={`New classes · ${fresh.length}`} rows={fresh} onDone={reload} /> : null}
      {repriced.length ? <Section title={`Pricing changed · ${repriced.length}`} rows={repriced} onDone={reload} /> : null}
    </div>
  );
}

function Section({ title, rows, onDone }: { title: string; rows: ReviewClass[]; onDone: () => void }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 className="pk-title" style={{ margin: 0 }}>{title}</h2>
      {rows.map((c) => <ReviewCard key={c.id} c={c} onDone={onDone} />)}
    </section>
  );
}

function ReviewCard({ c, onDone }: { c: ReviewClass; onDone: () => void }) {
  const suggested = estimateFor(c.duration_min, c.intensity, c.session_type, c.group_size);
  const [credits, setCredits] = useState(c.credits ?? suggested);
  const [premium, setPremium] = useState(c.premium);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const act = async (status: 'live' | 'paused') => {
    setBusy(true); setError(null);
    try { await setClassReview(c.id, credits, premium, status); onDone(); } catch (e) { setError(errorCopy(e)); setBusy(false); }
  };
  const facts = [
    TYPE[c.session_type], `${c.duration_min} min`, `Intensity ${c.intensity} of 5`,
    c.session_type === 'class' ? `Up to ${c.group_size} dogs` : 'One dog',
    c.requires ? `Needs ${c.requires === 'social' ? 'Social' : 'Herding'}` : null, c.grants ? `Grants ${c.grants === 'social' ? 'Social' : 'Herding'}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="card" style={{ display: 'grid', gridTemplateColumns: '120px minmax(0,1fr) 260px', gap: 22, padding: 20, alignItems: 'start' }}>
      <img src={photoUrl(c.image)} alt="" style={{ width: 120, height: 120, borderRadius: 16, objectFit: 'cover' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        <Row gap={8}>
          <span className="pk-title">{c.title}</span>
          <Tag>{c.discipline}</Tag>
          {c.credit_review && c.status === 'live' ? <Tag tone="warning">{`Live at ${c.credits} credits`}</Tag> : null}
        </Row>
        <span className="pk-label pk-muted">{[c.partner_name, c.trainer_name].filter(Boolean).join(' · ')}</span>
        <span className="pk-label">{facts}</span>
        {c.energy.length || c.sociability.length ? <span className="pk-caption pk-muted">{[c.energy.join(', '), c.sociability.join(', ')].filter(Boolean).join(' · ')}</span> : null}
        {c.description ? <p className="pk-body" style={{ margin: '4px 0 0', textWrap: 'pretty' }}>{c.description}</p> : null}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span className="pk-label" style={{ fontWeight: 600 }}>Credit cost</span>
        <Stepper label="credits" value={credits} onDec={() => setCredits(Math.max(1, credits - 1))} onInc={() => setCredits(Math.min(20, credits + 1))} decDisabled={credits <= 1} incDisabled={credits >= 20} />
        <span className="pk-caption pk-muted">{`Formula suggests ${suggested}.${c.credits != null && c.credit_review ? ` Was ${c.credits}; current bookings keep their price.` : ''}`}</span>
        <Row gap={10} wrap={false} style={{ justifyContent: 'space-between' }}>
          <span className="pk-label">Premium</span>
          <Toggle on={premium} onChange={setPremium} label="Premium" />
        </Row>
        <Button block disabled={busy} onClick={() => act('live')}>{busy ? 'Saving…' : c.status === 'live' ? `Keep live at ${credits}` : `Put live at ${credits}`}</Button>
        <Button block variant="quiet" disabled={busy} onClick={() => act('paused')}>Pause</Button>
        <ErrorLine>{error}</ErrorLine>
      </div>
    </div>
  );
}
