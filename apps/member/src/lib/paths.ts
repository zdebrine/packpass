// Training paths (10). Sample mode shows the designs' two paths (src/data/passport.ts); live mode builds
// them from my_paths: the steps, which are done (and when), and which is next.
import { isLive } from '@/api/client';
import { catalog } from '@/data/catalog';
import { goals as sampleGoals, type Goal, type PathStep } from '@/data/passport';
import type { LogEntry, PathProgress } from '@/data/types';
import { useApp, useDog } from '@/store/app';
import { credits } from './booking';
import { monthDay } from './dates';

const typeName = (t: 'social' | 'herding') => (t === 'social' ? 'Social' : 'Herding');

/** "Private session · Sam Reyes · 3 credits" */
function stepMeta(classId: string) {
  const cls = catalog.classes[classId];
  if (!cls) return '';
  const kind = cls.sessionType === 'Private' ? 'Private session' : cls.sessionType === 'Assessment' ? 'Assessment' : cls.groupSize <= 6 ? 'Small group' : 'Group class';
  const who = cls.sessionType === 'Private' ? catalog.trainers[cls.trainerId]?.name : catalog.partners[cls.partnerId]?.name;
  return [kind, who, credits(cls.credits)].filter(Boolean).join(' · ');
}

export function liveGoal(p: PathProgress, dogName: string, log: LogEntry[]): Goal {
  const started = !!p.startedAt;
  const complete = !!p.completedAt;
  const last = p.steps.length - 1;
  const steps = p.steps.map((s, i): PathStep => {
    const meta = stepMeta(s.classId);
    if (complete || (started && s.position < p.nextStep)) {
      const when = s.doneAt ?? (i === last ? p.completedAt : null);
      const label = i === last && p.grants && complete
        ? `Passed${when ? ` ${monthDay(when)}` : ''}. ${typeName(p.grants)} cleared.`
        : when ? `Done ${monthDay(when)}` : 'Done';
      return { title: s.title, meta, state: 'done', stateLabel: label };
    }
    if (started && s.position === p.nextStep) return { title: s.title, meta, state: 'next', stateLabel: 'Next', classId: s.classId };
    if (i === last) {
      return { title: s.title, meta, state: 'final',
        stateLabel: p.grants ? `Unlocks the ${typeName(p.grants)} clearance${p.grants === 'social' ? ' and group sport' : ''}` : `Ends with ${s.title.charAt(0).toLowerCase()}${s.title.slice(1)}` };
    }
    return { title: s.title, meta, state: 'locked', stateLabel: i === 0 ? 'Opens when you start the path' : `Opens after step ${i}` };
  });

  const lastDone = [...p.steps].reverse().find((s) => s.doneAt);
  const notYet = p.grants ? log.find((e) => e.assessment?.type === p.grants && e.assessment.outcome === 'not_yet') : undefined;
  const updated = complete ? `Complete · ${monthDay(p.completedAt!)}`
    : !started ? `${p.steps.length} steps`
    : lastDone ? `Step ${lastDone.position} done ${monthDay(lastDone.doneAt!)}`
    : notYet && notYet.startsAt >= p.startedAt! ? `Updated after the ${typeName(p.grants!)} assessment, ${monthDay(notYet.startsAt)}`
    : `Started ${monthDay(p.startedAt!)}`;

  return {
    id: p.id as Goal['id'],
    title: p.title,
    lede: p.lede.replace(/your dog/g, dogName),
    updated,
    steps,
    trainers: p.grants === 'social' ? 'reactivity' : 'leash',
    started,
  };
}

/** The dog's paths (started ones, in progress first) and the ones it could start. */
export function useGoals(): { goals: Goal[]; available: Goal[] } {
  const social = useApp((s) => s.social);
  const paths = useApp((s) => s.paths);
  const log = useApp((s) => s.log);
  const dog = useDog();
  if (!isLive || !paths) return { goals: sampleGoals(social), available: [] };
  const all = paths.map((p) => liveGoal(p, dog.name, log ?? []));
  return { goals: all.filter((g) => g.started), available: all.filter((g) => !g.started) };
}
