import { useEffect, useState } from 'react';

import { errorCopy, loadFitReport, loadFitWeights, saveFitWeights, type FitPart, type FitReportRow, type FitWeights } from '@/lib/api';
import { useData } from '@/lib/partner';
import { Button, ErrorLine, Row, Segmented, Stepper } from '@/ui/kit';
import { Loading } from '@/pages/Overview';

const PARTS: { key: FitPart; label: string; strong: string }[] = [
  { key: 'breed', label: 'Breed', strong: 'Shares a Built for breed group' },
  { key: 'energy', label: 'Energy', strong: 'Energy matches the class' },
  { key: 'social', label: 'Social', strong: 'Suits how the dog is with other dogs' },
  { key: 'interests', label: 'Interests', strong: 'An interest the owner picked' },
  { key: 'balance', label: 'Balance', strong: 'What the month is short on' },
  { key: 'history', label: 'History', strong: 'A discipline or place the dog has been' },
];
/** Below this many dogs, the rates swing too much to tune from. */
const ENOUGH_DOGS = 30;

const rate = (r?: FitReportRow) => (r && r.shown ? r.booked / r.shown : null);
const pct = (x: number | null) => (x == null ? '—' : `${(x * 100).toFixed(1)}%`);

/**
 * PackPass › Fit: how often dogs book the classes Book showed them, by fit score and by each part of it, and the
 * weights the member app ranks with (apps/member/src/lib/fit.ts). Only classes the dog could book right then count.
 */
export function Fit() {
  const [days, setDays] = useState<'28' | '90'>('28');
  const { data: report } = useData(() => loadFitReport(Number(days)), [days]);
  const { data: saved, reload } = useData(loadFitWeights, []);
  if (!report || !saved) return <Loading />;
  const all = report.find((r) => r.kind === 'all');
  const bands = report.filter((r) => r.kind === 'band');
  const part = (k: FitPart, s: 'strong' | 'weak') => report.find((r) => r.kind === 'part' && r.label === `${k} ${s}`);
  const thin = (all?.dogs ?? 0) < ENOUGH_DOGS;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1040, margin: '0 auto', width: '100%' }}>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="pp-caption pp-muted">PackPass · Fit</span>
          <h1 className="pp-page-title" style={{ margin: 0 }}>Class fit</h1>
          <span className="pp-label pp-muted">How often dogs book the classes Book shows them, by how well each class fits. Use it to tune the weights below.</span>
        </div>
        <Segmented label="Period" options={[{ value: '28', label: 'Last 28 days' }, { value: '90', label: 'Last 90 days' }]} value={days} onChange={setDays} />
      </header>

      <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="pp-title">{`${pct(rate(all))} of classes shown were booked`}</span>
        <span className="pp-label pp-muted">{`${all?.booked ?? 0} booked of ${all?.shown ?? 0} shown, across ${all?.dogs ?? 0} ${all?.dogs === 1 ? 'dog' : 'dogs'}.`}</span>
        {thin ? <span className="pp-caption" style={{ color: 'var(--kennel-red)' }}>{`Fewer than ${ENOUGH_DOGS} dogs so far. The rates will swing a lot until more members have used Book, so hold off changing the weights.`}</span> : null}
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 className="pp-title" style={{ margin: 0 }}>By fit score</h2>
        <span className="pp-label pp-muted">If the score works, higher bands book more often.</span>
        <div className="tbl">
          <div className="tbl-head" style={{ gridTemplateColumns: COLS }}><span>Score</span><span>Shown</span><span>Booked</span><span>Booking rate</span></div>
          {bands.map((b) => (
            <div key={b.label} className="tbl-row" style={{ gridTemplateColumns: COLS, minHeight: 44 }}>
              <span className="pp-body">{b.label}</span><span className="pp-body">{b.shown}</span><span className="pp-body">{b.booked}</span><span className="pp-body">{pct(rate(b))}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 className="pp-title" style={{ margin: 0 }}>By part</h2>
        <span className="pp-label pp-muted">Booking rate when each part is strong against when it isn't. A part whose strong rate isn't higher is worth less weight.</span>
        <div className="tbl">
          <div className="tbl-head" style={{ gridTemplateColumns: PART_COLS }}><span>Part</span><span>When strong</span><span>Otherwise</span><span>Lift</span><span>Weight now</span></div>
          {PARTS.map((p) => {
            const s = rate(part(p.key, 'strong'));
            const w = rate(part(p.key, 'weak'));
            const lift = s != null && w ? s / w : null;
            return (
              <div key={p.key} className="tbl-row" style={{ gridTemplateColumns: PART_COLS, minHeight: 52 }}>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}><span className="pp-body">{p.label}</span><span className="pp-caption pp-muted">{p.strong}</span></div>
                <span className="pp-body">{`${pct(s)} of ${part(p.key, 'strong')?.shown ?? 0}`}</span>
                <span className="pp-body">{`${pct(w)} of ${part(p.key, 'weak')?.shown ?? 0}`}</span>
                <span className="pp-body">{lift == null ? '—' : `${lift.toFixed(1)}×`}</span>
                <span className="pp-body">{saved[p.key]}</span>
              </div>
            );
          })}
        </div>
      </section>

      <Weights saved={saved} onSaved={reload} />
    </div>
  );
}

const COLS = 'minmax(0,1fr) 100px 100px 120px';
const PART_COLS = 'minmax(0,1.6fr) 140px 140px 80px 100px';

/** The weights the member app ranks with. They add up to 100, so a fit score reads out of 100. */
function Weights({ saved, onSaved }: { saved: FitWeights & { updated_at: string }; onSaved: () => void }) {
  const pick = (w: FitWeights): FitWeights => Object.fromEntries(PARTS.map((p) => [p.key, w[p.key]])) as FitWeights;
  const [w, setW] = useState<FitWeights>(pick(saved));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => { setW(pick(saved)); }, [saved]);
  const total = PARTS.reduce((n, p) => n + w[p.key], 0);
  const dirty = PARTS.some((p) => w[p.key] !== saved[p.key]);
  const set = (k: FitPart, v: number) => { setW((x) => ({ ...x, [k]: Math.max(0, Math.min(100, v)) })); setDone(false); };
  const save = async () => {
    setBusy(true); setError(null);
    try { await saveFitWeights(w); setDone(true); onSaved(); } catch (e) { setError(errorCopy(e)); } finally { setBusy(false); }
  };
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 className="pp-title" style={{ margin: 0 }}>Weights</h2>
      <span className="pp-label pp-muted">{`How much each part counts toward a class's fit. Members' apps pick up a change the next time they load classes. Last changed ${new Date(saved.updated_at).toLocaleDateString()}.`}</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
        {PARTS.map((p) => (
          <div key={p.key} className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span className="pp-label">{p.label}</span>
            <Stepper label={`${p.label} weight`} value={w[p.key]} onDec={() => set(p.key, w[p.key] - 5)} onInc={() => set(p.key, w[p.key] + 5)} decDisabled={w[p.key] <= 0} incDisabled={w[p.key] >= 100} />
          </div>
        ))}
      </div>
      <Row gap={10}>
        <Button disabled={!dirty || total !== 100 || busy} onClick={save}>{busy ? 'Saving…' : 'Save weights'}</Button>
        <span className="pp-caption" style={{ color: total === 100 ? undefined : 'var(--kennel-red)' }}>{total === 100 ? (done && !dirty ? 'Saved.' : 'Adds up to 100.') : `Adds up to ${total}. Make it 100 to save.`}</span>
        <ErrorLine>{error}</ErrorLine>
      </Row>
    </section>
  );
}
