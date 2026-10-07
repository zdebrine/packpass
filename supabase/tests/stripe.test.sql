-- Stripe: webhook grants (once per event), plan sync, the free grant skipping paid plans, the Founding Pack signup,
-- and partner payouts. Run with tests/run-local.sh.
\set ON_ERROR_STOP 1
reset role;

create schema t;
grant usage on schema t to authenticated;
create function t.expect_error(q text, want text) returns void language plpgsql as $$
declare got text;
begin
  begin
    execute q;
  exception when others then
    got := sqlerrm;
  end;
  if got is null then raise exception 'FAILED: expected error "%" but it succeeded: %', want, q; end if;
  if got not like '%' || want || '%' then raise exception 'FAILED: expected error "%" but got "%" from: %', want, got, q; end if;
  raise notice 'ok: rejected with %', want;
end $$;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
grant execute on all functions in schema t to authenticated;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000a5f1', 'payer@dog.co');
select t.ok((select credits_balance from profiles where id = '00000000-0000-0000-0000-00000000a5f1') = 10, 'a new member starts on the free Regular grant');

-- Nobody but the service role can call the Stripe functions.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000a5f1';
select t.expect_error($$select public.stripe_credits_paid('evt_x', '00000000-0000-0000-0000-00000000a5f1', 50)$$, 'permission denied');
select t.expect_error($$select public.payouts_due()$$, 'permission denied');
select t.expect_error($$update public.profiles set subscription_status = 'active' where id = auth.uid()$$, 'permission denied');
commit;

-- Top-up: added once, however often Stripe retries the event.
select t.ok(public.stripe_credits_paid('evt_topup', '00000000-0000-0000-0000-00000000a5f1', 2), 'a paid top-up is applied');
select t.ok(not public.stripe_credits_paid('evt_topup', '00000000-0000-0000-0000-00000000a5f1', 2), 'the same event again is ignored');
select t.ok((select credits_balance from profiles where id = '00000000-0000-0000-0000-00000000a5f1') = 12, 'the top-up adds 2 credits');
select t.ok((select count(*) from credit_ledger where member_id = '00000000-0000-0000-0000-00000000a5f1' and reason = 'purchase') = 1, 'one purchase row in the ledger');

-- First plan invoice: Starter's 6, with the balance capped at one month's worth (12 → 6, then +6).
select t.ok(public.stripe_plan_paid('evt_inv1', '00000000-0000-0000-0000-00000000a5f1', 'starter', 'cus_1', 'sub_1', current_date + 30), 'a paid plan invoice is applied');
select t.ok(not public.stripe_plan_paid('evt_inv1', '00000000-0000-0000-0000-00000000a5f1', 'starter', 'cus_1', 'sub_1', current_date + 30), 'a retried invoice is ignored');
select t.ok((select (plan, credits_balance, subscription_status, stripe_customer_id, credits_reset_on)
             = ('starter'::plan_tier, 12, 'active', 'cus_1', current_date + 30) from profiles where id = '00000000-0000-0000-0000-00000000a5f1'),
  'the member is on Starter with 6 kept and 6 granted, renewing with the subscription');

-- The free monthly grant leaves paid plans alone.
update profiles set credits_reset_on = current_date where id = '00000000-0000-0000-0000-00000000a5f1';
select public.grant_monthly_credits();
select t.ok((select credits_balance from profiles where id = '00000000-0000-0000-0000-00000000a5f1') = 12, 'the free grant skips a paid plan');

-- Switching and cancelling come from customer.subscription.updated.
select t.ok(public.stripe_subscription_sync('cus_1', 'sub_1', 'active', 'working', current_date + 30, false), 'a plan switch syncs');
select t.ok((select (plan, subscription_plan) = ('starter'::plan_tier, 'working'::plan_tier) from profiles where id = '00000000-0000-0000-0000-00000000a5f1'),
  'credits stay Starter until the next invoice; the switch shows as the next plan');
select public.stripe_subscription_sync('cus_1', 'sub_1', 'active', 'working', current_date + 30, true);
select t.ok((select subscription_cancels from profiles where id = '00000000-0000-0000-0000-00000000a5f1'), 'cancel at period end shows');
select t.ok(not public.stripe_subscription_sync('cus_1', 'sub_1', 'incomplete', 'working', null, false), 'an incomplete subscription changes nothing');
select public.stripe_subscription_sync('cus_1', 'sub_1', 'canceled', 'working', current_date, false);
select t.ok((select (subscription_status, subscription_cancels) = ('canceled', false) from profiles where id = '00000000-0000-0000-0000-00000000a5f1'), 'a deleted subscription ends the plan');
select public.grant_monthly_credits();
select t.ok((select credits_reset_on > current_date from profiles where id = '00000000-0000-0000-0000-00000000a5f1'), 'after the plan ends the free grant applies again');
-- A new subscription replaces the ended one; a late event for the old one doesn't overwrite it.
select public.stripe_subscription_sync('cus_1', 'sub_2', 'active', 'regular', current_date + 30, false);
select public.stripe_subscription_sync('cus_1', 'sub_1', 'canceled', 'working', current_date, false);
select t.ok((select (stripe_subscription_id, subscription_status) = ('sub_2', 'active') from profiles where id = '00000000-0000-0000-0000-00000000a5f1'),
  'a late event for the old subscription is ignored');

-- Founding Pack: paid on the website, then the account is created with the same email.
select public.submit_owner_waitlist('Founder@Dog.co', '78704', 'high', '{}', 'regular');
select t.ok(public.stripe_founding_paid('evt_found', 'founder@dog.co', 'cus_f', 'sub_f'), 'the founding payment is recorded');
select t.ok(not public.stripe_founding_paid('evt_found', 'founder@dog.co', 'cus_f', 'sub_f'), 'a retried founding event is ignored');
select t.ok((select (plan, zip, founding_paid_at is not null) = ('starter'::plan_tier, '78704', true) from owner_waitlist where email = 'founder@dog.co'),
  'the signup row is marked paid on Starter');
select public.stripe_founding_paid('evt_found2', 'nosignup@dog.co', 'cus_g', 'sub_g');
select t.ok(exists (select 1 from owner_waitlist where email = 'nosignup@dog.co' and founding_paid_at is not null), 'a payment without a saved signup still lands');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000a5f2', 'founder@dog.co');
select t.ok((select (plan, credits_balance, subscription_status, stripe_customer_id) = ('starter'::plan_tier, 8, 'active', 'cus_f')
             from profiles where id = '00000000-0000-0000-0000-00000000a5f2'), 'the founder starts on Starter with 6 + 2 bonus credits');

-- Partner payouts: finished months for connected partners, once.
insert into sessions (id, class_id, starts_at, capacity, spots_left, packpass_spots)
values ('00000000-0000-0000-0000-00000000a5a1', 'herding-fundamentals', '2025-01-15 17:00Z', 6, 6, 6);
insert into bookings (session_id, dog_id, member_id, status, credits_charged)
select '00000000-0000-0000-0000-00000000a5a1', d.id, d.owner_id, 'checked_in', 2 from dogs d limit 1;
insert into bookings (session_id, dog_id, member_id, status, credits_charged, cancelled_at)
select '00000000-0000-0000-0000-00000000a5a1', d.id, d.owner_id, 'cancelled', 2, '2025-01-01Z' from dogs d offset 1 limit 1;
select t.ok(not exists (select 1 from payouts_due() where partner_id = 'ridgeline'), 'nothing is due before the partner connects');
insert into partner_stripe (partner_id, account_id) values ('ridgeline', 'acct_1');
update partners set payout_status = 'connected' where id = 'ridgeline';
select t.ok((select (credits, amount_cents) = (2, 2 * (select payout_rate_cents from partners where id = 'ridgeline'))
             from payouts_due() where partner_id = 'ridgeline' and month = '2025-01-01'), 'January is due: the check-in counts, the early cancel does not');
select t.ok(not exists (select 1 from payouts_due() where partner_id = 'ridgeline' and month >= date_trunc('month', now() at time zone 'America/Chicago')::date),
  'the current month is not due yet');
insert into partner_payouts (partner_id, month, credits, amount_cents) values ('ridgeline', '2025-01-01', 2, 1900);
select t.ok(not exists (select 1 from payouts_due() where partner_id = 'ridgeline' and month = '2025-01-01'), 'a paid month is not due again');

-- ---- Launch credit policy (credit_policy defaults) ---------------------------------------------
reset role;
update credit_policy set signup_credits = 2, free_monthly = false;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000a5c1', 'launch@dog.co');
select t.ok((select credits_balance from profiles where id = '00000000-0000-0000-0000-00000000a5c1') = 2, 'a new member gets the 2-credit trial');
select t.ok((select sum(delta) from credit_ledger where member_id = '00000000-0000-0000-0000-00000000a5c1') = 2, 'the trial is in the ledger');
update profiles set credits_reset_on = current_date - 1 where id = '00000000-0000-0000-0000-00000000a5c1';
select t.ok(public.grant_monthly_credits() = 0, 'no free monthly grant at launch');
select t.ok((select (credits_balance, credits_reset_on > current_date) = (2, true) from profiles where id = '00000000-0000-0000-0000-00000000a5c1'),
  'a member without a plan keeps their credits, and the reset date moves on');
update credit_policy set signup_credits = 0;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000a5c2', 'notrial@dog.co');
select t.ok((select credits_balance from profiles where id = '00000000-0000-0000-0000-00000000a5c2') = 0
            and not exists (select 1 from credit_ledger where member_id = '00000000-0000-0000-0000-00000000a5c2'), 'no trial means no credits and no ledger row');
set role authenticated;
update credit_policy set signup_credits = 100;
select t.ok(not exists (select 1 from credit_policy), 'members can neither see nor change the policy');
reset role;
select t.ok((select signup_credits from credit_policy) = 0, 'the policy is unchanged');

reset role;
drop schema t cascade;
