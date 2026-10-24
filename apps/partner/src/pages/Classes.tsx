import { Archive, CalendarPlus, Copy, ImageIcon, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { archiveClass, duplicateClass, errorCopy, loadSeries, loadSessions, loadWaiver, removePartnerPhoto, saveClass, setBreedOnly, setClassEnrollment, setClassRules, type ClassType, type Series } from '@/lib/api';
import { breedOnlyChanged, formOf, payloadOf, pricingChanged, type ClassForm } from '@/lib/classForm';
import { useData, usePartner } from '@/lib/partner';
import { credits } from '@/lib/sessions';
import { addDays, austin, monthDay, mondayOf, time } from '@/lib/time';
import { Badge, Button, ClassCard, Chip, EmptyState, ErrorLine, Field, IconButton, Modal, Page, PageHead, Row, Segmented, Stepper, Tag, Toast, Toggle, photoUrl } from '@/ui/kit';
import { Ages, BreedOnly, BuiltFor, Clearance, Description, Discipline, DropOff, Duration, Energy, Fixed, Group, Intensity, Name, PhotoGrid, Reach, Requirements, Sizes, Social, TypeChips, typeLabel, type Patch } from './classParts';
import { SeriesSheet } from './SeriesSheet';

const STATUS: Record<ClassType['status'], string> = { live: 'Live', in_review: 'In review', paused: 'Paused' };
// Hours before the start for the minimum cutoff and the free cancel window.
const HOURS = [6, 12, 24, 48];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const and = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
/** "Tue and Thu · 5:30 pm" (Monday first). */
export const seriesWhen = (s: Series) => {
  const [h, m] = s.starts.split(':').map(Number);
  return `${and([...s.weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => DOW[d]))} · ${time(austin(s.first_day, h + m / 60))}`;
};
const seriesRange = (s: Series) => `${monthDay(austin(s.first_day, 12))} to ${monthDay(austin(s.last_day, 12))}`;
const spotsLabel = (c: ClassType) => (c.packpass_spots == null || c.packpass_spots >= c.group_size ? `All ${c.group_size}` : `${c.packpass_spots} of ${c.group_size}`);

/** 03 Classes (10a): the partner's templates, with row actions to schedule a series, duplicate or archive, and an editor. */
export function Classes() {
  const { classes, partner, gym, trainers, trainerName, reloadCatalog } = usePartner();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const mon = mondayOf(new Date());
  const { data: week } = useData(() => loadSessions(austin(mon, 0), austin(addDays(mon, 7), 0)), [mon]);
  const { data: series, reload: reloadSeries } = useData(loadSeries, []);
  const perWeek = (id: string) => week?.filter((s) => s.class_id === id && !s.cancelled_at).length ?? 0;
  const active = classes.filter((c) => !c.archived_at);
  const archived = classes.filter((c) => c.archived_at);
  const selected = active.find((c) => c.id === params.get('c')) ?? active[0];
  const [scheduling, setScheduling] = useState<ClassType | null>(null);
  const [archiving, setArchiving] = useState<ClassType | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seriesOf = (id: string) => (series ?? []).filter((s) => s.class_id === id);

  const act = async (f: () => Promise<unknown>, done?: string) => {
    setError(null);
    try { await f(); await reloadCatalog(); if (done) setToast(done); } catch (e) { setError(errorCopy(e)); }
  };
  const duplicate = (c: ClassType) => act(async () => { const id = await duplicateClass(c.id); setParams({ c: id }); }, `Copy of ${c.title} made. Rename it and save.`);
  const restore = (c: ClassType) => act(() => archiveClass(c.id, false), `${c.title} restored. Schedule it again from Schedule series.`);

  return (
    <Page>
      <PageHead title="Classes" sub="Templates for what you run. Schedule a series from any template. Credit costs are set by PackPass.">
        <Button icon={Plus} onClick={() => nav('/classes/new')}>New template</Button>
      </PageHead>
      <ErrorLine>{error}</ErrorLine>
      {!selected ? (
        <div className="card">
          <EmptyState title="No classes yet" body="Create your first class. PackPass sets the credit cost, then it opens on Book."><Button variant="outline" size="sm" onClick={() => nav('/classes/new')}>Create a class</Button></EmptyState>
        </div>
      ) : (
        <>
          <div className="tbl">
            <div className="tbl-head" style={{ gridTemplateColumns: CLASS_COLS, minWidth: TABLE_MIN }}>
              <span /><span>Template</span><span>Discipline</span><span className="r">Length</span><span className="r">Credits</span><span className="r">PackPass spots</span><span className="r">Min</span><span>Requirements</span><span>Status</span><span />
            </div>
            {active.map((c) => {
              const on = c.id === selected.id;
              const ss = seriesOf(c.id);
              const when = ss.length ? `Series · ${seriesWhen(ss[0])}${ss.length > 1 ? ` +${ss.length - 1}` : ''}` : perWeek(c.id) ? `${perWeek(c.id)} this week` : 'Not scheduled';
              const sub = [c.session_type === 'class' ? (c.drop_off ? 'Drop-off' : 'Owners stay') : typeLabel(c.session_type), c.waiver_required ? 'Waiver' : null, when].filter(Boolean).join(' · ');
              const kind = [c.session_type === 'class' ? c.discipline : typeLabel(c.session_type), gym ? trainerName(c.trainer_id) : null].filter(Boolean).join(' · ');
              const reqs = c.requirements.map((r) => r.text);
              return (
                <div key={c.id} role="button" tabIndex={0} aria-current={on} onClick={() => setParams({ c: c.id })} onKeyDown={(e) => e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ') && setParams({ c: c.id })}
                  className="tbl-row tbl-click" style={{ gridTemplateColumns: CLASS_COLS, minWidth: TABLE_MIN, minHeight: 56, background: on ? 'var(--hover)' : undefined, boxShadow: on ? 'inset 2px 0 0 var(--ink),inset 0 -1px 0 var(--line)' : undefined }}>
                  <img src={photoUrl(c.image)} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', background: 'var(--surface-raised)' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <span className="pp-heading ellipsis">{c.title}</span>
                      {c.premium ? <Badge tone="cleared">Premium</Badge> : null}
                    </div>
                    <span className="pp-caption pp-muted ellipsis">{sub}</span>
                  </div>
                  <span className="pp-caption pp-muted ellipsis">{kind}</span>
                  <span className="pp-label pp-num r">{`${c.duration_min} min`}</span>
                  <span className="pp-label pp-num r">{c.credits ?? 'Pending'}</span>
                  <span className="pp-label pp-num r">{spotsLabel(c)}</span>
                  <span className="pp-label pp-num r">{c.min_dogs ?? '–'}</span>
                  <span className="pp-caption pp-muted ellipsis" title={reqs.join(', ')}>{reqs.length ? `${reqs[0]}${reqs.length > 1 ? ` +${reqs.length - 1}` : ''}` : 'None'}</span>
                  <div>{c.credit_review ? <Badge tone="needs">Credit review</Badge> : c.status === 'live' ? <Badge dot>Live</Badge> : <Badge tone="needs">{STATUS[c.status]}</Badge>}</div>
                  {/* Row actions don't select the row. */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    {c.status === 'live' ? <IconButton icon={CalendarPlus} label={`Schedule series of ${c.title}`} onClick={() => setScheduling(c)} /> : null}
                    <IconButton icon={Copy} label={`Duplicate ${c.title}`} onClick={() => duplicate(c)} />
                    <IconButton icon={Archive} label={`Archive ${c.title}`} onClick={() => setArchiving(c)} />
                  </div>
                </div>
              );
            })}
          </div>
          {archived.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button type="button" className="pp-label" aria-expanded={showArchived} onClick={() => setShowArchived((v) => !v)}
                style={{ alignSelf: 'flex-start', background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'var(--ink-muted)', textDecoration: 'underline' }}>
                {`Archived · ${archived.length}`}
              </button>
              {showArchived ? (
                <div className="tbl">
                  {archived.map((c) => (
                    <div key={c.id} className="tbl-row" style={{ gridTemplateColumns: '36px minmax(0,1fr) auto' }}>
                      <img src={photoUrl(c.image)} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', opacity: 0.6 }} />
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span className="pp-label ellipsis">{c.title}</span>
                        <span className="pp-caption pp-muted">{`Archived ${monthDay(new Date(c.archived_at!))}`}</span>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => restore(c)}>Restore</Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {/* Keyed so switching classes resets the editor. */}
          <Editor key={selected.id} cls={selected} partnerName={partner.short_name || partner.name} gym={gym} trainers={trainers}
            series={seriesOf(selected.id)} onSchedule={() => setScheduling(selected)} />
        </>
      )}

      {scheduling ? (
        <SeriesSheet cls={scheduling} onClose={() => setScheduling(null)}
          onDone={(t) => { setScheduling(null); setToast(t); reloadSeries(); }} />
      ) : null}
      {archiving ? (
        <Modal eyebrow="Archive template" title={archiving.title} onClose={() => setArchiving(null)}
          footer={<><Button variant="outline" onClick={() => setArchiving(null)}>Cancel</Button>
            <Button onClick={() => { const c = archiving; setArchiving(null); act(() => archiveClass(c.id, true), `${c.title} archived.`); }}>Archive</Button></>}>
          <span className="pp-label" style={{ textWrap: 'pretty' }}>It stops repeating weekly and can't be scheduled until you restore it. Sessions already on the schedule stay. Cancel any that shouldn't run from the schedule.</span>
        </Modal>
      ) : null}
      {toast ? <Toast onDismiss={() => setToast(null)}>{toast}</Toast> : null}
    </Page>
  );
}

const CLASS_COLS = '36px minmax(0,1.8fr) minmax(0,1fr) 64px 56px 104px 40px minmax(0,1fr) 104px 116px';
const TABLE_MIN = 1060;

function Editor({ cls, partnerName, gym, trainers, series, onSchedule }: {
  cls: ClassType; partnerName: string; gym: boolean; trainers: { id: string; name: string }[]; series: Series[]; onSchedule: () => void;
}) {
  const { reloadCatalog, partner } = usePartner();
  const saved = formOf(cls);
  const [f, setF] = useState<ClassForm>(saved);
  const set: Patch = (p) => { setF((x) => ({ ...x, ...p })); setDone(false); };
  // Booking rules save on their own (no credit review), alongside the class fields.
  const savedRules = { pp: cls.packpass_spots, waiver: cls.waiver_required, waitlist: cls.waitlist_auto };
  const [rules, setRules] = useState(savedRules);
  const setRule = (p: Partial<typeof rules>) => { setRules((r) => ({ ...r, ...p })); setDone(false); };
  const { data: waiver } = useData(async () => ({ live: await loadWaiver(partner.id) }), [partner.id]);
  const savedEnroll = { min: cls.min_dogs, cutoff: cls.min_cutoff_hours, cancel: cls.cancel_hours };
  const [enroll, setEnroll] = useState(savedEnroll);
  const setEnr = (p: Partial<typeof enroll>) => { setEnroll((x) => ({ ...x, ...p })); setDone(false); };
  const group = f.type === 'class' ? f.group : 1;
  const pp = Math.min(rules.pp ?? group, group);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState(false);
  const [preview, setPreview] = useState(false);
  useEffect(() => setError(null), [f, rules, enroll]);

  const rulesDirty = JSON.stringify(rules) !== JSON.stringify(savedRules);
  const enrollDirty = JSON.stringify(enroll) !== JSON.stringify(savedEnroll);
  const minDogs = enroll.min == null ? null : Math.min(enroll.min, group);
  const dirty = JSON.stringify(f) !== JSON.stringify(saved) || rulesDirty || enrollDirty;
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
      // After the class fields, so PackPass spots are checked against the new group size.
      if (rulesDirty || (rules.pp != null && rules.pp > group)) await setClassRules(cls.id, rules.pp == null ? null : pp, rules.waiver, rules.waitlist);
      if (enrollDirty || minDogs !== enroll.min) await setClassEnrollment(cls.id, minDogs, enroll.cutoff, enroll.cancel);
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
          <div style={{ gridColumn: '1/-1' }}><BuiltFor f={f} set={set} /></div>
          <BreedOnly f={f} set={set} status={breedOnlyChanged(saved, f) ? null : cls.breed_only_status} />
          {gym ? (
            <Field label="Lead trainer">
              <Row gap={6}>{trainers.map((t) => <Chip key={t.id} on={f.trainerId === t.id} onClick={() => set({ trainerId: t.id })}>{t.name}</Chip>)}</Row>
            </Field>
          ) : null}
          <Description f={f} set={set} />
        </div>
        <h3 className="pp-heading" style={{ marginTop: 8 }}>Booking rules</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '20px 24px' }}>
          {f.type === 'class' ? (
            <Field label="PackPass spots" note={`of ${group} · the rest stay with your direct clients`}>
              <Stepper label="PackPass spots" value={pp} onDec={() => setRule({ pp: Math.max(0, pp - 1) })} onInc={() => setRule({ pp: Math.min(group, pp + 1) })} decDisabled={pp <= 0} incDisabled={pp >= group} />
            </Field>
          ) : null}
          <Field label="Your waiver" note={waiver && !waiver.live ? 'You haven\'t added a waiver yet. Add one under Locations.' : 'Members sign it once, on their first booking with you.'}>
            <Toggle on={rules.waiver} onChange={(v) => setRule({ waiver: v })} label="Members sign your waiver"><span className="pp-label">{rules.waiver ? 'Members sign it' : 'Not needed for this class'}</span></Toggle>
          </Field>
          <Field label="Waitlist" note={rules.waitlist ? `When a spot opens, the first dog on the waitlist is booked automatically and their credits are held. Inside the ${enroll.cancel}-hour window, the owner gets 2 hours to accept, then it moves to the next dog.` : 'When a spot opens, everyone waiting is told and the first to book gets it.'}>
            <Toggle on={rules.waitlist} onChange={(v) => setRule({ waitlist: v })} label="Waitlist books automatically"><span className="pp-label">{rules.waitlist ? 'Auto-book' : 'Offer the spot'}</span></Toggle>
          </Field>
        </div>
        <span className="pp-caption pp-muted">New sessions use these rules. Sessions already on the schedule keep theirs.</span>
        <h3 className="pp-heading" style={{ marginTop: 8 }}>Enrollment and cancellation</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '20px 24px' }}>
          {f.type === 'class' ? (
            <Field label="Minimum dogs" note={minDogs == null ? 'Off. The session runs however many book.' : 'to run'}>
              <Row gap={12} wrap={false}>
                <Stepper label="minimum dogs" value={minDogs ?? 'Off'} onDec={() => setEnr({ min: minDogs == null || minDogs <= 1 ? null : minDogs - 1 })}
                  onInc={() => setEnr({ min: Math.min(group, (minDogs ?? 0) + 1) })} decDisabled={minDogs == null} incDisabled={(minDogs ?? 0) >= group} />
              </Row>
            </Field>
          ) : null}
          {f.type === 'class' && minDogs != null ? (
            <Field label="Minimum cutoff" note={`Below ${minDogs} dogs at ${enroll.cutoff} hours before start, the session cancels on its own. Members get their credits back and a notification, and the schedule marks it Cancelled (low enrollment). You can run it anyway from the session.`}>
              <Segmented label="Minimum cutoff" options={HOURS.map((h) => ({ value: String(h), label: `${h} h` }))} value={String(enroll.cutoff)} onChange={(v) => setEnr({ cutoff: Number(v) })} />
            </Field>
          ) : null}
          <Field label="Free cancel window" note={`Members cancel free until ${enroll.cancel} hours before. Later cancellations and no-shows still pay you.`}>
            <Segmented label="Free cancel window" options={HOURS.map((h) => ({ value: String(h), label: `${h} h` }))} value={String(enroll.cancel)} onChange={(v) => setEnr({ cancel: Number(v) })} />
          </Field>
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
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="pp-stat-label">Series</span>
          {series.length ? series.map((x) => (
            <div key={x.id} style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="pp-label">{seriesWhen(x)}</span>
              <span className="pp-caption pp-muted">{`${seriesRange(x)} · ${x.upcoming} to come · ${x.booked} booked`}</span>
            </div>
          )) : <span className="pp-label pp-muted">Not scheduled yet.</span>}
          {cls.status === 'live'
            ? <Button variant="outline" size="sm" icon={CalendarPlus} onClick={onSchedule} style={{ alignSelf: 'flex-start' }}>Schedule</Button>
            : <span className="pp-caption pp-muted">You can schedule it once PackPass sets the credit cost.</span>}
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
