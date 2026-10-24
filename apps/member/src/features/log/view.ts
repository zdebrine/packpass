// The Log's month and feed for the dog that's showing, shared by the Log tab and the Log activity sheet.
import { useMemo } from 'react';

import { isLive } from '@/api/client';
import { SKILLS, skillsForTraits } from '@/data/practice';
import type { Dog } from '@/data/types';
import { liveLog, sampleLog } from '@/lib/log';
import { useApp } from '@/store/app';

export function useLogView(dog: Dog) {
  const social = useApp((s) => s.social);
  const entries = useApp((s) => s.log);
  const missed = useApp((s) => s.missed);
  const homeLog = useApp((s) => s.homeLog);
  // Sample mode's log is the designs' Juno; another sample dog's is empty until it books.
  return useMemo(
    () => (isLive && entries ? liveLog(entries, missed, homeLog, dog.id, dog.name, social)
      : dog.id === 'juno' ? sampleLog(dog.name, social, homeLog, dog.id) : liveLog([], [], homeLog, dog.id, dog.name, social)),
    [entries, missed, homeLog, dog.id, dog.name, social],
  );
}

/** What the dog is working on: skills its traits and active training paths point to (dog_focus_skills seeds the same). */
export function useFocusSkills(dog: Dog): string[] {
  const paths = useApp((s) => s.activePaths);
  return useMemo(() => {
    const fromPaths = SKILLS.filter((k) => k.pathId && (paths as string[]).includes(k.pathId)).map((k) => k.id);
    return [...new Set([...skillsForTraits(dog.traits ?? []), ...fromPaths])];
  }, [dog.traits, paths]);
}

/** A dog still working toward Social, or one that reacts to dogs, starts the dog park from outside the fence. */
export function useParkGuard(dog: Dog) {
  const social = useApp((s) => s.social);
  return social === 'working' || (dog.traits ?? []).some((t) => t === 'leash_reactive' || t === 'nervous_dogs');
}
