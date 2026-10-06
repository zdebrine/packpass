import type { PlanKey } from './types';

/** Monthly plans (pivot spec). Same prices as the website and supabase/functions/_shared/stripe.ts. */
export const PLANS: { key: PlanKey; name: string; price: string; credits: number; fit: string }[] = [
  { key: 'starter', name: 'Starter', price: '$79', credits: 6, fit: 'About 3 classes a month for a mostly chill dog.' },
  { key: 'regular', name: 'Regular', price: '$129', credits: 10, fit: 'A class most weeks, plus a session on the hard stuff.' },
  { key: 'working', name: 'Working Dog', price: '$189', credits: 16, fit: 'For dogs who are never tired. Out about twice a week.' },
];
export const planOf = (k: PlanKey) => PLANS.find((p) => p.key === k) ?? PLANS[1];

/** One-off credits on top of the plan. */
export const TOP_UP = { credits: 2, price: '$26' };
