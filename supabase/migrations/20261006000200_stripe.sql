-- Stripe: member plans (Billing), credit top-ups (Checkout), the Founding Pack from the website, and partner
-- payouts (Connect Express). The Edge Functions in supabase/functions/stripe-* talk to Stripe with the
-- STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET function secrets and write here through the service-role-only
-- functions below. Nothing in this file is callable by members, partners or visitors.

-- ---- Members --------------------------------------------------------------------------------------------

-- plan stays the plan this month's credits came from; subscription_plan is what the next renewal bills, so a
-- switch shows as "Working Dog from Nov 1" until that invoice is paid.
alter table public.profiles
  add column stripe_customer_id text unique,
  add column stripe_subscription_id text,
  add column subscription_status text not null default 'none'
    check (subscription_status in ('none', 'active', 'past_due', 'canceled')),
  add column subscription_plan public.plan_tier,
  add column subscription_renews_on date,
  add column subscription_cancels boolean not null default false;

-- Webhook events already applied, so a retried delivery doesn't grant credits twice.
create table public.stripe_events (
  id text primary key,
  created_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security; -- no policies

create function public.stripe_event_new(p_event text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into public.stripe_events (id) values (p_event) on conflict do nothing;
  return found;
end $$;
revoke execute on function public.stripe_event_new from public, anon, authenticated;

-- A paid top-up.
create function public.stripe_credits_paid(p_event text, p_member uuid, p_credits int) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_credits <= 0 or not exists (select 1 from public.profiles where id = p_member) then return false; end if;
  if not public.stripe_event_new(p_event) then return false; end if;
  insert into public.credit_ledger (member_id, delta, reason) values (p_member, p_credits, 'purchase');
  update public.profiles set credits_balance = credits_balance + p_credits where id = p_member;
  return true;
end $$;

-- A paid plan invoice (first month or a renewal): the plan's credits, with the same one-month rollover cap as
-- grant_monthly_credits. The free monthly grant skips members with a plan from then on.
create function public.stripe_plan_paid(p_event text, p_member uuid, p_plan public.plan_tier, p_customer text,
  p_subscription text, p_renews_on date) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  r public.profiles;
  plan_n int := public.plan_credits(p_plan);
  kept int;
begin
  select * into r from public.profiles where id = p_member for update;
  if not found then return false; end if;
  if not public.stripe_event_new(p_event) then return false; end if;
  kept := least(r.credits_balance, plan_n);
  if kept < r.credits_balance then
    insert into public.credit_ledger (member_id, delta, reason) values (r.id, kept - r.credits_balance, 'adjustment');
  end if;
  insert into public.credit_ledger (member_id, delta, reason) values (r.id, plan_n, 'monthly_grant');
  update public.profiles
  set plan = p_plan, credits_balance = kept + plan_n,
      credits_reset_on = coalesce(p_renews_on, (date_trunc('month', current_date) + interval '1 month')::date),
      stripe_customer_id = p_customer, stripe_subscription_id = p_subscription,
      subscription_status = 'active', subscription_plan = coalesce(subscription_plan, p_plan),
      subscription_renews_on = coalesce(p_renews_on, subscription_renews_on)
  where id = r.id;
  return true;
end $$;

-- Status, next plan and cancellation from customer.subscription.updated / deleted.
create function public.stripe_subscription_sync(p_customer text, p_subscription text, p_status text,
  p_plan public.plan_tier, p_renews_on date, p_cancels boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare v text := case when p_status in ('active', 'trialing') then 'active' when p_status in ('past_due', 'unpaid') then 'past_due'
                       when p_status in ('canceled', 'incomplete_expired') then 'canceled' else null end;
begin
  if v is null then return false; end if; -- incomplete: wait for the first invoice
  update public.profiles
  set stripe_subscription_id = p_subscription, subscription_status = v, subscription_plan = p_plan,
      subscription_renews_on = p_renews_on, subscription_cancels = p_cancels and v <> 'canceled'
  where stripe_customer_id = p_customer
    -- A late event for an old subscription doesn't overwrite a newer one.
    and (stripe_subscription_id is null or stripe_subscription_id = p_subscription or subscription_status in ('none', 'canceled'));
  return found;
end $$;

-- The free monthly grant (pre-launch) is now only for members without a paid plan; paid plans get their
-- credits from stripe_plan_paid when the invoice clears.
create or replace function public.grant_monthly_credits()
returns int language plpgsql security definer set search_path = public as $$
declare
  r public.profiles;
  n int := 0;
  plan_n int;
  kept int;
begin
  for r in select * from public.profiles where credits_reset_on <= current_date and subscription_status in ('none', 'canceled') for update loop
    plan_n := public.plan_credits(r.plan);
    kept := least(r.credits_balance, plan_n);
    if kept < r.credits_balance then
      insert into public.credit_ledger (member_id, delta, reason) values (r.id, kept - r.credits_balance, 'adjustment');
    end if;
    insert into public.credit_ledger (member_id, delta, reason) values (r.id, plan_n, 'monthly_grant');
    update public.profiles
    set credits_balance = kept + plan_n,
        credits_reset_on = (date_trunc('month', current_date) + interval '1 month')::date
    where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.grant_monthly_credits from public, anon, authenticated;

-- ---- Founding Pack (website, before the app is in the stores) --------------------------------------------

alter table public.owner_waitlist
  add column founding_paid_at timestamptz,
  add column stripe_customer_id text,
  add column stripe_subscription_id text;

-- The first Founding Pack invoice: the signup row is marked paid (one is added if the row didn't save).
create function public.stripe_founding_paid(p_event text, p_email text, p_customer text, p_subscription text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(p_email));
begin
  if not public.stripe_event_new(p_event) then return false; end if;
  update public.owner_waitlist
  set founding_paid_at = coalesce(founding_paid_at, now()), stripe_customer_id = p_customer,
      stripe_subscription_id = p_subscription, plan = 'starter', updated_at = now()
  where email = v_email;
  if not found then
    insert into public.owner_waitlist (email, zip, plan, founding_paid_at, stripe_customer_id, stripe_subscription_id)
    values (v_email, '00000', 'starter', now(), p_customer, p_subscription);
  end if;
  return true;
end $$;

-- Founding Pack: Starter (6 credits) plus 2 bonus credits in the first month (pivot spec).
-- A new account whose email paid for it starts on Starter with 8 credits and the subscription attached.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare w public.owner_waitlist;
begin
  select * into w from public.owner_waitlist
  where email = lower(new.email) and founding_paid_at is not null and stripe_customer_id is not null;
  if found and not exists (select 1 from public.profiles where stripe_customer_id = w.stripe_customer_id) then
    insert into public.profiles (id, name, email, plan, credits_balance, stripe_customer_id, stripe_subscription_id,
                                 subscription_status, subscription_plan)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''), new.email, 'starter', public.plan_credits('starter') + 2,
            w.stripe_customer_id, w.stripe_subscription_id, 'active', 'starter');
    insert into public.credit_ledger (member_id, delta, reason) values (new.id, public.plan_credits('starter'), 'monthly_grant');
    insert into public.credit_ledger (member_id, delta, reason) values (new.id, 2, 'adjustment');
    return new;
  end if;
  insert into public.profiles (id, name, email, credits_balance)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''), new.email, public.plan_credits('regular'));
  insert into public.credit_ledger (member_id, delta, reason) values (new.id, public.plan_credits('regular'), 'monthly_grant');
  return new;
end $$;
revoke execute on function public.handle_new_user from public, anon, authenticated;

-- Admin › Applications shows whether a founding signup paid.
drop function public.admin_owner_waitlist();
create function public.admin_owner_waitlist()
returns table (id uuid, email text, zip text, energy text, traits text[], plan text, created_at timestamptz, updated_at timestamptz,
               founding_paid_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_check();
  return query
  select w.id, w.email, w.zip, w.energy::text, w.traits, w.plan::text, w.created_at, w.updated_at, w.founding_paid_at
  from public.owner_waitlist w order by w.created_at desc;
end $$;
revoke execute on function public.admin_owner_waitlist from public, anon;
grant execute on function public.admin_owner_waitlist to authenticated;

-- ---- Partners (Connect) ---------------------------------------------------------------------------------

-- The partner's Stripe connected account. Its own table because partners rows are public.
create table public.partner_stripe (
  partner_id text primary key references public.partners (id) on delete cascade,
  account_id text not null unique,
  created_at timestamptz not null default now()
);
alter table public.partner_stripe enable row level security; -- no policies

-- One row per partner per month paid. The row is written before the transfer (transfer_id null) so a crash
-- between the two can't pay a month twice.
create table public.partner_payouts (
  id bigint generated always as identity primary key,
  partner_id text not null references public.partners (id),
  month date not null,
  credits int not null,
  amount_cents int not null,
  transfer_id text,
  created_at timestamptz not null default now(),
  unique (partner_id, month)
);
alter table public.partner_payouts enable row level security; -- no policies

-- Finished months (America/Chicago) not yet paid to connected partners. Same credits rule as partner_earnings:
-- booked, checked in, no-shows and late cancels count.
create function public.payouts_due()
returns table (partner_id text, account_id text, month date, credits int, amount_cents int)
language sql stable security definer set search_path = public as $$
  with earned as (
    select c.partner_id, date_trunc('month', s.starts_at at time zone 'America/Chicago')::date m, sum(b.credits_charged)::int cr
    from public.bookings b join public.sessions s on s.id = b.session_id join public.class_types c on c.id = s.class_id
    where s.starts_at < date_trunc('month', now() at time zone 'America/Chicago') at time zone 'America/Chicago'
      and (b.status in ('booked', 'checked_in', 'no_show')
           or (b.status = 'cancelled' and b.cancelled_at > s.starts_at - interval '12 hours'))
    group by 1, 2
  )
  select e.partner_id, ps.account_id, e.m, e.cr, e.cr * p.payout_rate_cents
  from earned e join public.partners p on p.id = e.partner_id join public.partner_stripe ps on ps.partner_id = e.partner_id
  where p.payout_status = 'connected' and e.cr > 0
    and not exists (select 1 from public.partner_payouts x where x.partner_id = e.partner_id and x.month = e.m)
  order by e.partner_id, e.m
$$;

revoke execute on function public.stripe_credits_paid, public.stripe_plan_paid, public.stripe_subscription_sync,
  public.stripe_founding_paid, public.payouts_due from public, anon, authenticated;
grant execute on function public.stripe_credits_paid, public.stripe_plan_paid, public.stripe_subscription_sync,
  public.stripe_founding_paid, public.payouts_due to service_role;

-- Calls the stripe-payouts function, next to send-push (same URL base and shared secret from Vault; see
-- …_push_webhook.sql). Runs on the 1st; an admin can also run `select public.request_partner_payouts()`.
create function public.request_partner_payouts() returns boolean
language plpgsql security definer set search_path = public as $$
declare
  url text := replace(public.push_secret('push_function_url'), '/send-push', '/stripe-payouts');
  secret text := public.push_secret('push_webhook_secret');
begin
  if url is null or secret is null or to_regproc('net.http_post') is null then return false; end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
  using url, '{}'::jsonb, jsonb_build_object('content-type', 'application/json', 'x-webhook-secret', secret);
  return true;
end $$;
revoke execute on function public.request_partner_payouts from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('partner-payouts', '0 15 1 * *', 'select public.request_partner_payouts()');
  end if;
end $$;
