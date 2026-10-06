// stripe-payouts: pays connected partners for finished months, from the PackPass Stripe balance (Connect transfers).
// Called on the 1st by the partner-payouts cron job through request_partner_payouts(), with the same shared secret as
// send-push. Each month is recorded in partner_payouts before its transfer, so a rerun never pays a month twice.
// In test mode the balance needs available funds: pay a top-up with the 4000 0000 0000 0077 card first.
import { admin, json, stripe } from '../_shared/stripe.ts';

Deno.serve(async (req) => {
  const { data: ok } = await admin.rpc('push_secret_ok', { p_secret: req.headers.get('x-webhook-secret') });
  if (ok !== true) return new Response('forbidden', { status: 403 });

  const { data: due, error } = await admin.rpc('payouts_due');
  if (error) return json({ error: error.message }, 500);
  const results = [];
  for (const row of due as { partner_id: string; account_id: string; month: string; credits: number; amount_cents: number }[]) {
    const { data: claim, error: claimErr } = await admin.from('partner_payouts')
      .insert({ partner_id: row.partner_id, month: row.month, credits: row.credits, amount_cents: row.amount_cents }).select('id').single();
    if (claimErr) { results.push({ ...row, skipped: claimErr.message }); continue; }
    try {
      const t = await stripe.transfers.create({
        amount: row.amount_cents, currency: 'usd', destination: row.account_id,
        description: `PackPass ${row.month.slice(0, 7)}: ${row.credits} credits`,
        metadata: { partner_id: row.partner_id, month: row.month, credits: String(row.credits) },
      }, { idempotencyKey: `payout-${row.partner_id}-${row.month}` });
      await admin.from('partner_payouts').update({ transfer_id: t.id }).eq('id', claim.id);
      results.push({ ...row, transfer: t.id });
    } catch (e) {
      // Release the month so the next run tries again.
      await admin.from('partner_payouts').delete().eq('id', claim.id);
      results.push({ ...row, failed: e instanceof Error ? e.message : String(e) });
    }
  }
  return json({ paid: results.filter((r) => 'transfer' in r).length, results });
});
