import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

import { errorCopy, loadAssessments, recordResult, type AssessmentRow } from '@/lib/api';
import { useData, usePartner } from '@/lib/partner';
import { partnerTraits, useTraits } from '@/lib/traits';
import { monthDay, time, weekday, ymd } from '@/lib/time';
import { useSigned } from '@/lib/useSigned';
import { Avatar, Badge, Button, Checkbox, ErrorLine, Field, Page } from '@/ui/kit';
import { Empty, Loading } from './Overview';

const RUBRIC: Record<string, string[]> = {
  social: ['Greets new dogs calmly', 'Reads and respects signals', 'Recovers after a startle', 'Play stays balanced', 'Comes away from play when called'],
  herding: ['Stock awareness', 'Responds to a stop', 'Takes direction off stock', 'Pressure on stock', 'Calm at the gate'],
};
const when = (d: Date) => `${ymd(d) === ymd(new Date()) ? 'Today' : `${weekday(d).slice(0, 3)} ${monthDay(d)}`} · ${time(d)}`;

/** 09 Assessments: score the rubric, grant the clearance or set a goal, and send the result to the Passport. */
export function Assessments() {
  const { data, reload } = useData(() => loadAssessments(), []);
  const [sel, setSel] = useState<string | null>(null);
  const photos = useSigned('dog-photos', data?.map((a) => a.photo_path) ?? []);
  if (!data) return <Loading />;
  const now = new Date();
  const a = data.find((x) => x.booking_id === sel) ?? data.find((x) => !x.outcome && new Date(x.starts_at) < now) ?? data[0];
  const status = (x: AssessmentRow) => (x.outcome ? 'Sent' : new Date(x.starts_at) < now ? 'Needs result' : 'Booked');

  return (
    <Page gap={20}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1 className="pp-page-title">Assessments</h1>
        <span className="pp-caption pp-muted" style={{ textWrap: 'pretty' }}>Results go to the dog's Passport. Owners see Strengths, Working on and your note, word for word.</span>
      </header>
      {!a ? <Empty>No assessments booked in the last two weeks or the next two.</Empty> : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
          <div className="tbl" style={{ flex: '1 1 260px', maxWidth: 360 }}>
            {data.map((x) => {
              const on = x.booking_id === a.booking_id;
              const st = status(x);
              return (
                <div key={x.booking_id} role="button" tabIndex={0} aria-pressed={on} className="tbl-row tbl-click" onClick={() => setSel(x.booking_id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSel(x.booking_id)}
                  style={{ gridTemplateColumns: '36px minmax(0,1fr) auto', minHeight: 56, background: on ? 'var(--hover)' : undefined, boxShadow: on ? 'inset 2px 0 0 var(--ink),inset 0 -1px 0 var(--line)' : undefined }}>
                  <Avatar name={x.dog_name} photo={x.photo_path ? photos[x.photo_path] : undefined} size={36} radius={8} />
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <span className="pp-heading ellipsis">{`${x.dog_name} · ${cap(x.grants)}`}</span>
                    <span className="pp-caption pp-muted">{when(new Date(x.starts_at))}</span>
                  </div>
                  <Badge tone={st === 'Needs result' ? 'needs' : 'neutral'}>{st}</Badge>
                </div>
              );
            })}
          </div>
          <Result key={a.booking_id} a={a} photo={a.photo_path ? photos[a.photo_path] : undefined} onSent={reload} />
        </div>
      )}
    </Page>
  );
}

function Result({ a, photo, onSent }: { a: AssessmentRow; photo?: string; onSent: () => void }) {
  const { partner } = usePartner();
  const done = !!a.outcome;
  const items = RUBRIC[a.grants] ?? [];
  const [score, setScore] = useState<Record<string, 's' | 'w' | undefined>>(() =>
    Object.fromEntries([...a.strengths.map((x) => [x, 's']), ...a.working_on.map((x) => [x, 'w'])]));
  const [grant, setGrant] = useState(a.outcome === 'cleared');
  const [goal, setGoal] = useState(false);
  const [note, setNote] = useState(a.quote ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = new Date(a.starts_at) <= new Date();
  const scored = items.filter((i) => score[i]).length;
  const set = (i: string, v: 's' | 'w') => !done && setScore((x) => ({ ...x, [i]: x[i] === v ? undefined : v }));
  const send = async () => {
    setBusy(true); setError(null);
    try {
      await recordResult(a.booking_id, grant ? 'cleared' : 'not_yet', items.filter((i) => score[i] === 's'), items.filter((i) => score[i] === 'w'), note, !grant && goal);
      onSent();
    } catch (e) { setError(errorCopy(e)); setBusy(false); }
  };
  const herding = a.grants === 'herding';
  useTraits(); // re-renders once the trait catalog loads
  const traits = partnerTraits(a.traits);

  return (
    <div style={{ flex: '999 1 440px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Avatar name={a.dog_name} photo={photo} size={56} radius={12} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span className="pp-caption pp-muted">{`${when(new Date(a.starts_at))} · ${a.duration_min} min · ${a.breed ?? 'Dog'} · ${a.owner_name}`}</span>
          <h2 className="pp-page-title">{`${a.dog_name} · ${cap(a.grants)} assessment`}</h2>
        </div>
      </div>
      <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="pp-label">Passport</span>
          {a.clearances.length ? a.clearances.map((k) => {
            const exp = /expired/.test(k);
            return <Badge key={k} tone={exp ? 'warning' : 'cleared'} icon={exp ? ShieldAlert : ShieldCheck}>{k}</Badge>;
          }) : <span className="pp-caption pp-muted">No clearances yet.</span>}
        </div>
        <span className="pp-caption pp-muted" style={{ textWrap: 'pretty' }}>{`From owner · ${traits.length ? traits.join(' · ') : 'None added'}`}</span>
      </div>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}><h3 className="pp-title">Rubric</h3><span className="pp-caption pp-muted">{`${scored} of ${items.length} scored`}</span></div>
        <div className="tbl">
          <div className="tbl-head" style={{ gridTemplateColumns: RUBRIC_COLS }}>
            <span>Skill</span><span style={{ textAlign: 'center' }}>Strength</span><span style={{ textAlign: 'center' }}>Working on</span>
          </div>
          {items.map((i) => (
            <div key={i} className="tbl-row" style={{ gridTemplateColumns: RUBRIC_COLS, minHeight: 44 }}>
              <span className="pp-body">{i}</span>
              <Radio on={score[i] === 's'} label={`${i}: Strength`} filled onClick={() => set(i, 's')} />
              <Radio on={score[i] === 'w'} label={`${i}: Working on`} onClick={() => set(i, 'w')} />
            </div>
          ))}
        </div>
      </section>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 className="pp-title">Outcome</h3>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <Checkbox on={grant} disabled={done} onChange={setGrant}>{herding ? 'Mark as assessed here' : `Grant ${cap(a.grants)} clearance`}</Checkbox>
          {!grant ? <Checkbox on={goal} disabled={done} onChange={setGoal}>Create a goal</Checkbox> : null}
        </div>
        <span className="pp-caption pp-muted" style={{ textWrap: 'pretty' }}>{herding
          ? `Herding results show as assessed at ${partner.name} and don't transfer to other partners.`
          : grant ? `${cap(a.grants)} clearances transfer to every PackPass partner and expire after 12 months.`
          : `Not yet. A goal puts the training path back to ${cap(a.grants)} on ${a.dog_name}'s Passport.`}</span>
      </section>
      <Field label="Note to owner">
        <textarea className="area" rows={3} value={note} disabled={done} onChange={(e) => setNote(e.target.value)} placeholder="Say what went well and what comes next. Describe behavior, not labels." />
      </Field>
      {done ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 14px', borderRadius: 12, background: 'var(--turf-soft)' }}>
          <span className="pp-label" style={{ color: 'var(--turf)' }}>Sent.</span>
          <span className="pp-label">{`${a.dog_name}'s Passport is updated. ${a.owner_name.split(' ')[0] || 'The owner'} has the result.`}</span>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button disabled={busy || !started || scored === 0} onClick={send}>{busy ? 'Sending…' : 'Send result'}</Button>
          {!started ? <span className="pp-caption pp-muted">Results open once the session starts.</span> : scored === 0 ? <span className="pp-caption pp-muted">Score at least one rubric item.</span> : null}
          <ErrorLine>{error}</ErrorLine>
        </div>
      )}
    </div>
  );
}

const RUBRIC_COLS = 'minmax(0,1fr) 84px 84px';

/** A rubric choice: Strength is a filled pitch dot, Working on a ring. */
const Radio = ({ on, label, filled, onClick }: { on: boolean; label: string; filled?: boolean; onClick: () => void }) => (
  <button type="button" role="radio" aria-checked={on} aria-label={label} onClick={onClick}
    style={{ justifySelf: 'center', width: 28, height: 28, border: 0, background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
    <span style={{ width: 18, height: 18, borderRadius: 9999, boxShadow: on ? (filled ? 'inset 0 0 0 5px var(--pitch),inset 0 0 0 18px var(--on-pitch)' : 'inset 0 0 0 5px var(--ink),inset 0 0 0 18px var(--surface)') : 'inset 0 0 0 1.5px var(--line-strong)' }} />
  </button>
);

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
