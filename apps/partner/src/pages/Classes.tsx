import { ImageIcon, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { errorCopy, loadSessions, removePartnerPhoto, saveClass, setBreedOnly, setPathSteps, type ClassType } from '@/lib/api';
import { breedOnlyChanged, formOf, pathStepsChanged, payloadOf, pricingChanged, type ClassForm } from '@/lib/classForm';
import { useData, usePartner } from '@/lib/partner';
import { credits } from '@/lib/sessions';
import { addDays, austin, mondayOf } from '@/lib/time';
import { Badge, Button, ClassCard, Chip, EmptyState, ErrorLine, Field, Modal, Page, PageHead, Row, Tag, photoUrl } from '@/ui/kit';
import { Ages, BreedOnly, BuiltFor, Clearance, Description, Discipline, DropOff, Duration, Energy, Fixed, Group, Intensity, Name, PathClass, PhotoGrid, Reach, Requirements, Sizes, Social, TypeChips, typeLabel, type Patch } from './classParts';

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
    <Page>
      <PageHead title="Classes" sub="What you offer on PackPass. Credit costs are set by PackPass.">
        <Button icon={Plus} onClick={() => nav('/classes/new')}>New class</Button>
      </PageHead>
      {!selected ? (
        <div className="card">
          <EmptyState title="No classes yet" body="Create your first class. PackPass sets the credit cost, then it opens on Book."><Button variant="outline" size="sm" onClick={() => nav('/classes/new')}>Create a class</Button></EmptyState>
        </div>
      ) : (
        <>
          <div className="tbl">
            <div className="tbl-head" style={{ gridTemplateColumns: CLASS_COLS, minWidth: 640 }}>
              <span /><span>Class</span><span>Type</span><span className="r">Per week</span><span className="r">Credits</span><span>Status</span>
            </div>
            {classes.map((c) => {
              const on = c.id === selected.id;
              const kind = [c.session_type === 'class' ? c.discipline : typeLabel(c.session_type), gym ? trainerName(c.trainer_id) : null].filter(Boolean).join(' · ');
              return (
                <div key={c.id} role="button" tabIndex={0} aria-current={on} onClick={() => setParams({ c: c.id })} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setParams({ c: c.id })}
                  className="tbl-row tbl-click" style={{ gridTemplateColumns: CLASS_COLS, minWidth: 640, minHeight: 44, background: on ? 'var(--hover)' : undefined, boxShadow: on ? 'inset 2px 0 0 var(--ink),inset 0 -1px 0 var(--line)' : undefined }}>
                  <img src={photoUrl(c.image)} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', background: 'var(--surface-raised)' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span className="pp-heading ellipsis">{c.title}</span>
                    {c.premium ? <Badge tone="cleared">Premium</Badge> : null}
                    {c.drop_off && c.session_type === 'class' ? <Badge>Drop-off</Badge> : null}
                  </div>
                  <span className="pp-caption pp-muted ellipsis">{kind}</span>
                  <span className="pp-label pp-num r">{perWeek(c.id)}</span>
                  <span className="pp-label pp-num r">{c.credits ?? 'Pending'}</span>
                  <div>{c.credit_review ? <Badge tone="needs">Credit review</Badge> : c.status === 'live' ? <Badge dot>Live</Badge> : <Badge tone="needs">{STATUS[c.status]}</Badge>}</div>
                </div>
              );
            })}
          </div>
          {/* Keyed so switching classes resets the editor. */}
          <Editor key={selected.id} cls={selected} partnerName={partner.short_name || partner.name} gym={gym} trainers={trainers} />
        </>
      )}
    </Page>
  );
}

const CLASS_COLS = '36px minmax(0,1.6fr) minmax(0,1fr) 80px 64px 104px';

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
      // Off goes first so Built for can be cleared in the same save; on goes after so it's checked against the new Built for.
      if (saved.breedOnly && !f.breedOnly) await setBreedOnly(cls.id, false, '');
      await saveClass(cls.id, payloadOf(f));
      if (f.breedOnly && breedOnlyChanged(saved, f)) await setBreedOnly(cls.id, true, f.breedOnlyReason);
      if (pathStepsChanged(saved, f)) await setPathSteps(cls.id, f.type === 'assessment' ? [] : f.pathSteps);
      if (cls.image !== f.image) await removePartnerPhoto(cls.image).catch(() => undefined); // a replaced upload
      await reloadCatalog(); setDone(true);
    } catch (e) { setError(errorCopy(e)); } finally { setBusy(false); }
  };

  return (
    <section style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
      <div style={{ flex: '999 1 480px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h2 className="pp-title">{`Edit ${cls.title}`}</h2>
          <Row gap={8}>
            {done && !dirty ? <span className="pp-caption pp-muted">Saved. Members see the changes on Book now.</span> : null}
            <ErrorLine>{error}</ErrorLine>
            <Button variant="outline" onClick={() => setPreview(true)}>Preview as member</Button>
            <Button disabled={!dirty || busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</Button>
          </Row>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '20px 24px' }}>
          <Name f={f} set={set} />
          <TypeChips f={f} set={set} />
          <div style={{ gridColumn: '1/-1' }}><Discipline f={f} set={set} /></div>
          <Duration f={f} set={set} />
          <Intensity f={f} set={set} />
          <Group f={f} set={set} />
          <Clearance f={f} set={set} />
          <Energy f={f} set={set} label="Suitable energy" />
          <Social f={f} set={set} />
          <Ages f={f} set={set} />
          <Sizes f={f} set={set} />
          <div style={{ gridColumn: '1/-1' }}><Requirements f={f} set={set} /></div>
          <Fixed f={f} set={set} />
          <DropOff f={f} set={set} />
          <PathClass f={f} set={set} />
          <div style={{ gridColumn: '1/-1' }}><BuiltFor f={f} set={set} /></div>
          <BreedOnly f={f} set={set} status={breedOnlyChanged(saved, f) ? null : cls.breed_only_status} />
          {gym ? (
            <Field label="Lead trainer">
              <Row gap={6}>{trainers.map((t) => <Chip key={t.id} on={f.trainerId === t.id} onClick={() => set({ trainerId: t.id })}>{t.name}</Chip>)}</Row>
            </Field>
          ) : null}
          <Description f={f} set={set} />
        </div>
      </div>
      <aside style={{ flex: '1 1 240px', maxWidth: 320, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ position: 'relative', height: 200, borderRadius: 24, overflow: 'hidden', color: '#fff' }}>
          <img src={photoUrl(f.image)} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'var(--scrim)' }} />
          <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Tag tone="glass">{f.discipline ?? typeLabel(f.type)}</Tag>
            {cls.premium ? <Tag tone="premium">Premium</Tag> : null}
            {cls.status !== 'live' ? <Tag tone="glass">{STATUS[cls.status]}</Tag> : null}
          </div>
          <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}><Button variant="glass" size="sm" icon={ImageIcon} onClick={() => setPhotos(true)}>Replace photo</Button></div>
        </div>
        <Reach f={f} />
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <span className="pp-stat-label">Credit cost</span>
            <span className={cls.credits == null ? 'pp-title' : 'pp-stat-num'}>{cls.credits == null ? 'In review' : cls.credits}</span>
          </div>
          <span className="pp-caption pp-muted" style={{ textWrap: 'pretty' }}>{creditNote}</span>
        </div>
      </aside>

      {photos ? (
        <Modal eyebrow={cls.title} title="Cover photo" width={560} onClose={() => setPhotos(false)}>
          <span className="pp-caption pp-muted">Outdoor, in motion, one dog clearly in frame. Members see this first.</span>
          <PhotoGrid value={f.image} onPick={(image) => { set({ image }); setPhotos(false); }} />
        </Modal>
      ) : null}
      {preview ? (
        <Modal eyebrow="Preview as member" title="On Book" width={300} onClose={() => setPreview(false)}>
          <ClassCard image={photoUrl(f.image)} discipline={f.discipline ?? typeLabel(f.type)} premium={cls.premium} title={f.title || cls.title}
            meta={`${f.duration} min · ${partnerName}`} credits={cls.credits == null ? 'In review' : credits(cls.credits)} spotsLeft={f.type === 'class' ? f.group : 1} />
        </Modal>
      ) : null}
    </section>
  );
}
