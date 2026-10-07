// stripe-checkout: starts a payment and returns Stripe's hosted Checkout URL.
//   member app (signed in): { action: 'plan', plan, back } subscribe, or switch plans from the next renewal
//                           { action: 'credits', back }      a 2-credit top-up
//                           { action: 'cancel' | 'resume' }  end the plan at the period end, or keep it
//                           { action: 'portal', back }       Stripe's billing portal: card and receipts
//   website (signed out):   { action: 'founding', email, back }  the Founding Pack (Starter, 2 bonus credits)
// `back` is where Checkout returns: an https page, or the app's own scheme (packpass://, exp://), which goes
// through a GET on this function because Stripe only redirects to web addresses.
// Credits and plans are granted by stripe-webhook when Stripe confirms the payment, not here.
import { admin, caller, cors, isPlan, json, planPrice, stripe, syncSubscription, TOP_UP, type Plan } from '../_shared/stripe.ts';

const SELF = `${Deno.env.get('SUPABASE_URL')}/functions/v1/stripe-checkout`;
const APP_SCHEMES = /^(packpass|exps?):\/\//;

function returnUrl(back: unknown, outcome: 'done' | 'cancel' | 'portal'): string {
  if (typeof back !== 'string') throw new Error('bad_back');
  const [base, hash] = back.split('#');
  const url = `${base}${base.includes('?') ? '&' : '?'}checkout=${outcome}${hash === undefined ? '' : `#${hash}`}`;
  if (/^https?:\/\//.test(back)) return url;
  if (APP_SCHEMES.test(back)) return `${SELF}?back=${encodeURIComponent(url)}`;
  throw new Error('bad_back');
}

/**
 * The billing portal is for the card on file and past receipts only: plans are chosen, switched and cancelled in
 * the app, which keeps credits and renewal dates in step. Created on first use, found again by its metadata.
 */
async function portalConfiguration(): Promise<string> {
  const found = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
  const ours = found.data.find((c) => c.metadata?.packpass === 'member');
  if (ours) return ours.id;
  const site = Deno.env.get('SITE_URL') ?? 'https://packpass-landing.vercel.app';
  const created = await stripe.billingPortal.configurations.create({
    business_profile: { headline: 'PackPass membership', privacy_policy_url: `${site}/privacy`, terms_of_service_url: `${site}/terms` },
    features: {
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
      customer_update: { enabled: true, allowed_updates: ['email', 'address'] },
      subscription_cancel: { enabled: false },
      subscription_update: { enabled: false },
    },
    metadata: { packpass: 'member' },
  });
  return created.id;
}

async function customerFor(userId: string, email: string | undefined): Promise<{ customer: string; profile: Record<string, unknown> }> {
  const { data: profile, error } = await admin.from('profiles').select('*').eq('id', userId).single();
  if (error || !profile) throw new Error('no_profile');
  if (profile.stripe_customer_id) return { customer: profile.stripe_customer_id, profile };
  const c = await stripe.customers.create({ email: profile.email ?? email, name: profile.name || undefined, metadata: { member_id: userId } },
    { idempotencyKey: `customer-${userId}` });
  await admin.from('profiles').update({ stripe_customer_id: c.id }).eq('id', userId);
  return { customer: c.id, profile };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method === 'GET') {
    const back = new URL(req.url).searchParams.get('back') ?? '';
    if (!APP_SCHEMES.test(back)) return new Response('not found', { status: 404 });
    return new Response(null, { status: 302, headers: { location: back } });
  }

  try {
    const body = await req.json();
    const action = body?.action as string;

    if (action === 'founding') {
      const email = String(body.email ?? '').trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'bad_email' }, 400);
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription', customer_email: email,
        line_items: [{ price: await planPrice('starter'), quantity: 1 }],
        subscription_data: { metadata: { kind: 'founding', email, plan: 'starter' }, description: 'Founding Pack: Starter, plus 2 bonus credits in your first month' },
        success_url: returnUrl(body.back, 'done'), cancel_url: returnUrl(body.back, 'cancel'),
      });
      return json({ url: session.url });
    }

    const user = await caller(req);
    if (!user) return json({ error: 'not_signed_in' }, 401);
    const { customer, profile } = await customerFor(user.id, user.email);
    const subscribed = profile.stripe_subscription_id && ['active', 'past_due'].includes(profile.subscription_status as string);

    if (action === 'credits') {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment', customer,
        line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: TOP_UP.cents, product_data: { name: `${TOP_UP.credits} PackPass credits` } } }],
        payment_intent_data: { metadata: { kind: 'credits', member_id: user.id, credits: String(TOP_UP.credits) } },
        success_url: returnUrl(body.back, 'done'), cancel_url: returnUrl(body.back, 'cancel'),
      });
      return json({ url: session.url });
    }

    if (action === 'plan') {
      if (!isPlan(body.plan)) return json({ error: 'bad_plan' }, 400);
      const plan = body.plan as Plan;
      const price = await planPrice(plan);
      if (subscribed) {
        // Switching: the new price bills from the next renewal, which grants the new plan's credits. No proration.
        const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id as string);
        await syncSubscription(await stripe.subscriptions.update(sub.id, {
          items: [{ id: sub.items.data[0].id, price }], proration_behavior: 'none', cancel_at_period_end: false,
          metadata: { ...sub.metadata, member_id: user.id, plan },
        }));
        return json({ switched: plan });
      }
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription', customer,
        line_items: [{ price, quantity: 1 }],
        subscription_data: { metadata: { member_id: user.id, plan } },
        success_url: returnUrl(body.back, 'done'), cancel_url: returnUrl(body.back, 'cancel'),
      });
      return json({ url: session.url });
    }

    if (action === 'portal') {
      const session = await stripe.billingPortal.sessions.create({
        customer, configuration: await portalConfiguration(), return_url: returnUrl(body.back, 'portal'),
      });
      return json({ url: session.url });
    }

    if (action === 'cancel' || action === 'resume') {
      if (!subscribed) return json({ error: 'no_plan' }, 400);
      await syncSubscription(await stripe.subscriptions.update(profile.stripe_subscription_id as string, { cancel_at_period_end: action === 'cancel' }));
      return json({ ok: true });
    }

    return json({ error: 'bad_action' }, 400);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('stripe-checkout', message);
    return json({ error: message.startsWith('bad_') || message === 'no_profile' ? message : 'stripe_error' }, 400);
  }
});
