// Live mode: tells the server which classes Book showed the dog, in what order and with what fit
// (public.log_impressions), so the fit weights can be tuned against what members actually book. Each session
// is logged once per dog per day; failures are dropped, since this never affects what the member sees.
import { useEffect } from 'react';

import { isLive } from '@/api/client';
import { logImpressions, type Impression } from '@/api/live';
import { eligibility, type RuleContext, type SessionView } from '@/lib/booking';
import type { Fit } from '@/lib/fit';

const seen = new Set<string>();

export function useImpressions(dogId: string, rows: SessionView[], rules: RuleContext, fit: (v: SessionView) => Fit, surface: Impression['surface'] = 'list') {
  const ids = rows.map((v) => v.session.id).join(',');
  useEffect(() => {
    if (!isLive || !dogId || !rows.length) return;
    const day = new Date().toISOString().slice(0, 10);
    const fresh: Impression[] = [];
    rows.forEach((v, position) => {
      const key = `${dogId}:${v.session.id}:${surface}:${day}`;
      if (seen.has(key)) return;
      seen.add(key);
      const e = eligibility(v, rules);
      const f = fit(v);
      fresh.push({ session_id: v.session.id, surface, state: e.ok ? 'open' : e.needs === 'fit' ? 'no' : 'unlock', position, score: f.score, parts: f.parts });
    });
    logImpressions(dogId, fresh.slice(0, 100)).catch(() => {});
    // Only a different set of rows, in a different order, is a new impression.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dogId, ids, surface]);
}
