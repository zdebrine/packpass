// stripe-webhook: Stripe's webhook endpoint (Stripe › Developers › Webhooks), signed with STRIPE_WEBHOOK_SECRET.
// Events:
//   payment_intent.succeeded         a credit top-up cleared: add the credits
//   invoice.paid                     a plan's first month or renewal: the plan's credits (or the Founding Pack signup)
//   customer.subscription.updated    plan switch, cancellation, past due
//   customer.subscription.deleted    plan ended
//   account.updated                  optional: a partner's Connect account, only if a connected-accounts destination with
//                                    the same signing secret exists. Without it, stripe-connect checks the account when the
//                                    partner comes back from Stripe or opens Earnings, and stripe-payouts before paying.
// Each grant is applied once per event id (stripe_events), so retries are safe.
import { admin, day, periodEnd, planOfLookup, Stripe, stripe, syncSubscription } from '../_shared/stripe.ts';
import { payoutStatus } from '../_shared/connect.ts';

const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const crypto = Stripe.createSubtleCryptoProvider();

async function rpc(fn: string, args: Record<string, unknown>) {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data;
}

async function invoicePaid(event: Stripe.Event, invoice: Stripe.Invoice) {
  const inv = invoice as Stripe.Invoice & { subscription?: string | { id: string } | null; parent?: { subscription_details?: { subscription?: string | { id: string } } } };
  const ref = inv.parent?.subscription_details?.subscription ?? inv.subscription;
  if (!ref) return 'not a subscription';
  const sub = await stripe.subscriptions.retrieve(typeof ref === 'string' ? ref : ref.id);
  const plan = planOfLookup(sub.items.data[0]?.price.lookup_key);
  if (!plan) return 'not a PackPass plan';
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const { data: member } = await admin.from('profiles').select('id').eq('stripe_customer_id', customer).maybeSingle();
  const memberId = member?.id ?? sub.metadata.member_id;
  if (memberId) {
    return await rpc('stripe_plan_paid', {
      p_event: event.id, p_member: memberId, p_plan: plan, p_customer: customer, p_subscription: sub.id, p_renews_on: day(periodEnd(sub)),
    });
  }
  if (sub.metadata.kind === 'founding') {
    const email = sub.metadata.email || inv.customer_email;
    if (!email) return 'founding without email';
    return await rpc('stripe_founding_paid', { p_event: event.id, p_email: email, p_customer: customer, p_subscription: sub.id });
  }
  return 'no member for customer';
}

Deno.serve(async (req) => {
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), req.headers.get('stripe-signature') ?? '', secret, undefined, crypto);
  } catch (e) {
    return new Response(`bad signature: ${e instanceof Error ? e.message : e}`, { status: 400 });
  }

  try {
    let result: unknown = 'ignored';
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        if (pi.metadata.kind === 'credits') {
          result = await rpc('stripe_credits_paid', { p_event: event.id, p_member: pi.metadata.member_id, p_credits: Number(pi.metadata.credits) });
        }
        break;
      }
      case 'invoice.paid':
        result = await invoicePaid(event, event.data.object);
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscription(event.data.object);
        result = 'synced';
        break;
      case 'account.updated': {
        const acct = event.data.object;
        const { data: row } = await admin.from('partner_stripe').select('partner_id').eq('account_id', acct.id).maybeSingle();
        if (row) await admin.from('partners').update({ payout_status: payoutStatus(acct) }).eq('id', row.partner_id);
        result = row ? 'synced' : 'unknown account';
        break;
      }
    }
    return Response.json({ received: true, result });
  } catch (e) {
    // A 500 makes Stripe retry later; stripe_events keeps a retry from applying twice.
    console.error('stripe-webhook', event.type, event.id, e);
    return new Response('error', { status: 500 });
  }
});
