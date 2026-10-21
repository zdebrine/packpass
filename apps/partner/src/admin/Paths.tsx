import { useState } from 'react';

import { errorCopy, loadAdminPathClasses, loadPathSteps, setPathSteps, type AdminPathClass, type PathStepOption } from '@/lib/api';
import { ageLabel } from '@/lib/classForm';
import { useData } from '@/lib/partner';
import { Button, Chip, ErrorLine, Field, Row, Tag } from '@/ui/kit';
import { Empty, Loading } from '@/pages/Overview';

/** "path_id:position", the key a step goes by in the pickers below. */
export const stepKey = (s: { path_id: string; position: number }) => `${s.path_id}:${s.position}`;
const STATUS: Record<AdminPathClass['status'], string> = { live: 'Live', in_review: 'In review', paused: 'Paused' };

/**
 * The steps a class counts for, as chips: none picked means it isn't a Path class. Used when PackPass reviews a
 * new class and on PackPass › Paths.
 */
export function PathStepPicker({ steps, value, onChange }: { steps: PathStepOption[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (k: string) => onChange((value.includes(k) ? value.filter((x) => x !== k) : [...value, k]).sort());
  return (
    <Field label="Path class" note={value.length ? 'Dogs on the path can book it before they have the clearance, and checking in finishes the step.' : 'Not a Path class. Pick a step if this class moves a dog along a training path.'}>
      <Row gap={6}>
        {steps.map((s) => <Chip key={stepKey(s)} on={value.includes(stepKey(s))} onClick={() => toggle(stepKey(s))}>{`${s.path_title} · Step ${s.position}: ${s.title}`}</Chip>)}
      </Row>
    </Field>
  );
}

/**
 * PackPass › Paths: each training path's steps and the Path classes that count for them. Partners don't choose
 * this; PackPass marks a class when it reviews it, or here for classes already live.
 */
export function Paths() {
  const { data: steps, error: stepsError } = useData(loadPathSteps, []);
  const { data: classes, reload } = useData(loadAdminPathClasses, []);
  const [adding, setAdding] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (stepsError) return <ErrorLine>{`Couldn't load the training paths. ${errorCopy(stepsError)}`}</ErrorLine>;
  if (!steps || !classes) return <Loading />;

  const keysOf = (c: AdminPathClass) => c.steps.map(stepKey);
  const save = async (c: AdminPathClass, keys: string[], k: string) => {
    setBusy(k); setError(null);
    try { await setPathSteps(c.id, keys); setAdding((a) => ({ ...a, [k]: '' })); reload(); } catch (e) { setError(errorCopy(e)); } finally { setBusy(null); }
  };
  const paths = [...new Set(steps.map((s) => s.path_id))];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1040, margin: '0 auto', width: '100%' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="pp-caption pp-muted">PackPass · Paths</span>
        <h1 className="pp-page-title" style={{ margin: 0 }}>Training paths</h1>
        <span className="pp-label pp-muted">Path classes count for a step. The member app suggests the ones each dog can join, a dog on the path can book them before it has the clearance, and checking in finishes the step.</span>
      </header>
      <ErrorLine>{error}</ErrorLine>
      {paths.length ? null : <Empty>No training paths yet.</Empty>}
      {paths.map((pid) => (
        <section key={pid} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 className="pp-title" style={{ margin: 0 }}>{steps.find((s) => s.path_id === pid)!.path_title}</h2>
          {steps.filter((s) => s.path_id === pid).map((s) => {
            const k = stepKey(s);
            const on = classes.filter((c) => keysOf(c).includes(k));
            const others = classes.filter((c) => !keysOf(c).includes(k));
            const pick = classes.find((c) => c.id === adding[k]);
            return (
              <div key={k} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 20 }}>
                <span className="pp-label" style={{ fontWeight: 600 }}>{`Step ${s.position}: ${s.title}`}</span>
                {on.length ? on.map((c) => (
                  <Row key={c.id} gap={10} wrap={false} style={{ justifyContent: 'space-between' }}>
                    <Row gap={8}>
                      <span className="pp-label">{c.title}</span>
                      <span className="pp-caption pp-muted">{[c.partner_name, ageLabel({ min: c.min_age_months, max: c.max_age_months }) ?? 'Any age'].join(' · ')}</span>
                      {c.status !== 'live' ? <Tag tone="warning">{STATUS[c.status]}</Tag> : null}
                    </Row>
                    <Button size="sm" variant="quiet" disabled={busy === k} onClick={() => save(c, keysOf(c).filter((x) => x !== k), k)}>Remove</Button>
                  </Row>
                )) : <span className="pp-caption pp-muted">No Path classes. Dogs on this step have nothing to book.</span>}
                <Row gap={8}>
                  <select className="field" style={{ maxWidth: 420 }} value={adding[k] ?? ''} onChange={(e) => setAdding((a) => ({ ...a, [k]: e.target.value }))} aria-label={`Add a class to step ${s.position}`}>
                    <option value="">Add a class…</option>
                    {others.map((c) => <option key={c.id} value={c.id}>{`${c.title} · ${c.partner_name}${c.status !== 'live' ? ` (${STATUS[c.status]})` : ''}`}</option>)}
                  </select>
                  <Button size="sm" disabled={!pick || busy === k} onClick={() => pick && save(pick, [...keysOf(pick), k].sort(), k)}>{busy === k ? 'Saving…' : 'Add'}</Button>
                </Row>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
