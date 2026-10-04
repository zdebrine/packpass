-- Partner teams: an owner adds trainers (and co-owners) from the dashboard's Team page instead of asking
-- PackPass. An invite names an email, a role and the trainer profile the person signs notes with (an
-- existing one, or a new profile the owner names). An account that already uses the email is linked
-- straight away; otherwise the invite waits, and the account is linked when it confirms that email
-- (signing up on the dashboard or in the app). Earnings become owner-only, as the Staff page says.

create table public.partner_invites (
  id uuid primary key default gen_random_uuid(),
  partner_id text not null references public.partners (id) on delete cascade,
  email text not null check (email = lower(trim(email)) and email like '%_@_%'),
  role text not null check (role in ('owner', 'trainer')),
  trainer_id text references public.trainers (id) on delete set null,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
-- One open invite per email: inviting again (from any partner) replaces it.
create unique index on public.partner_invites (email);
create index on public.partner_invites (partner_id);
alter table public.partner_invites enable row level security; -- no policies: only the functions below read it

-- The signed-in owner's partner; raises 'not_owner' for trainers and 'not_partner' for everyone else.
create function public.owner_partner() returns text
language plpgsql stable security definer set search_path = public as $$
declare p text := public.staff_partner();
begin
  if (select role from public.partner_staff where user_id = auth.uid()) <> 'owner' then raise exception 'not_owner'; end if;
  return p;
end $$;
revoke execute on function public.owner_partner from public, anon, authenticated;

-- Everyone on the team, then open invites.
create function public.partner_team()
returns table (kind text, id text, email text, name text, role text, trainer_id text, trainer_name text, is_me boolean, since timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select 'staff', s.user_id::text, u.email::text, pr.name, s.role, s.trainer_id, t.name, s.user_id = auth.uid(), s.created_at
  from public.partner_staff s join auth.users u on u.id = s.user_id
  left join public.profiles pr on pr.id = s.user_id left join public.trainers t on t.id = s.trainer_id
  where s.partner_id = public.owner_partner()
  union all
  select 'invite', i.id::text, i.email, null, i.role, i.trainer_id, t.name, false, i.created_at
  from public.partner_invites i left join public.trainers t on t.id = i.trainer_id
  where i.partner_id = public.owner_partner()
  order by 1 desc, 9
$$;

-- Invite someone by email. p_trainer is one of this partner's trainer profiles; p_new_trainer instead
-- names a new profile to create (PackPass checks credentials, so it starts without one). Returns
-- 'linked' when an account already uses the email, else 'invited'.
create function public.partner_invite(p_email text, p_role text, p_trainer text default null, p_new_trainer text default null)
returns text language plpgsql security definer set search_path = public, auth as $$
declare
  me_partner text := public.owner_partner();
  addr text := lower(trim(coalesce(p_email, '')));
  tid text := p_trainer;
  uid uuid;
  confirmed boolean;
  elsewhere text;
begin
  if addr !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad_email'; end if;
  if p_role not in ('owner', 'trainer') then raise exception 'bad_role'; end if;
  if p_role = 'trainer' and tid is null and nullif(trim(coalesce(p_new_trainer, '')), '') is null then raise exception 'needs_trainer'; end if;
  if tid is not null and not exists (select 1 from public.trainers where id = tid and partner_id = me_partner) then raise exception 'bad_trainer'; end if;

  select u.id, u.email_confirmed_at is not null into uid, confirmed from auth.users u where lower(u.email) = addr;
  select partner_id into elsewhere from public.partner_staff where user_id = uid;
  if elsewhere = me_partner then raise exception 'already_staff'; end if;
  if elsewhere is not null then raise exception 'staff_elsewhere'; end if;
  if tid is not null and (exists (select 1 from public.partner_staff where trainer_id = tid)
                          or exists (select 1 from public.partner_invites where trainer_id = tid and email <> addr)) then
    raise exception 'trainer_taken';
  end if;

  if tid is null and nullif(trim(coalesce(p_new_trainer, '')), '') is not null then
    if length(trim(p_new_trainer)) < 2 then raise exception 'bad_name'; end if;
    tid := trim(both '-' from regexp_replace(lower(split_part(trim(p_new_trainer), ' ', 1)), '[^a-z0-9]+', '-', 'g'));
    if tid = '' or exists (select 1 from public.trainers where id = tid) then tid := tid || '-' || me_partner; end if;
    if exists (select 1 from public.trainers where id = tid) then tid := tid || '-' || substr(md5(random()::text), 1, 4); end if;
    insert into public.trainers (id, partner_id, name) values (tid, me_partner, trim(p_new_trainer));
  end if;

  if uid is not null and confirmed then
    insert into public.partner_staff (user_id, partner_id, role, trainer_id) values (uid, me_partner, p_role, tid);
    delete from public.partner_invites where email = addr;
    return 'linked';
  end if;
  insert into public.partner_invites (partner_id, email, role, trainer_id, invited_by) values (me_partner, addr, p_role, tid, auth.uid())
  on conflict (email) do update set partner_id = excluded.partner_id, role = excluded.role, trainer_id = excluded.trainer_id,
    invited_by = excluded.invited_by, created_at = now();
  return 'invited';
end $$;

create function public.partner_cancel_invite(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.partner_invites where id = p_id and partner_id = public.owner_partner();
  if not found then raise exception 'not_found'; end if;
end $$;

-- Takes someone off the team (their account stays, as a member account). Owners can't remove themselves,
-- so a partner always keeps an owner.
create function public.partner_remove_staff(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me_partner text := public.owner_partner();
begin
  if p_user = auth.uid() then raise exception 'is_me'; end if;
  delete from public.partner_staff where user_id = p_user and partner_id = me_partner;
  if not found then raise exception 'not_found'; end if;
end $$;

revoke execute on function public.partner_team, public.partner_invite, public.partner_cancel_invite, public.partner_remove_staff from public, anon;
grant execute on function public.partner_team, public.partner_invite, public.partner_cancel_invite, public.partner_remove_staff to authenticated;

-- An account that confirms an invited email joins that team. Runs inside Supabase Auth's own write, so
-- it never raises: a problem here mustn't stop someone signing up.
create function public.accept_partner_invite() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv public.partner_invites;
begin
  if new.email_confirmed_at is null or new.email is null then return new; end if;
  select * into inv from public.partner_invites where email = lower(new.email);
  if not found then return new; end if;
  begin
    insert into public.partner_staff (user_id, partner_id, role, trainer_id)
    values (new.id, inv.partner_id, inv.role,
            case when exists (select 1 from public.partner_staff where trainer_id = inv.trainer_id) then null else inv.trainer_id end)
    on conflict (user_id) do nothing;
    delete from public.partner_invites where id = inv.id;
  exception when others then
    raise warning 'accept_partner_invite: %', sqlerrm;
  end;
  return new;
end $$;
revoke execute on function public.accept_partner_invite from public, anon, authenticated;

create trigger on_auth_user_confirmed_invite after insert or update of email_confirmed_at, email on auth.users
for each row execute function public.accept_partner_invite();

-- Earnings are for owners.
create or replace function public.partner_earnings(p_months int default 6)
returns table (month date, sessions int, dogs int, credits int, amount_cents int)
language sql stable security definer set search_path = public as $$
  with mine as (
    select date_trunc('month', s.starts_at at time zone 'America/Chicago')::date m, s.id sid, b.credits_charged cr
    from public.bookings b join public.sessions s on s.id = b.session_id join public.class_types c on c.id = s.class_id
    where c.partner_id = public.owner_partner() and s.starts_at < now()
      and (b.status in ('booked', 'checked_in', 'no_show')
           or (b.status = 'cancelled' and b.cancelled_at > s.starts_at - interval '12 hours'))
  )
  select g.m::date, count(distinct mine.sid)::int, count(mine.sid)::int, coalesce(sum(mine.cr), 0)::int,
         (coalesce(sum(mine.cr), 0) * (select payout_rate_cents from public.partners where id = public.owner_partner()))::int
  from generate_series(date_trunc('month', now() at time zone 'America/Chicago') - make_interval(months => p_months - 1),
                       date_trunc('month', now() at time zone 'America/Chicago'), interval '1 month') g(m)
  left join mine on mine.m = g.m::date
  group by g.m order by g.m desc
$$;

create or replace function public.partner_earnings_by_class()
returns table (class_id text, title text, dogs int, credits int, amount_cents int)
language sql stable security definer set search_path = public as $$
  select c.id, c.title, count(*)::int, sum(b.credits_charged)::int,
         (sum(b.credits_charged) * (select payout_rate_cents from public.partners where id = public.owner_partner()))::int
  from public.bookings b join public.sessions s on s.id = b.session_id join public.class_types c on c.id = s.class_id
  where c.partner_id = public.owner_partner() and s.starts_at < now()
    and s.starts_at >= date_trunc('month', now() at time zone 'America/Chicago') at time zone 'America/Chicago'
    and (b.status in ('booked', 'checked_in', 'no_show') or (b.status = 'cancelled' and b.cancelled_at > s.starts_at - interval '12 hours'))
  group by c.id, c.title order by 4 desc
$$;
