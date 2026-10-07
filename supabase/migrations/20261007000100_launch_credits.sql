-- Launch credit policy. Until now every new account got Regular's 10 credits and members without a paid plan
-- got a free monthly grant. From launch, credits come from a plan or a top-up: a new account gets a one-time
-- trial (2 credits) and nothing monthly after that. Both numbers live in one row, so PackPass can change them
-- without a migration (say, a bigger trial for beta testers):
--   update public.credit_policy set signup_credits = 10, free_monthly = true;   -- pre-launch behaviour
-- The Founding Pack sign-up (Starter plus 2 bonus credits) is unchanged.

create table public.credit_policy (
  id boolean primary key default true check (id),
  signup_credits int not null default 2 check (signup_credits >= 0),
  free_monthly boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.credit_policy default values;
alter table public.credit_policy enable row level security; -- no policies: admins change it in SQL

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  w public.owner_waitlist;
  trial int := coalesce((select signup_credits from public.credit_policy), 0);
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
  insert into public.profiles (id, name, email, credits_balance) values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''), new.email, trial);
  if trial > 0 then
    insert into public.credit_ledger (member_id, delta, reason) values (new.id, trial, 'adjustment');
  end if;
  return new;
end $$;
revoke execute on function public.handle_new_user from public, anon, authenticated;

-- The daily job still runs; with free_monthly off it only moves the reset date of members without a plan,
-- so the app's "credits refresh" date never sits in the past. Their credits (trial, top-ups) are kept.
create or replace function public.grant_monthly_credits()
returns int language plpgsql security definer set search_path = public as $$
declare
  r public.profiles;
  n int := 0;
  plan_n int;
  kept int;
  free boolean := coalesce((select free_monthly from public.credit_policy), false);
begin
  for r in select * from public.profiles where credits_reset_on <= current_date and subscription_status in ('none', 'canceled') for update loop
    if free then
      plan_n := public.plan_credits(r.plan);
      kept := least(r.credits_balance, plan_n);
      if kept < r.credits_balance then
        insert into public.credit_ledger (member_id, delta, reason) values (r.id, kept - r.credits_balance, 'adjustment');
      end if;
      insert into public.credit_ledger (member_id, delta, reason) values (r.id, plan_n, 'monthly_grant');
      update public.profiles set credits_balance = kept + plan_n where id = r.id;
      n := n + 1;
    end if;
    update public.profiles set credits_reset_on = (date_trunc('month', current_date) + interval '1 month')::date where id = r.id;
  end loop;
  return n;
end $$;
revoke execute on function public.grant_monthly_credits from public, anon, authenticated;
