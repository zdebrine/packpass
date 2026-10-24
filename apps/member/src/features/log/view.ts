// The Log's month and feed for the dog that's showing, shared by the Log tab and the Log activity sheet.
import { useMemo } from 'react';

import { isLive } from '@/api/client';
import { pastSessions } from '@/data/fixtures';
import { SAMPLE_NOTE_SKILLS } from '@/data/homeLog';
import { defaultFocus } from '@/data/practice';
import type { Dog, FocusSkill } from '@/data/types';
import { skillNotes, skillTiles, type SkillNote } from '@/lib/focus';
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
