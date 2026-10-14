// Field groups shared by the class editor (03 Classes) and the new-class steps (03b).
import { Upload } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { errorCopy, loadReach, uploadPartnerPhoto, type SessionType } from '@/lib/api';
import { usePartner } from '@/lib/partner';
import { isUpload } from '@/lib/photos';
import { AGES, APTITUDES, DISCIPLINE_DEFAULTS, DISCIPLINES, ENERGY, PHOTOS, REQS, SIZES, SOCIAL, TYPES, ageLabel, emptyForm, payloadOf, sizeLabel, type ClassForm, type Range } from '@/lib/classForm';
import { Chip, ErrorLine, Field, Ico, Row, Segmented, Stepper, Toggle, photoUrl } from '@/ui/kit';

export type Patch = (p: Partial<ClassForm>) => void;

const INTENSITY = ['', 'Calm. Settling, sniffing, slow work.', 'Light. Short bursts with long rests.', 'Steady. Moving most of the hour.', 'Hard. Running and jumping with short rests.', 'Max. Sprints or long outruns.'];
export const typeLabel = (t: SessionType) => TYPES.find((x) => x.key === t)!.label;
const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export const Name = ({ f, set, placeholder }: { f: ClassForm; set: Patch; placeholder?: string }) => (
  <label className="pp-field">
    <span className="pp-field-label">Class name</span>
    <input className="field" value={f.title} placeholder={placeholder} onChange={(e) => set({ title: e.target.value })} />
  </label>
);

/** Who it's for, as a discipline prefills it (or a new class's blank form). */
const whoFor = (discipline: string | null) => {
  const blank = emptyForm(null);
  return DISCIPLINE_DEFAULTS[discipline ?? ''] ?? { builtFor: blank.builtFor, age: blank.age, size: blank.size };
};
const sameWho = (f: ClassForm, w: ReturnType<typeof whoFor>) => JSON.stringify([f.builtFor, f.age, f.size]) === JSON.stringify([w.builtFor, w.age, w.size]);

/** With `prefill` (a new class), picking a discipline also sets Built for, ages and size, unless the partner changed them. */
export const Discipline = ({ f, set, prefill }: { f: ClassForm; set: Patch; prefill?: boolean }) => (
  <Field label="Discipline">
    <Row gap={6}>
      {DISCIPLINES.map((d) => (
        <Chip key={d} on={f.discipline === d} onClick={() => set(prefill && sameWho(f, whoFor(f.discipline)) ? { discipline: d, ...whoFor(d) } : { discipline: d })}>{d}</Chip>
      ))}
    </Row>
  </Field>
);

export const Duration = ({ f, set }: { f: ClassForm; set: Patch }) => (
  <Field label="Duration">
    <Segmented label="Duration" options={Array.from(new Set([30, 45, 60, 90, f.duration])).sort((a, b) => a - b).map((m) => ({ value: String(m), label: `${m} min` }))} value={String(f.duration)} onChange={(v) => set({ duration: Number(v) })} />
  </Field>
);

export const Intensity = ({ f, set, note }: { f: ClassForm; set: Patch; note?: boolean }) => (
  <Field label={`Intensity · ${f.intensity} of 5`} note={note ? INTENSITY[f.intensity] : undefined}>
    <Segmented label="Intensity" options={['1', '2', '3', '4', '5']} value={String(f.intensity)} onChange={(v) => set({ intensity: Number(v) })} />
  </Field>
);

export const Group = ({ f, set }: { f: ClassForm; set: Patch }) => {
  const solo = f.type !== 'class';
  return (
    <Field label="Max group size" note={solo ? `${typeLabel(f.type)} sessions are always one dog.` : 'Smaller groups usually cost more credits.'}>
      <Row gap={10} wrap={false}>
        <Stepper label="dogs" value={solo ? 1 : f.group} decDisabled={solo || f.group <= 2} incDisabled={solo || f.group >= 24}
          onDec={() => set({ group: f.group - 1 })} onInc={() => set({ group: f.group + 1 })} />
        <span className="pp-caption pp-muted">dogs</span>
      </Row>
    </Field>
  );
};

export const Description = ({ f, set, placeholder }: { f: ClassForm; set: Patch; placeholder?: string }) => (
  <label className="pp-field" style={{ gridColumn: '1/-1' }}>
    <span className="pp-field-label">What happens in the session</span>
    <textarea className="area" rows={4} value={f.description} placeholder={placeholder} onChange={(e) => set({ description: e.target.value })} />
  </label>
);

export const Energy = ({ f, set, label = 'Energy' }: { f: ClassForm; set: Patch; label?: string }) => (
  <Field label={label}><Row gap={6}>{ENERGY.map((x) => <Chip key={x} on={f.energy.includes(x)} onClick={() => set({ energy: toggle(f.energy, x) })}>{x}</Chip>)}</Row></Field>
);

export const Social = ({ f, set }: { f: ClassForm; set: Patch }) => (
  <Field label="With other dogs"><Row gap={6}>{SOCIAL.map((x) => <Chip key={x} on={f.social.includes(x)} onClick={() => set({ social: toggle(f.social, x) })}>{x}</Chip>)}</Row></Field>
);

export const Clearance = ({ f, set }: { f: ClassForm; set: Patch }) => {
  const grants = f.type === 'assessment';
  return (
    <Field label={grants ? 'Grants clearance' : 'Requires clearance'}
      note={grants ? 'Social transfers to every partner. Herding stays with your facility.' : f.clearance ? 'Dogs without it see Needs assessment and are sent to book one.' : 'Any dog with current vaccines can book.'}>
      <Row gap={6}>
        <Chip on={!f.clearance} onClick={() => set({ clearance: null })}>None</Chip>
        <Chip on={f.clearance === 'social'} onClick={() => set({ clearance: 'social' })}>Social</Chip>
        <Chip on={f.clearance === 'herding'} onClick={() => set({ clearance: 'herding' })}>Herding · assessed here</Chip>
      </Row>
    </Field>
  );
};

export const Requirements = ({ f, set }: { f: ClassForm; set: Patch }) => (
  <Field label="Requirements" note="Checked against each dog's Passport when they book.">
    <Row gap={6}>{REQS.map((x) => <Chip key={x} on={f.reqs.includes(x)} onClick={() => set({ reqs: toggle(f.reqs, x) })}>{x}</Chip>)}</Row>
  </Field>
);

const same = (a: Range, b: { min: number | null; max: number | null }) => a.min === b.min && a.max === b.max;

/** Who it's for: age, size and spayed or neutered. Members outside these don't see the class as bookable. */
export const Ages = ({ f, set }: { f: ClassForm; set: Patch }) => {
  const custom = !AGES.some((a) => same(f.age, a));
  return (
    <Field label="Ages" note="Dogs outside this range can't book. They see the class greyed out with the reason.">
      <Row gap={6}>
        {AGES.map((a) => <Chip key={a.label} on={same(f.age, a)} onClick={() => set({ age: { min: a.min, max: a.max } })}>{a.label}</Chip>)}
        {custom ? <Chip on>{ageLabel(f.age)}</Chip> : null}
      </Row>
    </Field>
  );
};

export const Sizes = ({ f, set }: { f: ClassForm; set: Patch }) => {
  const custom = !SIZES.some((a) => same(f.size, a));
  return (
    <Field label="Size" note="Use this when size matters for safety, like livestock or jumps.">
      <Row gap={6}>
        {SIZES.map((a) => <Chip key={a.label} on={same(f.size, a)} onClick={() => set({ size: { min: a.min, max: a.max } })}>{a.label}</Chip>)}
        {custom ? <Chip on>{sizeLabel(f.size)}</Chip> : null}
      </Row>
    </Field>
  );
};

export const Fixed = ({ f, set }: { f: ClassForm; set: Patch }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 0', boxShadow: 'inset 0 1px 0 var(--line),inset 0 -1px 0 var(--line)', gridColumn: '1/-1' }}>
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <span className="pp-label">Spayed or neutered only</span>
      <span className="pp-caption pp-muted" style={{ textWrap: 'pretty' }}>Common for off-leash group play.</span>
    </div>
    <Toggle on={f.fixed} onChange={(fixed) => set({ fixed })} label="Spayed or neutered only" />
  </div>
);

/** Group classes only: whether owners hand the dog over for the session. */
export const BuiltFor = ({ f, set }: { f: ClassForm; set: Patch }) => (
  <Field label="Built for" note="Dogs with these breeds see this class first and get a Built for tag. Other dogs can still book.">
    <Row gap={6}>
      {APTITUDES.map((a) => {
        const on = f.builtFor.includes(a.key);
        return <Chip key={a.key} on={on} onClick={() => (on || f.builtFor.length < 3) && set({ builtFor: toggle(f.builtFor, a.key) })}>{a.label}</Chip>;
      })}
    </Row>
  </Field>
);

/** The member preview's reach line: how many PackPass dogs could book this today, and how many are Built for matches. */
export function Reach({ f }: { f: ClassForm }) {
  const [reach, setReach] = useState<{ can_book: number; built_for: number } | null>(null);
  const key = JSON.stringify([f.age, f.size, f.fixed, f.builtFor]);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => loadReach(payloadOf(f)).then((r) => live && setReach(r)).catch(() => live && setReach(null)), 300);
    return () => { live = false; clearTimeout(t); };
  }, [key]); // refetch only when the gates or Built for change
  if (!reach) return null;
  const dogs = (n: number) => `${n} PackPass ${n === 1 ? 'dog' : 'dogs'}`;
  return (
    <span className="pp-caption pp-muted" style={{ textWrap: 'pretty' }}>
      {`${reach.can_book ? `About ${dogs(reach.can_book)} can book this` : 'No PackPass dogs can book this yet. Try a wider age or size'}${f.builtFor.length && reach.can_book ? ` · ${reach.built_for} ${reach.built_for === 1 ? 'is a Built for match' : 'are Built for matches'}` : ''}.`}
    </span>
  );
}

export const DropOff = ({ f, set }: { f: ClassForm; set: Patch }) => f.type === 'class' ? (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 0', boxShadow: 'inset 0 1px 0 var(--line),inset 0 -1px 0 var(--line)', gridColumn: '1/-1' }}>
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <span className="pp-label">Drop-off class</span>
      <span className="pp-caption pp-muted" style={{ textWrap: 'pretty' }}>Owners leave their dog with you for the session. Leave off if owners stay.</span>
    </div>
    <Toggle on={f.dropOff} onChange={(dropOff) => set({ dropOff })} label="Drop-off class" />
  </div>
) : null;

/** Session type as a segmented control with the note under it (the editor's compact version of the step-one cards). */
export const TypeChips = ({ f, set }: { f: ClassForm; set: Patch }) => (
  <Field label="Session type" note={TYPES.find((t) => t.key === f.type)!.note}>
    <Segmented label="Session type" options={TYPES.map((t) => ({ value: t.key, label: t.label }))} value={f.type} onChange={(v) => set({ type: v, clearance: null })} />
  </Field>
);

/**
 * Cover photos: the partner's own upload (cropped to the card's 4:5 and resized in the browser) or one from the
 * PackPass library. An upload on a new class is seen in PackPass review with the rest of the class.
 */
export function PhotoGrid({ value, onPick }: { value: string | null; onPick: (p: string) => void }) {
  const { partner } = usePartner();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState<string | null>(isUpload(value) ? value : null);
  const tile: CSSProperties = { aspectRatio: '1', padding: 0, border: 0, borderRadius: 12, overflow: 'hidden', cursor: 'pointer' };
  const ring = (on: boolean) => (on ? '0 0 0 3px var(--bg),0 0 0 5px var(--ink)' : 'none');

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const path = await uploadPartnerPhoto(partner.id, file, 'cover');
      setMine(path);
      onPick(path);
    } catch (e) { setError(errorCopy(e)); } finally { setBusy(false); if (input.current) input.current.value = ''; }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(84px,1fr))', gap: 8 }}>
        <button type="button" onClick={() => input.current?.click()} disabled={busy}
          style={{ ...tile, background: 'var(--surface)', boxShadow: 'inset 0 0 0 1px var(--line-strong)', color: 'var(--ink)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, font: 'inherit', fontSize: 12, fontWeight: 500 }}>
          <Ico icon={Upload} />{busy ? 'Uploading…' : 'Upload'}
        </button>
        {mine ? (
          <button type="button" aria-label="Use your uploaded photo" aria-pressed={value === mine} onClick={() => onPick(mine)} style={{ ...tile, boxShadow: ring(value === mine) }}>
            <img src={photoUrl(mine)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </button>
        ) : null}
        {PHOTOS.map((p) => (
          <button key={p} type="button" aria-label={`Use the ${p.replace(/_/g, ' ')} photo`} aria-pressed={value === p} onClick={() => onPick(p)} style={{ ...tile, boxShadow: ring(value === p) }}>
            <img src={photoUrl(p)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </button>
        ))}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files?.[0])} />
      <span className="pp-caption pp-muted">JPG, PNG or WebP. Cropped to the card's shape from the centre.</span>
      <ErrorLine>{error}</ErrorLine>
    </div>
  );
}
