// Shared by the stripe-* Edge Functions. Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (function secrets),
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY (provided by Supabase).
import Stripe from 'npm:stripe@18';
import { createClient, type User } from 'npm:@supabase/supabase-js@2';

export const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { httpClient: Stripe.createFetchHttpClient() });

/** Service role: bypasses row level security, so only the functions in this folder use it. */
export const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

export type Plan = 'starter' | 'regular' | 'working';

/** Plans (pivot spec), billed monthly. Prices are created in Stripe on first use, found again by lookup key. */
export const PLANS: Record<Plan, { name: string; cents: number; credits: number }> = {
  starter: { name: 'PackPass Starter', cents: 7900, credits: 6 },
  regular: { name: 'PackPass Regular', cents: 12900, credits: 10 },
  working: { name: 'PackPass Working Dog', cents: 18900, credits: 16 },
};
export const isPlan = (p: unknown): p is Plan => typeof p === 'string' && p in PLANS;
const lookupKey = (p: Plan) => `packpass_plan_${p}`;
export const planOfLookup = (k: string | null | undefined): Plan | null => {
  const p = k?.replace('packpass_plan_', '');
  return isPlan(p) ? p : null;
};

/** Credit top-up: 2 credits at plan pricing. */
export const TOP_UP = { credits: 2, cents: 2600 };

export async function planPrice(plan: Plan): Promise<string> {
  const found = await stripe.prices.list({ lookup_keys: [lookupKey(plan)], active: true, limit: 1 });
  if (found.data[0]) return found.data[0].id;
  const p = PLANS[plan];
  const price = await stripe.prices.create({
    currency: 'usd', unit_amount: p.cents, recurring: { interval: 'month' }, lookup_key: lookupKey(plan),
    product_data: { name: p.name, metadata: { plan, credits: String(p.credits) } },
  });
  return price.id;
}

/** The signed-in caller, from the Authorization header, or null. */
export async function caller(req: Request): Promise<User | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  return data.user ?? null;
}

export const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, GET, OPTIONS',
};
export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });

/** Unix seconds to a date (YYYY-MM-DD), or null. */
export const day = (s: number | null | undefined) => (s ? new Date(s * 1000).toISOString().slice(0, 10) : null);

/** The billing period end. Newer API versions moved it from the subscription to its items. */
export const periodEnd = (sub: Stripe.Subscription) =>
  (sub.items?.data?.[0] as { current_period_end?: number } | undefined)?.current_period_end ?? (sub as { current_period_end?: number }).current_period_end;

export { Stripe };

/** Copies a subscription's status, next plan, renewal date and cancellation onto the member's profile. */
export async function syncSubscription(sub: Stripe.Subscription) {
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const { error } = await admin.rpc('stripe_subscription_sync', {
    p_customer: customer, p_subscription: sub.id, p_status: sub.status,
    p_plan: planOfLookup(sub.items.data[0]?.price.lookup_key), p_renews_on: day(periodEnd(sub)), p_cancels: sub.cancel_at_period_end,
  });
  if (error) throw new Error(error.message);
}
