import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

import { errorCopy, loadAssessments, recordResult, type AssessmentRow } from '@/lib/api';
import { useData, usePartner } from '@/lib/partner';
import { partnerTraits, useTraits } from '@/lib/traits';
import { monthDay, time, weekday, ymd } from '@/lib/time';
import { useSigned } from '@/lib/useSigned';
import { Avatar, Button, Chip, ErrorLine } from '@/ui/kit';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 1240 }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="pk-wide pk-muted">Assessments · Passport</span>
        <h1 className="pk-display-xl" style={{ margin: 0 }}>Record results</h1>
        <span className="pk-label pk-muted" style={{ textWrap: 'pretty' }}>Results go to the dog's Passport. Owners see Strengths, Working on and your note, word for word.</span>
      </header>
      {!a ? <Empty>No assessments booked in the last two weeks or the next two.</Empty> : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 280px', maxWidth: 380, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.map((x) => {
              const on = x.booking_id === a.booking_id;
              return (
                <button key={x.booking_id} onClick={() => setSel(x.booking_id)} aria-pressed={on}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px 10px 10px', border: 0, borderRadius: 20, cursor: 'pointer', textAlign: 'left', background: on ? 'var(--inverse)' : 'var(--surface-raised)', color: on ? 'var(--on-inverse)' : 'var(--ink)' }}>
                  <Avatar name={x.dog_name} photo={x.photo_path ? photos[x.photo_path] : undefined} size={56} radius={12} />
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{`${x.dog_name} · ${cap(x.grants)}`}</span>
                    <span style={{ fontSize: 12, opacity: 0.7 }}>{when(new Date(x.starts_at))}</span>
                  </span>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>{status(x)}</span>
                </button>
              );
            })}
          </div>
          <Result key={a.booking_id} a={a} photo={a.photo_path ? photos[a.photo_path] : undefined} onSent={reload} />
        </div>
      )}
    </div>
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
    <div style={{ flex: '999 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <Avatar name={a.dog_name} photo={photo} size={88} radius={20} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <span className="pk-wide pk-muted">{`${when(new Date(a.starts_at))} · ${a.duration_min} min`}</span>
          <h2 className="pk-display-lg" style={{ margin: 0 }}>{`${a.dog_name} · ${cap(a.grants)} assessment`}</h2>
          <span className="pk-caption pk-muted">{`${a.breed ?? 'Dog'} · ${a.owner_name}`}</span>
        </div>
      </div>
      <div style={{ background: 'var(--surface-raised)', borderRadius: 28, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span className="pk-label" style={{ fontWeight: 600 }}>Passport</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {a.clearances.length ? a.clearances.map((k) => {
            const exp = /expired/.test(k);
            return <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 12px 0 10px', borderRadius: 9999, fontSize: 13, fontWeight: 600, background: exp ? 'var(--kennel-red-soft)' : 'var(--pitch)', color: exp ? 'var(--kennel-red)' : 'var(--on-pitch)' }}>{exp ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}{k}</span>;
          }) : <span className="pk-caption pk-muted">No clearances yet.</span>}
        </div>
        <span className="pk-caption pk-muted" style={{ textWrap: 'pretty' }}>{`From owner · ${traits.length ? traits.join(' · ') : 'None added'}`}</span>
      </div>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}><h3 className="pk-title" style={{ margin: 0 }}>Rubric</h3><span className="pk-caption pk-muted">{`${scored} of ${items.length} scored`}</span></div>
        {items.map((i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 12px 10px 20px', borderRadius: 20, background: 'var(--surface-raised)' }}>
            <span className="pk-label" style={{ flex: '1 1 200px', fontWeight: 600 }}>{i}</span>
            <Chip on={score[i] === 's'} onClick={() => set(i, 's')}>Strength</Chip>
            <Chip on={score[i] === 'w'} onClick={() => set(i, 'w')}>Working on</Chip>
          </div>
        ))}
      </section>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 className="pk-title" style={{ margin: 0 }}>Outcome</h3>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Chip on={grant} onClick={() => !done && setGrant(!grant)}>{herding ? 'Mark as assessed here' : `Grant ${cap(a.grants)} clearance`}</Chip>
          {!grant ? <Chip on={goal} onClick={() => !done && setGoal(!goal)}>Create a goal</Chip> : null}
        </div>
        <span className="pk-caption pk-muted" style={{ textWrap: 'pretty' }}>{herding
          ? `Herding results show as assessed at ${partner.name} and don't transfer to other partners.`
          : grant ? `${cap(a.grants)} clearances transfer to every PackPass partner and expire after 12 months.`
          : `Not yet. A goal puts the training path back to ${cap(a.grants)} on ${a.dog_name}'s Passport.`}</span>
      </section>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="pk-label" style={{ fontWeight: 600 }}>Note to owner</span>
        <textarea className="area" rows={3} value={note} disabled={done} onChange={(e) => setNote(e.target.value)} placeholder="Say what went well and what comes next. Describe behavior, not labels." />
      </label>
      {done ? (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '16px 20px', borderRadius: 20, background: 'var(--turf-soft)' }}>
          <span className="pk-label" style={{ fontWeight: 600, color: 'var(--turf)' }}>Sent.</span>
          <span className="pk-label">{`${a.dog_name}'s Passport is updated. ${a.owner_name.split(' ')[0] || 'The owner'} has the result.`}</span>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button disabled={busy || !started || scored === 0} onClick={send}>{busy ? 'Sending…' : 'Send result'}</Button>
          {!started ? <span className="pk-caption pk-muted">Results open once the session starts.</span> : scored === 0 ? <span className="pk-caption pk-muted">Score at least one rubric item.</span> : null}
          <ErrorLine>{error}</ErrorLine>
        </div>
      )}
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
