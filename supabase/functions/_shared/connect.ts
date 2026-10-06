import type Stripe from 'npm:stripe@18';

/** partners.payout_status from a Connect account: paid out once Stripe enables payouts, verifying once details are in. */
export function payoutStatus(acct: Pick<Stripe.Account, 'payouts_enabled' | 'details_submitted'>): 'none' | 'pending' | 'connected' {
  if (acct.payouts_enabled) return 'connected';
  return acct.details_submitted ? 'pending' : 'none';
}
