// The Log's month and feed for the dog that's showing, shared by the Log tab and the Log activity sheet.
import { useMemo } from 'react';

import { isLive } from '@/api/client';
import { pastSessions } from '@/data/fixtures';
import { SAMPLE_NOTE_SKILLS } from '@/data/homeLog';
import { defaultFocus } from '@/data/practice';
import type { Dog, FocusSkill } from '@/data/types';
import { view as sessionView, type SessionView } from '@/lib/booking';
import { now } from '@/lib/clock';
import { dayOffset } from '@/lib/dates';
import { skillNotes, skillTiles, todaysPractice, type SkillNote } from '@/lib/focus';
import { liveLog, sampleLog } from '@/lib/log';
import { useApp } from '@/store/app';

export function useLogView(dog: Dog) {
  const social = useApp((s) => s.social);
  const entries = useApp((s) => s.log);
  const missed = useApp((s) => s.missed);
  const homeLog = useApp((s) => s.homeLog);
  const goal = dog.practiceDays ?? 3;
  // Sample mode's log is the designs' Juno; another sample dog's is empty until it books.
  return useMemo(
    () => (isLive && entries ? liveLog(entries, missed, homeLog, dog.id, dog.name, social, goal)
      : dog.id === 'juno' ? sampleLog(dog.name, social, homeLog, dog.id, goal) : liveLog([], [], homeLog, dog.id, dog.name, social, goal)),
    [entries, missed, homeLog, dog.id, dog.name, social, goal],
  );
}

/** What the dog is working on (07k). Live: dog_focus_skills. Sample: the owner's picks, else its traits' and active paths' skills. */
export function useFocus(dog: Dog): FocusSkill[] {
  const paths = useApp((s) => s.activePaths);
  const stored = useApp((s) => s.focus[dog.id]);
  return useMemo(() => stored ?? (isLive ? [] : defaultFocus(dog.traits ?? [], paths)), [stored, dog.traits, paths]);
}

export function useFocusSkills(dog: Dog): string[] {
  const focus = useFocus(dog);
  return useMemo(() => focus.map((f) => f.skillId), [focus]);
}

/** A dog still working toward Social, or one that reacts to dogs, starts the dog park from outside the fence. */
export function useParkGuard(dog: Dog) {
  const social = useApp((s) => s.social);
  return social === 'working' || (dog.traits ?? []).some((t) => t === 'leash_reactive' || t === 'nervous_dogs');
}

/** The Working on tiles (07k): each focus skill with this week's practice and how it's going. */
export function useSkillTiles(dog: Dog) {
  const focus = useFocus(dog);
  const homeLog = useApp((s) => s.homeLog);
  return useMemo(() => skillTiles(focus, homeLog.filter((h) => h.dogId === dog.id), dog.name, dog.practiceDays ?? 3), [focus, homeLog, dog.id, dog.name, dog.practiceDays]);
}

/** Trainers' notes about a skill: live, the dog's session notes tagged with it; sample, the designs' notes. */
export function useSkillNotes(dog: Dog, skillId: string): SkillNote[] {
  const entries = useApp((s) => s.log);
  return useMemo(() => {
    if (isLive && entries) return skillNotes(entries.filter((e) => e.dogId === dog.id), skillId);
    if (dog.id !== 'juno') return [];
    return pastSessions.filter((p) => SAMPLE_NOTE_SKILLS[p.title]?.includes(skillId))
      .map((p) => ({ key: p.title, note: p.note, by: `${p.trainer.split(' · ')[0]} · ${p.date}` }));
  }, [entries, dog.id, skillId]);
}

/** Today's practice (07): the hero at the top of Log. */
export function useTodayPractice(dog: Dog) {
  const tiles = useSkillTiles(dog);
  const homeLog = useApp((s) => s.homeLog);
  const bookings = useApp((s) => s.bookings);
  const entries = useApp((s) => s.log);
  const { week } = useLogView(dog);
  const goalMet = week.practiced >= week.goal;
  return useMemo(() => {
    const at = now();
    const home = homeLog.filter((h) => h.dogId === dog.id);
    // A class still to come (or under way) today.
    const classToday = bookings
      .filter((b) => b.dogId === dog.id && b.status !== 'cancelled')
      .map((b) => sessionView(b.sessionId))
      .filter((v): v is SessionView => !!v && dayOffset(v.session.startsAt, at) === 0 && +v.session.startsAt + v.cls.durationMin * 60_000 > +at)
      .sort((a, b) => +a.session.startsAt - +b.session.startsAt)[0] ?? null;
    const activeDays = new Set([
      ...home.map((h) => h.doneAt.toDateString()),
      ...(entries ?? []).filter((e) => e.dogId === dog.id && !e.missed).map((e) => e.startsAt.toDateString()),
    ]);
    return todaysPractice({ tiles, home, classToday, activeDays, goalMet, at });
  }, [tiles, homeLog, bookings, entries, dog.id, goalMet]);
}
