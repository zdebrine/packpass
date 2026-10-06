// Field groups shared by the class editor (03 Classes) and the new-class steps (03b).
import { Upload } from 'lucide-react';
import { useRef, useState, type CSSProperties } from 'react';

import { errorCopy, uploadPartnerPhoto, type SessionType } from '@/lib/api';
import { usePartner } from '@/lib/partner';
import { isUpload } from '@/lib/photos';
import { DISCIPLINES, ENERGY, PHOTOS, REQS, SOCIAL, TYPES, type ClassForm } from '@/lib/classForm';
import { Chip, ErrorLine, Field, IntensityBars, Row, Stepper, Toggle, photoUrl } from '@/ui/kit';

export type Patch = (p: Partial<ClassForm>) => void;

const INTENSITY = ['', 'Calm. Settling, sniffing, slow work.', 'Light. Short bursts with long rests.', 'Steady. Moving most of the hour.', 'Hard. Running and jumping with short rests.', 'Max. Sprints or long outruns.'];
export const typeLabel = (t: SessionType) => TYPES.find((x) => x.key === t)!.label;
const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export const Name = ({ f, set, placeholder }: { f: ClassForm; set: Patch; placeholder?: string }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <span className="pk-label" style={{ fontWeight: 600 }}>Class name</span>
    <input className="field" style={{ height: 48, fontSize: 15 }} value={f.title} placeholder={placeholder} onChange={(e) => set({ title: e.target.value })} />
  </label>
);

export const Discipline = ({ f, set }: { f: ClassForm; set: Patch }) => (
  <Field label="Discipline"><Row gap={6}>{DISCIPLINES.map((d) => <Chip key={d} on={f.discipline === d} onClick={() => set({ discipline: d })}>{d}</Chip>)}</Row></Field>
);

export const Duration = ({ f, set }: { f: ClassForm; set: Patch }) => (
  <Field label="Duration"><Row gap={6}>{Array.from(new Set([30, 45, 60, 90, f.duration])).sort((a, b) => a - b).map((m) => <Chip key={m} on={f.duration === m} onClick={() => set({ duration: m })}>{`${m} min`}</Chip>)}</Row></Field>
);

export const Intensity = ({ f, set, note }: { f: ClassForm; set: Patch; note?: boolean }) => (
  <Field label={`Intensity · ${f.intensity} of 5`} note={note ? INTENSITY[f.intensity] : undefined}>
    <IntensityBars value={f.intensity} onPick={(intensity) => set({ intensity })} />
  </Field>
);

export const Group = ({ f, set }: { f: ClassForm; set: Patch }) => {
  const solo = f.type !== 'class';
  return (
    <Field label="Max group size" note={solo ? `${typeLabel(f.type)} sessions are always one dog.` : 'Smaller groups usually cost more credits.'}>
      <Row gap={14}>
        <Stepper label="dogs" value={solo ? 1 : f.group} decDisabled={solo || f.group <= 2} incDisabled={solo || f.group >= 24}
          onDec={() => set({ group: f.group - 1 })} onInc={() => set({ group: f.group + 1 })} />
        <span className="pk-label pk-muted">dogs</span>
      </Row>
    </Field>
  );
};

export const Description = ({ f, set, placeholder }: { f: ClassForm; set: Patch; placeholder?: string }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 8, gridColumn: '1/-1' }}>
    <span className="pk-label" style={{ fontWeight: 600 }}>What happens in the session</span>
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

/** Group classes only: whether owners hand the dog over for the session. */
export const DropOff = ({ f, set }: { f: ClassForm; set: Patch }) => f.type === 'class' ? (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="pk-label" style={{ fontWeight: 600 }}>Drop-off class</span>
      <span className="pk-caption pk-muted" style={{ textWrap: 'pretty' }}>Owners leave their dog with you for the session. Leave off if owners stay.</span>
    </div>
    <Toggle on={f.dropOff} onChange={(dropOff) => set({ dropOff })} label="Drop-off class" />
  </div>
) : null;

/** Type chips with the note under them (the editor's compact version of the step-one cards). */
export const TypeChips = ({ f, set }: { f: ClassForm; set: Patch }) => (
  <Field label="Session type" note={TYPES.find((t) => t.key === f.type)!.note}>
    <Row gap={6}>{TYPES.map((t) => <Chip key={t.key} on={f.type === t.key} onClick={() => set({ type: t.key, clearance: null })}>{t.label}</Chip>)}</Row>
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
  const tile: CSSProperties = { aspectRatio: '4 / 5', padding: 0, border: 0, borderRadius: 20, overflow: 'hidden', cursor: 'pointer' };
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(104px,1fr))', gap: 8 }}>
        <button type="button" onClick={() => input.current?.click()} disabled={busy}
          style={{ ...tile, background: 'var(--surface-raised)', color: 'var(--ink)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
          <Upload size={22} />{busy ? 'Uploading…' : 'Upload your own'}
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
      <span className="pk-caption pk-muted">JPG, PNG or WebP. Cropped to the card's shape from the centre.</span>
      <ErrorLine>{error}</ErrorLine>
    </div>
  );
}
