// stripe-connect: partner payouts through Stripe Connect (Express). Owners only.
//   { action: 'onboard', back }  creates the partner's connected account if needed and returns Stripe's onboarding URL
//   { action: 'refresh' }        re-reads the account and updates partners.payout_status (after coming back from Stripe)
//   { action: 'dashboard' }      a sign-in link to the partner's Stripe Express dashboard (payouts, bank, tax forms)
import { admin, caller, cors, json, stripe } from '../_shared/stripe.ts';
import { payoutStatus } from '../_shared/connect.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const user = await caller(req);
    if (!user) return json({ error: 'not_signed_in' }, 401);
    const { data: staff } = await admin.from('partner_staff').select('partner_id, role').eq('user_id', user.id).maybeSingle();
    if (!staff || staff.role !== 'owner') return json({ error: 'not_owner' }, 403);
    const partnerId = staff.partner_id as string;
    const { data: partner } = await admin.from('partners').select('id, name').eq('id', partnerId).single();
    const { data: link } = await admin.from('partner_stripe').select('account_id').eq('partner_id', partnerId).maybeSingle();
    const body = await req.json();

    if (body?.action === 'onboard') {
      if (typeof body.back !== 'string' || !/^https?:\/\//.test(body.back)) return json({ error: 'bad_back' }, 400);
      let account = link?.account_id as string | undefined;
      if (!account) {
        const acct = await stripe.accounts.create({
          type: 'express', country: 'US', email: user.email,
          business_profile: { name: partner?.name, product_description: 'Dog training classes booked through PackPass' },
          capabilities: { transfers: { requested: true } },
          metadata: { partner_id: partnerId },
        }, { idempotencyKey: `connect-${partnerId}` });
        account = acct.id;
        const { error } = await admin.from('partner_stripe').insert({ partner_id: partnerId, account_id: account });
        if (error) throw new Error(error.message);
      }
      const sep = body.back.includes('?') ? '&' : '?';
      const url = await stripe.accountLinks.create({
        account, type: 'account_onboarding', refresh_url: `${body.back}${sep}stripe=retry`, return_url: `${body.back}${sep}stripe=return`,
      });
      return json({ url: url.url });
    }

    if (!link) return json({ status: 'none' });

    if (body?.action === 'refresh') {
      const status = payoutStatus(await stripe.accounts.retrieve(link.account_id));
      await admin.from('partners').update({ payout_status: status }).eq('id', partnerId);
      return json({ status });
    }

    if (body?.action === 'dashboard') {
      const login = await stripe.accounts.createLoginLink(link.account_id);
      return json({ url: login.url });
    }

    return json({ error: 'bad_action' }, 400);
  } catch (e) {
    console.error('stripe-connect', e);
    return json({ error: 'stripe_error' }, 400);
  }
});
