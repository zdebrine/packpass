-- PackPass › Partner scheduling (v3 phase 4a, Pack Partner Scheduling 10a to 11a). A class is a template the
-- partner schedules from:
--   * booking rules on the template: how many spots go to PackPass members by default, whether members sign the
--     partner's waiver for it, and whether the waitlist books the next dog on its own
--   * duplicate and archive (an archived template stops repeating and can't be scheduled until it's restored)
--   * class_series: a template scheduled on some weekdays at one time between two dates, written out as sessions
--     at once so the whole run shows on the schedule and on Book

alter table public.class_types
  -- Spots open to PackPass members in a new session; null means every spot (group_size).
  add column packpass_spots int check (packpass_spots between 0 and 40),
  add column waiver_required boolean not null default true,
  add column waitlist_auto boolean not null default true,
  add column archived_at timestamptz;

-- ---- Series ------------------------------------------------------------------------------------------------

create table public.class_series (
  id uuid primary key default gen_random_uuid(),
  class_id text not null references public.class_types (id) on delete cascade,
  weekdays smallint[] not null check (cardinality(weekdays) between 1 and 7 and weekdays <@ '{0,1,2,3,4,5,6}'),  -- 0 = Sunday
  starts time not null,                 -- Austin time
  first_day date not null,
  last_day date not null check (last_day >= first_day),
  capacity int not null,
  packpass_spots int not null check (packpass_spots between 0 and capacity),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.class_series (class_id);
alter table public.class_series enable row level security;
revoke all on public.class_series from anon, authenticated;

alter table public.sessions add column series_id uuid references public.class_series (id) on delete set null;
create index on public.sessions (series_id);

-- Schedules a series: one session on each picked weekday between two Austin dates (up to 26 weeks), at one time.
-- Dates that already have a session of this class at that time, or have passed, are skipped. Returns the series
-- and how many sessions it added.
create function public.partner_schedule_series(p_class text, p_weekdays smallint[], p_starts time, p_first date, p_last date,
                                               p_capacity int, p_packpass int)
returns table (series_id uuid, sessions int) language plpgsql security definer set search_path = public as $$
declare
  c public.class_types;
  sid uuid;
  n int;
begin
  select * into c from public.class_types where id = p_class and partner_id = public.staff_partner();
  if not found then raise exception 'not_found'; end if;
  if c.archived_at is not null then raise exception 'archived'; end if;
  if c.status <> 'live' then raise exception 'not_live'; end if;
  if coalesce(cardinality(p_weekdays), 0) = 0 or not p_weekdays <@ '{0,1,2,3,4,5,6}'::smallint[] then raise exception 'no_days'; end if;
  if p_first is null or p_last is null or p_last < p_first or p_last > p_first + 182
     or p_first < (now() at time zone 'America/Chicago')::date then raise exception 'series_range'; end if;
  if p_packpass < 0 or p_capacity < p_packpass or p_capacity > 40 then raise exception 'bad_capacity'; end if;

  insert into public.class_series (class_id, weekdays, starts, first_day, last_day, capacity, packpass_spots, created_by)
  values (p_class, (select array_agg(distinct d order by d) from unnest(p_weekdays) d), p_starts, p_first, p_last, p_capacity, p_packpass, auth.uid())
  returning id into sid;
  insert into public.sessions (class_id, starts_at, capacity, packpass_spots, spots_left, auto_promote, series_id)
  select p_class, (d.day + p_starts) at time zone 'America/Chicago', p_capacity, p_packpass, p_packpass, c.waitlist_auto, sid
  from generate_series(p_first, p_last, interval '1 day') g(t)
  cross join lateral (select g.t::date as day) d
  where extract(dow from d.day)::smallint = any (p_weekdays)
    and (d.day + p_starts) at time zone 'America/Chicago' > now()
    and not exists (select 1 from public.sessions s where s.class_id = p_class and s.starts_at = (d.day + p_starts) at time zone 'America/Chicago');
  get diagnostics n = row_count;
  if n = 0 then raise exception 'no_dates'; end if;
  series_id := sid; sessions := n;
  return next;
end $$;
revoke execute on function public.partner_schedule_series from public, anon;
grant execute on function public.partner_schedule_series to authenticated;

-- The partner's series that still have sessions to come, with how many are left and booked.
create function public.partner_series()
returns table (id uuid, class_id text, weekdays smallint[], starts time, first_day date, last_day date,
               upcoming int, booked int)
language sql stable security definer set search_path = public as $$
  -- The dates of its first and last sessions, which can fall inside the range the partner picked.
  select x.id, x.class_id, x.weekdays, x.starts,
         (select min(s.starts_at at time zone 'America/Chicago')::date from public.sessions s where s.series_id = x.id and s.cancelled_at is null),
         (select max(s.starts_at at time zone 'America/Chicago')::date from public.sessions s where s.series_id = x.id and s.cancelled_at is null),
         (select count(*) from public.sessions s where s.series_id = x.id and s.cancelled_at is null and s.starts_at > now())::int,
         (select count(*) from public.bookings b join public.sessions s on s.id = b.session_id
          where s.series_id = x.id and s.starts_at > now() and b.status <> 'cancelled')::int
  from public.class_series x join public.class_types c on c.id = x.class_id
  where c.partner_id = public.staff_partner()
    and exists (select 1 from public.sessions s where s.series_id = x.id and s.cancelled_at is null and s.starts_at > now())
  order by x.first_day, x.starts
$$;
revoke execute on function public.partner_series from public, anon;
grant execute on function public.partner_series to authenticated;

-- ---- Template rules, duplicate and archive ---------------------------------------------------------------------

-- Booking rules that don't change the credit cost, so they never send the class back for review.
create function public.partner_set_class_rules(p_class text, p_packpass int, p_waiver boolean, p_waitlist boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_packpass is not null and (p_packpass < 0 or p_packpass > (select group_size from public.class_types where id = p_class)) then
    raise exception 'bad_capacity';
  end if;
  update public.class_types set packpass_spots = p_packpass, waiver_required = coalesce(p_waiver, waiver_required),
    waitlist_auto = coalesce(p_waitlist, waitlist_auto)
  where id = p_class and partner_id = public.staff_partner();
  if not found then raise exception 'not_found'; end if;
end $$;
revoke execute on function public.partner_set_class_rules from public, anon;
grant execute on function public.partner_set_class_rules to authenticated;

-- Copies a template as "Copy of …". The copy keeps the credit cost and status PackPass set (nothing that sets the
-- price changed); an approved "Only these breeds" and Path class steps stay with the original.
create function public.partner_duplicate_class(p_class text)
returns text language plpgsql security definer set search_path = public as $$
declare
  c public.class_types;
  new_id text;
begin
  select * into c from public.class_types where id = p_class and partner_id = public.staff_partner();
  if not found then raise exception 'not_found'; end if;
  new_id := c.id || '-copy';
  while exists (select 1 from public.class_types where id = new_id) loop
    new_id := c.id || '-copy-' || substr(md5(random()::text), 1, 4);
  end loop;
  c.id := new_id;
  c.title := left('Copy of ' || c.title, 80);
  c.archived_at := null;
  c.breed_only := false;
  c.breed_only_reason := null;
  c.breed_only_status := null;
  insert into public.class_types select (c).*;
  return new_id;
end $$;
revoke execute on function public.partner_duplicate_class from public, anon;
grant execute on function public.partner_duplicate_class to authenticated;

-- Archives a template or restores it. Archiving stops its weekly repeat; sessions already on the schedule stay
-- (cancel them from the schedule if they shouldn't run).
create function public.partner_archive_class(p_class text, p_archive boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.class_types set archived_at = case when p_archive then coalesce(archived_at, now()) end
  where id = p_class and partner_id = public.staff_partner();
  if not found then raise exception 'not_found'; end if;
  if p_archive then delete from public.timetable where class_id = p_class; end if;
end $$;
revoke execute on function public.partner_archive_class from public, anon;
grant execute on function public.partner_archive_class to authenticated;

-- ---- Rules applied where sessions are made and booked ------------------------------------------------------------

-- One-off sessions: not for an archived template, and the waitlist follows the template.
create or replace function public.partner_add_session(p_class text, p_starts_at timestamptz, p_capacity int, p_packpass int, p_repeat boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  c public.class_types;
  sid uuid;
  local timestamp := p_starts_at at time zone 'America/Chicago';
begin
  select * into c from public.class_types where id = p_class and partner_id = public.staff_partner();
  if not found then raise exception 'not_found'; end if;
  if c.archived_at is not null then raise exception 'archived'; end if;
  if c.status <> 'live' then raise exception 'not_live'; end if;
  if p_starts_at <= now() then raise exception 'started'; end if;
  if p_packpass < 0 or p_capacity < p_packpass or p_capacity > 40 then raise exception 'bad_capacity'; end if;
  insert into public.sessions (class_id, starts_at, capacity, packpass_spots, spots_left, auto_promote)
  values (p_class, p_starts_at, p_capacity, p_packpass, p_packpass, c.waitlist_auto) returning id into sid;
  if p_repeat then
    insert into public.timetable (class_id, weekday, starts) values (p_class, extract(dow from local)::smallint, local::time)
    on conflict do nothing;
  end if;
  return sid;
end $$;

-- The weekly repeat skips archived templates and opens the template's PackPass spots.
create or replace function public.extend_schedule(p_days int default 28)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.sessions (class_id, starts_at, capacity, packpass_spots, spots_left, auto_promote)
  select t.class_id, (d.day + t.starts) at time zone 'America/Chicago', c.group_size,
         least(coalesce(c.packpass_spots, c.group_size), c.group_size), least(coalesce(c.packpass_spots, c.group_size), c.group_size), c.waitlist_auto
  from generate_series(0, p_days - 1) g(i)
  cross join lateral (select ((now() at time zone 'America/Chicago')::date + g.i) as day) d
  join public.timetable t on t.weekday is null or t.weekday = extract(dow from d.day)
  join public.class_types c on c.id = t.class_id and c.status = 'live' and c.archived_at is null
  where (d.day + t.starts) at time zone 'America/Chicago' > now()
    and not exists (
      select 1 from public.sessions s
      where s.class_id = t.class_id and s.starts_at = (d.day + t.starts) at time zone 'America/Chicago'
    );
  get diagnostics n = row_count;
  return n;
end $$;

-- The partner's waiver is asked only for templates that use it.
create or replace function public.waiver_block(p_member uuid, p_session uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when not public.waiver_signed(p_member, null) then 'waiver'
    when c.waiver_required and not public.waiver_signed(p_member, c.partner_id) then 'partner_waiver'
  end
  from public.sessions s join public.class_types c on c.id = s.class_id
  where s.id = p_session
$$;
