// How well each class suits the active dog (fitFor in src/lib/fit.ts), with what the app knows about its month
// and the places it has been. Book sorts by it and tags Built for matches; it never hides a class.
import { useMemo } from 'react';

import { catalog } from '@/data/catalog';
import type { ClassType } from '@/data/types';
import { fitFor, type Fit } from '@/lib/fit';
import { useMonthDone } from '@/lib/stats';
import { useApp, useDog } from '@/store/app';

export function useFit(): (cls: ClassType) => Fit {
  const dog = useDog();
  const log = useApp((s) => s.log);
  const { short } = useMonthDone();
  return useMemo(() => {
    const been = (log ?? []).filter((e) => e.dogId === dog.id && !e.missed).map((e) => catalog.classes[e.classId]).filter(Boolean);
    const ctx = { short, disciplines: been.map((c) => c.discipline), partners: been.map((c) => c.partnerId) };
    return (cls: ClassType) => fitFor(cls, dog, ctx);
  }, [dog, log, short]);
}
