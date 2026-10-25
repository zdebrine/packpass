import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { errorCopy } from '@/api/errors';
import { catalog } from '@/data/catalog';
import {
  ACTIVITIES, activityById, drillById, drillsFor, skillById, skillLabel, type ActivityKind, type Balance, type Rating,
} from '@/data/practice';
import type { Dog, HomeActivity } from '@/data/types';
import { Button, Chip } from '@/ds/controls';
import { Icon, type IconName } from '@/ds/Icon';
import { IconButton, useBottom } from '@/ds/layout';
import { Overlay } from '@/ds/overlay';
import { Press } from '@/ds/Press';
import { useWide } from '@/ds/responsive';
import { ModalSheet } from '@/ds/sheet';
import { Gradient, Photo, PhotoFill } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { useFocusSkills, useLogView, useParkGuard } from '@/features/log/view';
import { now } from '@/lib/clock';
import { dayOffset, dayTimeInline, monthDay, weekday } from '@/lib/dates';
import { countLabel } from '@/lib/log';
import { useApp, useDog } from '@/store/app';
import { fonts } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

type Step = 'pick' | 'details' | 'logged';
type When = 'now' | 'earlier' | 'yesterday' | 'day';
const WHEN: [When, string][] = [['now', 'Now'], ['earlier', 'Earlier today'], ['yesterday', 'Yesterday'], ['day', 'Pick a day']];
const DURATIONS = [10, 20, 30, 45, 60];
const RATINGS: [Rating, string][] = [['tough', 'Tough'], ['mixed', 'Mixed'], ['good', 'Good']];
const BALANCES: [Balance, string][] = [['physical', 'Physical'], ['mental', 'Mental'], ['social', 'Social']];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Form {
  kind: ActivityKind;
  when: When;
  /** Pick a day: days before today (2 to 8). */
  daysAgo: number;
  dur: number;
  skills: string[];
  rating: Rating | null;
  note: string;
  dogIds: string[];
  balance: Balance | null;
  drillId: string | null;
  reps: number | null;
  /** The dog park, from outside the fence. */
  guard: boolean;
}

const back = () => (router.canGoBack() ? router.back() : router.replace('/log'));

/** When the activity happened, from the When chips. Editing keeps the logged time while its day is unchanged. */
function doneAt(f: Form, original?: Date): Date {
  const at = now();
  const today = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  const offset = f.when === 'now' || f.when === 'earlier' ? 0 : f.when === 'yesterday' ? 1 : f.daysAgo;
  if (original && dayOffset(original, at) === -offset) return original;
  if (f.when === 'now') return at;
  if (f.when === 'earlier') return new Date(Math.max(today.getTime() + 60_000, at.getTime() - 2 * 3_600_000));
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
  return f.when === 'yesterday' ? new Date(day.getTime() + (at.getTime() - today.getTime())) : new Date(day.getTime() + 12 * 3_600_000);
}

function whenOf(d: Date): Pick<Form, 'when' | 'daysAgo'> {
  const off = -dayOffset(d, now());
  return off <= 0 ? { when: 'earlier', daysAgo: 2 } : off === 1 ? { when: 'yesterday', daysAgo: 2 } : { when: 'day', daysAgo: Math.min(off, 8) };
}

/**
 * Log activity (LOG_AT_HOME_SPEC.md §5.6, Pack Log pick / details / logged / edit): what the dog did, how it went,
 * then what it counted toward. ?edit=<id> edits a logged activity; ?drill=<id>&dur=&reps= comes from a practice session.
 */
export default function LogActivity() {
  const { c } = useTheme();
  const wide = useWide();
  const bottom = useBottom(34);
  const params = useLocalSearchParams<{ edit?: string; drill?: string; dur?: string; reps?: string; kind?: string; skills?: string }>();
  const dog = useDog();
  const dogs = useApp((s) => s.dogs);
  const homeLog = useApp((s) => s.homeLog);
  const logHome = useApp((s) => s.logHome);
  const editHome = useApp((s) => s.editHome);
  const deleteHome = useApp((s) => s.deleteHome);
  const focus = useFocusSkills(dog);
  const guarded = useParkGuard(dog);
  const view = useLogView(dog);
  const editing = params.edit ? homeLog.find((h) => h.id === params.edit) : undefined;
  // ?kind=walk skips the pick step (the Log's "Log a walk"), so a walk takes two taps.
  const preset = ACTIVITIES.find((a) => a.id === params.kind)?.id;

  const start = (kind: ActivityKind, extra: Partial<Form> = {}): Form => {
    const a = activityById(kind);
    return {
      kind, when: 'now', daysAgo: 2, dur: 30, skills: a.skills.filter((s) => focus.includes(s)), rating: null, note: '',
      dogIds: [dog.id], balance: null, drillId: null, reps: null, guard: false, ...extra,
    };
  };
  const [step, setStep] = useState<Step>(() => (editing || params.drill || preset ? 'details' : 'pick'));
  const [form, setForm] = useState<Form>(() => {
    if (editing) {
      return {
        kind: editing.kind, ...whenOf(editing.doneAt), dur: editing.durationMin, skills: editing.skills, rating: editing.rating,
        note: editing.note ?? '', dogIds: [editing.dogId], balance: editing.kind === 'other' ? editing.balance : null,
        drillId: editing.drillId, reps: editing.reps, guard: false,
      };
    }
    const drill = params.drill ? drillById(params.drill) : undefined;
    if (drill) return start(drill.activity, { dur: Math.max(1, Number(params.dur) || drill.minutes), skills: [drill.skillId], drillId: drill.id, reps: params.reps ? Number(params.reps) : null });
    // ?skills= (Log practice from a Learn video) picks the video's skills.
    const picked = params.skills?.split(',').filter((id) => skillById(id));
    return start(preset ?? 'walk', picked?.length ? { skills: picked } : {});
  });
  const [otherDur, setOtherDur] = useState(() => !DURATIONS.includes(form.dur));
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const activity = activityById(form.kind);
  const many = form.dogIds.length > 1;
  const names = dogs.filter((d) => form.dogIds.includes(d.id)).map((d) => d.name);
  const last = homeLog.find((h) => h.dogId === dog.id);
  const drill = form.drillId ? drillById(form.drillId) : undefined;
  const verb = activity.label.toLowerCase();

  const input = (f: Form) => ({
    dogIds: f.dogIds, kind: f.kind, doneAt: doneAt(f, editing?.doneAt), durationMin: f.dur, skills: f.skills, rating: f.rating,
    note: f.note, balance: f.kind === 'other' ? f.balance : null, drillId: f.drillId, reps: f.reps,
  });
  const save = async (f: Form) => {
    setBusy('save');
    setError(null);
    try {
      if (editing) {
        await editHome(editing.id, input(f));
        back();
        return;
      }
      await logHome(input(f));
      setForm(f);
      setStep('logged');
    } catch (e) {
      setError(errorCopy(e));
    } finally {
      setBusy(null);
    }
  };
  const remove = async () => {
    if (!editing) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy('delete');
    try {
      await deleteHome(editing.id);
      back();
    } catch (e) {
      setError(errorCopy(e));
      setBusy(null);
    }
  };
  const repeat = (h: HomeActivity) => save({
    ...start(h.kind), dur: h.durationMin, skills: h.skills, rating: h.rating, balance: h.kind === 'other' ? h.balance : null,
  });

  const label = (t: string) => <Text variant="label" weight="600" style={{ marginBottom: 10 }}>{t}</Text>;
  const chips = (children: React.ReactNode) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>;

  // ---- Step 1: What did you do? ----
  const tile = (a: (typeof ACTIVITIES)[number]) => {
    const g = a.id === 'park' && guarded;
    const pick = () => {
      setForm(g ? start('park', { dur: 10, skills: ['calm_dogs'], drillId: 'watch-the-park', guard: true }) : start(a.id));
      setOtherDur(false);
      setStep('details');
    };
    return (
      <Press key={a.id} onPress={pick} accessibilityRole="button" accessibilityLabel={g ? `${a.label}. Try from outside the fence first` : a.label}
        style={{ width: wide ? '31.8%' : '48.5%', height: 116, borderRadius: 16, overflow: 'hidden', backgroundColor: c.surfaceSunken }}>
        <PhotoFill name={a.image} />
        <Gradient stops={[['rgba(0,0,0,0.05)', 0], ['rgba(0,0,0,0.72)', 1]]} style={{ position: 'absolute', inset: 0 } as never} />
        {g ? (
          <View style={{ position: 'absolute', top: 8, left: 8, height: 24, paddingHorizontal: 9, borderRadius: 9999, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="eye" size={12} color="#fff" />
            <Text variant="caption" weight="600" color="#fff">Distance work</Text>
          </View>
        ) : null}
        <View style={{ position: 'absolute', left: 12, right: 12, bottom: 10, gap: 2 }}>
          <Text variant="heading" color="#fff">{a.label}</Text>
          {g ? <Text variant="caption" color="rgba(255,255,255,0.92)">Try from outside the fence first</Text> : null}
        </View>
      </Press>
    );
  };
  const pickStep = (
    <View>
      {last ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingLeft: 14, borderRadius: 16, backgroundColor: c.surfaceRaised, marginBottom: 16 }}>
          <View style={{ width: 40, height: 40, borderRadius: 9999, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}><Icon name="rotate-ccw" size={18} /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="caption" muted>Repeat last</Text>
            <Text variant="heading">{[activityById(last.kind).label, `${last.durationMin} min`, ...last.skills.slice(0, 1).map(skillLabel)].join(' · ')}</Text>
            <Text variant="caption" muted>{dayWord(last.doneAt)}</Text>
          </View>
          <Button size="sm" disabled={!!busy} onPress={() => repeat(last)}>{busy ? 'Logging…' : 'Log again'}</Button>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>{ACTIVITIES.map(tile)}</View>
      {error ? <Text variant="label" color={c.kennelRed} style={{ marginTop: 12 }}>{error}</Text> : null}
    </View>
  );

  // ---- Step 2: How did it go? ----
  const skillOptions = [...new Set([...(activity.skills.length ? activity.skills : ['loose_leash', 'recall', 'settle_public']), ...focus, ...form.skills])];
  const context = form.guard
    ? { icon: 'eye' as IconName, text: `${dog.name} is still working on Calm around dogs. Suggested drill: Watch the park, from outside the fence.` }
    : drill && !editing ? { icon: 'timer' as IconName, text: `From practice: ${drill.title} · ${form.dur} min${form.reps != null ? ` · ${form.reps} ${form.reps === 1 ? 'rep' : 'reps'}` : ''}` }
    : null;
  const trainerLed = form.skills.map(skillById).find((k) => k?.trainerLed);
  const detailsStep = (
    <View style={{ gap: 24 }}>
      {dogs.length > 1 && !editing ? (
        <View>
          {label('Dogs')}
          {chips(dogs.map((d) => <DogChip key={d.id} dog={d} on={form.dogIds.includes(d.id)} onPress={() => set({ dogIds: form.dogIds.includes(d.id) ? form.dogIds.filter((x) => x !== d.id) : [...form.dogIds, d.id] })} />))}
        </View>
      ) : null}
      {context ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: c.surfaceRaised }}>
          <Icon name={context.icon} size={18} />
          <Text variant="label" style={{ flex: 1 }}>{context.text}</Text>
        </View>
      ) : null}
      <View>
        {label('When')}
        {chips(WHEN.map(([id, l]) => <Chip key={id} selected={form.when === id} onPress={() => set({ when: id })}>{l}</Chip>))}
        {form.when === 'day' ? (
          <View style={{ marginTop: 10 }}>
            {chips(Array.from({ length: 7 }, (_, i) => i + 2).map((n) => {
              const d = new Date(now().getFullYear(), now().getMonth(), now().getDate() - n);
              return <Chip key={n} selected={form.daysAgo === n} onPress={() => set({ daysAgo: n })}>{`${DAY_NAMES[d.getDay()]} ${monthDay(d)}`}</Chip>;
            }))}
          </View>
        ) : null}
      </View>
      <View>
        {label('How long')}
        {chips([
          ...DURATIONS.map((n) => <Chip key={n} selected={!otherDur && form.dur === n} onPress={() => { setOtherDur(false); set({ dur: n }); }}>{`${n} min`}</Chip>),
          <Chip key="other" selected={otherDur} onPress={() => setOtherDur(true)}>{otherDur ? `${form.dur} min` : 'Other'}</Chip>,
        ])}
        {otherDur ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <TextInput
              value={String(form.dur || '')} onChangeText={(t) => set({ dur: Math.min(600, Number(t.replace(/\D/g, '')) || 0) })}
              keyboardType="number-pad" accessibilityLabel="Minutes" maxLength={3}
              style={{ width: 88, height: 44, borderRadius: 12, paddingHorizontal: 14, backgroundColor: c.surfaceRaised, fontFamily: fonts.sans, fontSize: 16, color: c.ink, outlineStyle: 'none' } as never}
            />
            <Text variant="label" muted>minutes</Text>
          </View>
        ) : null}
      </View>
      {form.kind === 'other' ? (
        <View>
          {label('Counts toward')}
          {chips(BALANCES.map(([id, l]) => <Chip key={id} selected={form.balance === id} onPress={() => set({ balance: form.balance === id ? null : id })}>{l}</Chip>))}
        </View>
      ) : null}
      <View>
        {label('What you worked on')}
        {chips(skillOptions.map((id) => {
          const on = form.skills.includes(id);
          return <Chip key={id} selected={on} onPress={() => set({ skills: on ? form.skills.filter((x) => x !== id) : [...form.skills, id] })}>{skillLabel(id)}</Chip>;
        }))}
        {trainerLed ? <Text variant="caption" muted style={{ marginTop: 10 }}>{`${trainerLed.label} is best worked on with a trainer. Keep home sessions short and easy.`}</Text> : null}
      </View>
      <View>
        {label(many ? 'How did they do?' : `How did ${names[0] ?? dog.name} do?`)}
        <View style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: 9999, backgroundColor: c.surfaceRaised }} accessibilityRole="radiogroup">
          {RATINGS.map(([id, l]) => {
            const on = form.rating === id;
            return (
              <Press key={id} onPress={() => set({ rating: on ? null : id })} accessibilityRole="radio" accessibilityState={{ checked: on }}
                style={{ flex: 1, height: 40, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.bg : 'transparent' }}>
                <Text variant="label" weight="600" color={on ? c.ink : c.inkMuted}>{l}</Text>
              </Press>
            );
          })}
        </View>
      </View>
      <View>
        {label('Note')}
        <TextInput
          value={form.note} onChangeText={(note) => set({ note })} maxLength={280} accessibilityLabel="Note"
          placeholder="Anything worth remembering? Passed two dogs without a lunge." placeholderTextColor={c.inkFaint}
          style={{ height: 48, borderRadius: 12, paddingHorizontal: 16, backgroundColor: c.surfaceRaised, fontFamily: fonts.sans, fontSize: 15, color: c.ink, outlineStyle: 'none' } as never}
        />
      </View>
      {error ? <Text variant="label" color={c.kennelRed}>{error}</Text> : null}
      <View style={{ gap: 6 }}>
        <Button block disabled={!!busy || !form.dogIds.length || form.dur < 1} onPress={() => save(form)}>
          {busy === 'save' ? 'Saving…' : editing ? 'Save changes' : `Log ${form.guard ? 'park visit' : verb}${many ? ` for ${form.dogIds.length} dogs` : ''}`}
        </Button>
        {editing ? (
          <Button block variant="quiet" disabled={!!busy} onPress={remove}>
            {busy === 'delete' ? 'Deleting…' : confirmDelete ? 'Tap again to delete' : 'Delete'}
          </Button>
        ) : null}
      </View>
    </View>
  );

  // ---- Step 3: Logged ----
  const next = step === 'logged' ? nextStep(form.skills[0] ?? activity.skills[0], form.drillId) : null;
  const balanceRow = view.balance.find((b) => b.key === (form.kind === 'other' ? form.balance : activity.balance));
  const weekStart = startOfWeek(now());
  const skill = form.skills[0] ? skillById(form.skills[0]) : undefined;
  const skillWeek = skill ? homeLog.filter((h) => h.dogId === dog.id && h.doneAt >= weekStart && h.skills.includes(skill.id)).length : 0;
  const lines: [IconName, string][] = [
    [
      'activity',
      balanceRow ? `${balanceRow.label}: ${countLabel(Math.min(balanceRow.done, balanceRow.of))} of ${balanceRow.of} this month` : 'Counted as an active day',
    ],
    ...(skill ? [['target', `${skill.label}: ${skillWeek} ${skillWeek === 1 ? 'time' : 'times'} this week`] as [IconName, string]] : []),
  ];
  const loggedStep = (
    <View style={{ gap: 20, paddingTop: 4 }}>
      <View style={{ width: 56, height: 56, borderRadius: 9999, backgroundColor: c.turf, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={28} color={c.onTurf} /></View>
      <Text variant="headline" accessibilityRole="header">{`Logged. ${form.dur} min ${form.guard ? 'at the park' : verb} with ${names.join(' and ') || dog.name}.`}</Text>
      <View style={{ gap: 6 }}>
        <Text variant="caption" weight="600" muted style={{ marginBottom: 4 }}>Counted toward</Text>
        {lines.map(([icon, text]) => (
          <View key={text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: c.surfaceRaised }}>
            <Icon name={icon} size={18} />
            <Text variant="label" style={{ flex: 1 }}>{text}</Text>
          </View>
        ))}
      </View>
      {next ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text variant="label" style={{ flex: 1 }}>{next.line.replaceAll('{dog}', dog.name)}</Text>
          {next.sessionId ? <Button size="sm" variant="quiet" onPress={() => router.replace(`/book/${next.sessionId}` as Href)}>Book</Button> : null}
        </View>
      ) : null}
      <Button block onPress={back}>Done</Button>
    </View>
  );

  const title = step === 'pick' ? 'What did you do?' : step === 'logged' ? '' : editing ? `Edit ${verb}` : form.guard ? 'Dog park' : activity.label;
  const head = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      {step === 'details' && !editing && !params.drill ? <IconButton icon="chevron-left" size={36} label="Back" onPress={() => setStep('pick')} /> : null}
      <Text variant="title" style={{ flex: 1 }} accessibilityRole="header">{title}</Text>
      <IconButton icon="x" size={36} label="Close" onPress={back} />
    </View>
  );
  const body = (
    <>
      {head}
      {step === 'pick' ? pickStep : step === 'details' ? detailsStep : loggedStep}
    </>
  );

  if (wide) {
    return (
      <Overlay kind="dialog" width={560} top={48} onClose={back}>
        <View style={{ padding: 24 }}>{body}</View>
      </Overlay>
    );
  }
  return (
    <ModalSheet onClose={back} top={step === 'logged' ? undefined : 56} scroll={step !== 'logged'} padding={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: bottom }}>
      {body}
    </ModalSheet>
  );
}

function DogChip({ dog, on, onPress }: { dog: Dog; on: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Press onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingLeft: 6, paddingRight: 16, borderRadius: 9999, backgroundColor: on ? c.inverse : c.surfaceRaised }}>
      <Photo name={dog.photo} style={{ width: 32, height: 32, borderRadius: 9999 }} />
      <Text variant="label" weight="500" color={on ? c.onInverse : c.ink}>{dog.name}</Text>
    </Press>
  );
}

/** "Today", "Yesterday", "Saturday" */
function dayWord(d: Date) {
  const off = dayOffset(d, now());
  return off === 0 ? 'Today' : off === -1 ? 'Yesterday' : off > -7 ? weekday(d) : monthDay(d);
}

const startOfWeek = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));

/** The Logged step's nudge: a class this week that trains the skill, else another drill for it. */
function nextStep(skillId: string | undefined, doneDrill: string | null): { line: string; sessionId?: string } | null {
  const skill = skillId ? skillById(skillId) : undefined;
  if (!skill) return null;
  const soon = now().getTime() + 7 * 86_400_000;
  const session = catalog.sessions
    .filter((s) => skill.classIds.includes(s.classId) && s.startsAt > now() && s.startsAt.getTime() < soon && s.spotsLeft > 0)
    .sort((a, b) => +a.startsAt - +b.startsAt)[0];
  if (session) {
    const cls = catalog.classes[session.classId];
    const trainer = catalog.trainers[cls.trainerId]?.name.split(' ')[0];
    return { line: `Ready for more? ${cls.title}${trainer ? ` with ${trainer}` : ''}, ${dayTimeInline(session.startsAt)}.`, sessionId: session.id };
  }
  const drill = drillsFor(skill.id).find((d) => d.id !== doneDrill);
  return drill ? { line: `Next time: try ${drill.title}.` } : null;
}
