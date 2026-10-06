import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { errorCopy, loadSessions, removePartnerPhoto, saveClass, type ClassType } from '@/lib/api';
import { formOf, payloadOf, pricingChanged, type ClassForm } from '@/lib/classForm';
import { useData, usePartner } from '@/lib/partner';
import { credits } from '@/lib/sessions';
import { addDays, austin, mondayOf } from '@/lib/time';
import { Button, ClassCard, Chip, ErrorLine, Field, Modal, Row, Tag, photoUrl } from '@/ui/kit';
import { Clearance, Description, Discipline, DropOff, Duration, Energy, Group, Intensity, Name, PhotoGrid, Requirements, Social, TypeChips, typeLabel, type Patch } from './classParts';

const STATUS: Record<ClassType['status'], string> = { live: 'Live', in_review: 'In review', paused: 'Paused' };

/** 03 Classes: every class the partner offers, with an editor for the selected one. */
export function Classes() {
  const { classes, partner, gym, trainers, trainerName } = usePartner();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const mon = mondayOf(new Date());
  const { data: week } = useData(() => loadSessions(austin(mon, 0), austin(addDays(mon, 7), 0)), [mon]);
  const perWeek = (id: string) => week?.filter((s) => s.class_id === id && !s.cancelled_at).length ?? 0;
  const selected = classes.find((c) => c.id === params.get('c')) ?? classes[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 1240 }}>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="pk-wide pk-muted">Offering</span>
          <h1 className="pk-display-xl" style={{ margin: 0 }}>Classes</h1>
        </div>
        <Button size="sm" onClick={() => nav('/classes/new')}>New class</Button>
      </header>
      {!selected ? (
        <div className="card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
          <span className="pk-title">No classes yet</span>
          <span className="pk-body pk-muted">Create your first class. PackPass sets the credit cost, then it opens on Book.</span>
          <Button onClick={() => nav('/classes/new')}>Create a class</Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 280px', maxWidth: 380, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {classes.map((c) => {
              const on = c.id === selected.id;
              const meta = [c.session_type === 'class' ? c.discipline : typeLabel(c.session_type), gym ? trainerName(c.trainer_id) : null, `${perWeek(c.id)} this week`].filter(Boolean).join(' · ');
              return (
                <button key={c.id} type="button" onClick={() => setParams({ c: c.id })} aria-current={on}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px 10px 10px', border: 0, borderRadius: 20, cursor: 'pointer', background: on ? 'var(--inverse)' : 'var(--surface-raised)', color: on ? 'var(--on-inverse)' : 'var(--ink)' }}>
                  <img src={photoUrl(c.image)} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', flex: 'none' }} />
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'left' }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{c.title}</span>
                    <span style={{ fontSize: 12, opacity: 0.7 }}>{meta}</span>
                    {c.drop_off && c.session_type === 'class' ? <span style={{ alignSelf: 'flex-start', marginTop: 2 }}><Tag tone="signal">Drop-off</Tag></span> : null}
                  </span>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>{c.credit_review ? 'Credit review' : STATUS[c.status]}</span>
                </button>
              );
            })}
          </div>
          {/* Keyed so switching classes resets the editor. */}
          <Editor key={selected.id} cls={selected} partnerName={partner.short_name || partner.name} gym={gym} trainers={trainers} />
        </div>
      )}
    </div>
  );
}

function Editor({ cls, partnerName, gym, trainers }: { cls: ClassType; partnerName: string; gym: boolean; trainers: { id: string; name: string }[] }) {
  const { reloadCatalog } = usePartner();
  const saved = formOf(cls);
  const [f, setF] = useState<ClassForm>(saved);
  const set: Patch = (p) => { setF((x) => ({ ...x, ...p })); setDone(false); };
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState(false);
  const [preview, setPreview] = useState(false);
  useEffect(() => setError(null), [f]);

  const dirty = JSON.stringify(f) !== JSON.stringify(saved);
  const review = cls.status === 'live' && pricingChanged(saved, f);
  const creditNote = cls.credits == null
    ? 'PackPass is reviewing this class. Credit cost is set within 2 business days, then the class goes live.'
    : review ? 'You changed duration, intensity, group size or type. Saving sends the class to PackPass for a credit review. Current bookings keep their price.'
    : cls.credit_review ? 'PackPass is reviewing the credit cost after your last change. The current cost applies until then.'
    : `Set by PackPass from duration, intensity and group size.${cls.premium ? ' Premium status is also set by PackPass.' : ''}`;

  const save = async () => {
    setBusy(true); setError(null);
    try {
      await saveClass(cls.id, payloadOf(f));
      if (cls.image !== f.image) await removePartnerPhoto(cls.image).catch(() => undefined); // a replaced upload
      await reloadCatalog(); setDone(true);
    } catch (e) { setError(errorCopy(e)); } finally { setBusy(false); }
  };

  return (
    <div style={{ flex: '999 1 480px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ position: 'relative', height: 260, borderRadius: 28, overflow: 'hidden', color: '#fff' }}>
        <img src={photoUrl(f.image)} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'var(--scrim)' }} />
        <div style={{ position: 'absolute', top: 18, left: 18, right: 18, display: 'flex', justifyContent: 'space-between' }}>
          <Row gap={6}>
            <Tag tone="glass">{f.discipline ?? typeLabel(f.type)}</Tag>
            {cls.premium ? <Tag tone="premium">Premium</Tag> : null}
            {f.dropOff && f.type === 'class' ? <Tag tone="glass">Drop-off</Tag> : null}
            {cls.status !== 'live' ? <Tag tone="glass">{STATUS[cls.status]}</Tag> : null}
          </Row>
          <Button variant="glass" size="sm" onClick={() => setPhotos(true)}>Replace photo</Button>
        </div>
        <div style={{ position: 'absolute', left: 22, bottom: 20 }}><h2 className="pk-display-lg" style={{ margin: 0 }}>{f.title || cls.title}</h2></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '24px 32px' }}>
        <Name f={f} set={set} />
        <Discipline f={f} set={set} />
        <Duration f={f} set={set} />
        <Intensity f={f} set={set} />
        <Group f={f} set={set} />
        <Energy f={f} set={set} label="Suitable for" />
        <Social f={f} set={set} />
        <Description f={f} set={set} />
        <TypeChips f={f} set={set} />
        <Clearance f={f} set={set} />
        <Requirements f={f} set={set} />
        <DropOff f={f} set={set} />
        {gym ? (
          <Field label="Lead trainer">
            <Row gap={6}>{trainers.map((t) => <Chip key={t.id} on={f.trainerId === t.id} onClick={() => set({ trainerId: t.id })}>{t.name}</Chip>)}</Row>
          </Field>
        ) : null}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <span className="pk-label" style={{ fontWeight: 600 }}>Credit cost</span>
            <span className="pk-display-md">{cls.credits == null ? 'In review' : credits(cls.credits)}</span>
          </div>
          <span className="pk-caption pk-muted" style={{ textWrap: 'pretty' }}>{creditNote}</span>
        </div>
      </div>

      <Row gap={10}>
        <Button disabled={!dirty || busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</Button>
        <Button variant="quiet" onClick={() => setPreview(true)}>Preview as member</Button>
        {done && !dirty ? <span className="pk-label pk-muted">Saved. Members see the changes on Book now.</span> : null}
        <ErrorLine>{error}</ErrorLine>
      </Row>

      {photos ? (
        <Modal eyebrow={cls.title} title="Cover photo" onClose={() => setPhotos(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <span className="pk-caption pk-muted">Outdoor, in motion, one dog clearly in frame. Members see this first.</span>
            <PhotoGrid value={f.image} onPick={(image) => { set({ image }); setPhotos(false); }} />
          </div>
        </Modal>
      ) : null}
      {preview ? (
        <Modal eyebrow="Preview as member" title="On Book" width={380} onClose={() => setPreview(false)}>
          <ClassCard image={photoUrl(f.image)} discipline={f.discipline ?? typeLabel(f.type)} premium={cls.premium} title={f.title || cls.title}
            meta={`${f.duration} min · ${partnerName}`} credits={cls.credits == null ? 'In review' : credits(cls.credits)} spotsLeft={f.type === 'class' ? f.group : 1} />
        </Modal>
      ) : null}
    </div>
  );
}
