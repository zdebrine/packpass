import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import {
  errorCopy, loadClassOptions, loadClearanceTypes, loadTrainingPaths, saveClearanceType, saveTrainingPath,
  type AdminClassOption, type AdminClearanceType, type AdminTrainingPath, type ClearanceCriterion,
} from '@/lib/api';
import { useData } from '@/lib/partner';
import { Button, Checkbox, ErrorLine, Field, IconButton, Modal, Row, Segmented, Stepper, Tag } from '@/ui/kit';

const STATUS = { draft: 'Draft', active: 'Active', retired: 'Retired' } as const;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The clearances PackPass offers (Social, Herding and any it adds) and the training paths that lead to them,
 * at the top of PackPass › Clearances. A new clearance starts as a draft only admins see; retiring one stops new
 * grants while dogs that hold it keep it until it expires.
 */
export function ClearanceTypes() {
  const { data: types, reload } = useData(loadClearanceTypes, []);
  const { data: paths, reload: reloadPaths } = useData(loadTrainingPaths, []);
  const [editing, setEditing] = useState<AdminClearanceType | 'new' | null>(null);
  const [pathEditing, setPathEditing] = useState<AdminTrainingPath | 'new' | null>(null);
  if (!types || !paths) return null;
  const nameOf = (id: string | null) => types.find((t) => t.id === id)?.name ?? id;

  return (
    <>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Row gap={12} style={{ justifyContent: 'space-between' }}>
          <h2 className="pp-title" style={{ margin: 0 }}>Clearance types</h2>
          <Button size="sm" icon={Plus} onClick={() => setEditing('new')}>New clearance</Button>
        </Row>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
          {types.map((t) => (
            <div key={t.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 18 }}>
              <Row gap={8}>
                <span className="pp-title">{t.name}</span>
                {t.status !== 'active' ? <Tag tone="warning">{STATUS[t.status]}</Tag> : null}
              </Row>
              {t.description ? <span className="pp-caption pp-muted">{t.description}</span> : null}
              <span className="pp-label">{[
                t.scope === 'network' ? 'Every partner' : 'Only the partner that grants it',
                `${plural(t.expiry_months, 'month')}`,
                t.group_also_requires ? `Group classes also need ${nameOf(t.group_also_requires)}` : null,
              ].filter(Boolean).join(' · ')}</span>
              <span className="pp-caption pp-muted">{[
                t.criteria.length ? plural(t.criteria.length, 'rubric item') : 'No rubric yet',
                t.paths.length ? `Path: ${t.paths.map((p) => p.title).join(', ')}` : 'No path',
                `${plural(t.requiring_classes, 'class', 'classes')} need it`, `${plural(t.granting_classes, 'assessment')}`, `${plural(t.dogs_cleared, 'dog')} cleared`,
              ].join(' · ')}</span>
              <div><Button size="sm" variant="outline" onClick={() => setEditing(t)}>Edit</Button></div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Row gap={12} style={{ justifyContent: 'space-between' }}>
          <h2 className="pp-title" style={{ margin: 0 }}>Training paths</h2>
          <Button size="sm" variant="outline" icon={Plus} onClick={() => setPathEditing('new')}>New path</Button>
        </Row>
        <span className="pp-label pp-muted">The steps a dog takes toward a clearance. Choose which classes count for each step on PackPass › Paths.</span>
        {paths.map((p) => (
          <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 18 }}>
            <Row gap={8} style={{ justifyContent: 'space-between' }}>
              <Row gap={8}>
                <span className="pp-title">{p.title}</span>
                <span className="pp-caption pp-muted">{[p.grants ? `Leads to ${nameOf(p.grants)}` : 'No clearance', plural(p.started, 'dog') + ' started'].join(' · ')}</span>
              </Row>
              <Button size="sm" variant="outline" onClick={() => setPathEditing(p)}>Edit</Button>
            </Row>
            <span className="pp-caption">{p.steps.map((s, i) => `${i + 1}. ${s.title}`).join('   ')}</span>
          </div>
        ))}
      </section>

      {editing ? <ClearanceModal value={editing === 'new' ? null : editing} types={types} onClose={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} /> : null}
      {pathEditing ? <PathModal value={pathEditing === 'new' ? null : pathEditing} types={types} onClose={() => setPathEditing(null)} onDone={() => { setPathEditing(null); reloadPaths(); reload(); }} /> : null}
    </>
  );
}

function ClearanceModal({ value, types, onClose, onDone }: { value: AdminClearanceType | null; types: AdminClearanceType[]; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(value?.name ?? '');
  const [description, setDescription] = useState(value?.description ?? '');
  const [scope, setScope] = useState<AdminClearanceType['scope']>(value?.scope ?? 'network');
  const [months, setMonths] = useState(value?.expiry_months ?? 12);
  const [also, setAlso] = useState(value?.group_also_requires ?? '');
  const [status, setStatus] = useState<AdminClearanceType['status']>(value?.status ?? 'draft');
  const [criteria, setCriteria] = useState<ClearanceCriterion[]>(value?.criteria.length ? value.criteria : [{ label: '', required: true }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setItem = (i: number, c: Partial<ClearanceCriterion>) => setCriteria(criteria.map((x, j) => (j === i ? { ...x, ...c } : x)));
  const save = async () => {
    setBusy(true); setError(null);
    try {
      await saveClearanceType({
        ...(value ? { id: value.id } : {}), name, description, scope, expiry_months: months, group_also_requires: also || null, status,
        criteria: criteria.filter((c) => c.label.trim()),
      });
      onDone();
    } catch (e) { setError(errorCopy(e)); setBusy(false); }
  };
  return (
    <Modal eyebrow="PackPass · Clearances" title={value ? `Edit ${value.name}` : 'New clearance'} width={560} onClose={onClose}
      footer={<Row gap={8}><Button disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</Button><Button variant="quiet" onClick={onClose}>Cancel</Button></Row>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Name"><input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Off-leash trails" /></Field>
        <Field label="What it means" note="Members see this on their dog's Passport and on classes that need it.">
          <textarea className="field" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Who honours it" note={value && value.dogs_cleared ? 'Dogs already hold it, so this can\'t change.' : undefined}>
          <Segmented label="Who honours it" value={scope} onChange={setScope} options={[{ value: 'network', label: 'Every partner' }, { value: 'partner', label: 'Only the partner that grants it' }]} />
        </Field>
        <Field label="Lasts">
          <Stepper label="months" value={plural(months, 'month')} onDec={() => setMonths(Math.max(1, months - 1))} onInc={() => setMonths(Math.min(120, months + 1))} decDisabled={months <= 1} incDisabled={months >= 120} />
        </Field>
        <Field label="Group classes also need" note="Herding group classes also need Social, for example.">
          <select className="field" value={also} onChange={(e) => setAlso(e.target.value)}>
            <option value="">Nothing else</option>
            {types.filter((t) => t.id !== value?.id).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Rubric" note="What the trainer checks during the assessment. A dog clears when every required item passes.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {criteria.map((c, i) => (
              <Row key={i} gap={8} wrap={false}>
                <input className="field" style={{ flex: 1 }} value={c.label} onChange={(e) => setItem(i, { label: e.target.value })} placeholder="Recovers from a dog approach within 10 seconds" aria-label={`Rubric item ${i + 1}`} />
                <Checkbox on={c.required} onChange={(v) => setItem(i, { required: v })}>Required</Checkbox>
                <IconButton icon={Trash2} label={`Remove item ${i + 1}`} onClick={() => setCriteria(criteria.filter((_, j) => j !== i))} />
              </Row>
            ))}
            <div><Button size="sm" variant="quiet" icon={Plus} onClick={() => setCriteria([...criteria, { label: '', required: true }])}>Add an item</Button></div>
          </div>
        </Field>
        <Field label="Status" note={status === 'draft' ? 'Only PackPass sees a draft.' : status === 'retired' ? 'No new grants. Dogs that hold it keep it until it expires.' : 'Members and partners see it.'}>
          <Segmented label="Status" value={status} onChange={setStatus} options={(['draft', 'active', 'retired'] as const).map((s) => ({ value: s, label: STATUS[s] }))} />
        </Field>
        <ErrorLine>{error}</ErrorLine>
      </div>
    </Modal>
  );
}

function PathModal({ value, types, onClose, onDone }: { value: AdminTrainingPath | null; types: AdminClearanceType[]; onClose: () => void; onDone: () => void }) {
  const { data: classes } = useData(loadClassOptions, []);
  const [title, setTitle] = useState(value?.title ?? '');
  const [lede, setLede] = useState(value?.lede ?? '');
  const [grants, setGrants] = useState(value?.grants ?? '');
  const [steps, setSteps] = useState(value?.steps.length ? value.steps : [{ title: '', class_id: '' }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = !!value?.started;
  const setStep = (i: number, s: Partial<AdminTrainingPath['steps'][number]>) => setSteps(steps.map((x, j) => (j === i ? { ...x, ...s } : x)));
  const move = (i: number, d: -1 | 1) => { const n = [...steps]; [n[i], n[i + d]] = [n[i + d], n[i]]; setSteps(n); };
  const label = (c: AdminClassOption) => `${c.title} · ${c.partner_name}${c.session_type === 'assessment' ? ' (assessment)' : ''}`;
  const save = async () => {
    setBusy(true); setError(null);
    try { await saveTrainingPath({ ...(value ? { id: value.id } : {}), title, lede, grants: grants || null, steps }); onDone(); } catch (e) { setError(errorCopy(e)); setBusy(false); }
  };
  return (
    <Modal eyebrow="PackPass · Training paths" title={value ? `Edit ${value.title}` : 'New path'} width={620} onClose={onClose}
      footer={<Row gap={8}><Button disabled={busy || !classes} onClick={save}>{busy ? 'Saving…' : 'Save'}</Button><Button variant="quiet" onClick={onClose}>Cancel</Button></Row>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Title"><input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Trail ready" /></Field>
        <Field label="Short description"><textarea className="field" rows={2} value={lede} onChange={(e) => setLede(e.target.value)} /></Field>
        <Field label="Leads to" note="Finishing the last step (that clearance's assessment) grants it.">
          <select className="field" value={grants} onChange={(e) => setGrants(e.target.value)}>
            <option value="">No clearance</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Steps" note={locked ? `${plural(value!.started, 'dog')} started this path, so steps can be reworded but not added, removed or moved.` : 'Each step\'s class counts for it. Add more classes per step on PackPass › Paths.'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {steps.map((s, i) => (
              <Row key={i} gap={8} wrap={false}>
                <span className="pp-caption pp-muted" style={{ width: 18 }}>{i + 1}</span>
                <input className="field" style={{ flex: 1 }} value={s.title} onChange={(e) => setStep(i, { title: e.target.value })} placeholder="Step title" aria-label={`Step ${i + 1} title`} />
                <select className="field" style={{ flex: 1 }} value={s.class_id} disabled={locked} onChange={(e) => setStep(i, { class_id: e.target.value })} aria-label={`Step ${i + 1} class`}>
                  <option value="">Pick a class…</option>
                  {(classes ?? []).map((c) => <option key={c.id} value={c.id}>{label(c)}</option>)}
                </select>
                {locked ? null : (
                  <>
                    <IconButton icon={ArrowUp} label={`Move step ${i + 1} up`} onClick={() => i > 0 && move(i, -1)} />
                    <IconButton icon={ArrowDown} label={`Move step ${i + 1} down`} onClick={() => i < steps.length - 1 && move(i, 1)} />
                    <IconButton icon={Trash2} label={`Remove step ${i + 1}`} onClick={() => setSteps(steps.filter((_, j) => j !== i))} />
                  </>
                )}
              </Row>
            ))}
            {locked ? null : <div><Button size="sm" variant="quiet" icon={Plus} onClick={() => setSteps([...steps, { title: '', class_id: '' }])}>Add a step</Button></div>}
          </div>
        </Field>
        <ErrorLine>{error}</ErrorLine>
      </div>
    </Modal>
  );
}
