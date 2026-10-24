-- PackPass › Standing bookings (Scheduling Flow Update §5, Pack Scheduling class-repeat, booked-repeat, month-standing
-- and cancel-one). "Repeat weekly" books the same class, day and time every week, until a date or until credits
-- run out. Dates are booked through the end of the member's credit month (credits_reset_on); the hourly job books
-- the next month's once its credits land. Each date is an ordinary booking, cancelled on its own; a cancelled date
-- stays cancelled. A date the credits don't cover "drops off" and the member hears about it once.

create table public.booking_series (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  dog_id uuid not null references public.dogs (id) on delete cascade,
  class_id text not null references public.class_types (id),
  -- Day of week (0 = Sunday) and wall time, both in America/Chicago, so the series keeps its time across DST.
  weekday int not null check (weekday between 0 and 6),
  local_time time not null,
  -- Null: until credits run out.
  until_date date,
  -- The last date the member was told drops off, so the job says it once.
  short_session uuid references public.sessions (id) on delete set null,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create index booking_series_member on public.booking_series (member_id) where ended_at is null;
alter table public.booking_series enable row level security;
create policy "members see their series" on public.booking_series for select using (member_id = auth.uid());
grant select on public.booking_series to authenticated;

alter table public.bookings add column series_id uuid references public.booking_series (id) on delete set null;
create index bookings_series on public.bookings (series_id) where series_id is not null;

-- The series' dates still ahead in the member's credit month (or the next 28 days without one), up to its end date.
create function public.series_sessions(p_series uuid)
returns table (session_id uuid, starts_at timestamptz, credits int)
language sql stable security definer set search_path = public as $$
  select s.id, s.starts_at, c.credits
  from public.booking_series bs
  join public.profiles p on p.id = bs.member_id
  join public.class_types c on c.id = bs.class_id
  join public.sessions s on s.class_id = bs.class_id
  where bs.id = p_series and s.cancelled_at is null and s.starts_at > now()
    and extract(dow from s.starts_at at time zone 'America/Chicago') = bs.weekday
    and (s.starts_at at time zone 'America/Chicago')::time = bs.local_time
    and s.starts_at < coalesce(p.credits_reset_on::timestamp at time zone 'America/Chicago', now() + interval '28 days')
    and (bs.until_date is null or (s.starts_at at time zone 'America/Chicago')::date <= bs.until_date)
  order by s.starts_at
$$;
revoke execute on function public.series_sessions from public, anon, authenticated;

-- "Sat Oct 31"
create function public.day_date(p_at timestamptz) returns text language sql stable set search_path = public as $$
  select to_char(p_at at time zone 'America/Chicago', 'FMDy Mon FMDD')
$$;

-- Books the series' open dates in order. A date with a booking (any status, so a cancelled date stays cancelled), a
-- full class or a dog that's blocked is skipped. The first date the credits don't cover stops it (the rest cost the
-- same) and tells the member once. Returns how many it booked. Per-date "Booked." notices are left out; the caller
-- sends one for the series.
create function public.fill_series(p_series uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  bs public.booking_series;
  r record;
  b public.bookings;
  bal int;
  n int := 0;
begin
  select * into bs from public.booking_series where id = p_series for update;
  if not found or bs.ended_at is not null then return 0; end if;
  perform set_config('packpass.waitlist_booking', 'on', true);
  for r in select * from public.series_sessions(p_series) loop
    continue when exists (select 1 from public.bookings x where x.session_id = r.session_id and x.dog_id = bs.dog_id);
    continue when coalesce(public.booking_block(bs.dog_id, r.session_id), public.waiver_block(bs.member_id, r.session_id)) is not null;
    begin
      b := public.book_as(bs.member_id, r.session_id, bs.dog_id);
      update public.bookings set series_id = p_series where id = b.id;
      n := n + 1;
    exception when others then
      if sqlerrm = 'credits' then
        if bs.short_session is distinct from r.session_id then
          select credits_balance into bal from public.profiles where id = bs.member_id;
          insert into public.notifications (member_id, category, kind, title, body, href, session_id)
          select bs.member_id, 'bookings', 'series_short', public.day_date(r.starts_at) || ' drops off.',
                 c.title || ' needs ' || r.credits || case when r.credits = 1 then ' credit' else ' credits' end || ' and '
                   || bal || case when bal = 1 then ' is' else ' are' end || ' left. Add credits or cancel another date to keep it.',
                 public.dog_href('/month', bs.dog_id), r.session_id
          from public.class_types c where c.id = bs.class_id;
          update public.booking_series set short_session = r.session_id where id = p_series;
        end if;
        exit;
      end if;
      -- full, already booked or blocked since the check: skip the date.
    end;
  end loop;
  perform set_config('packpass.waitlist_booking', 'off', true);
  return n;
end $$;
revoke execute on function public.fill_series from public, anon, authenticated;

-- "Booked every Saturday." for a new series, or the dates the job added.
create function public.notify_series(p_series uuid, p_new boolean, p_added int)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  select bs.member_id, bs.dog_id, bs.until_date, c.title, to_char(min(s.starts_at) at time zone 'America/Chicago', 'FMDay') dayname,
         min(s.starts_at) first_at, max(s.starts_at) last_at, count(*) n, (array_agg(b.session_id order by s.starts_at))[1] first_session
    into r
  from public.booking_series bs join public.class_types c on c.id = bs.class_id
  join public.bookings b on b.series_id = bs.id and b.status = 'booked'
  join public.sessions s on s.id = b.session_id and s.starts_at > now()
  where bs.id = p_series
  group by bs.member_id, bs.dog_id, bs.until_date, c.title;
  if not found then return; end if;
  insert into public.notifications (member_id, category, kind, title, body, href, session_id)
  values (r.member_id, 'bookings', 'series_booked',
          case when p_new then 'Booked every ' || r.dayname || '. ' || r.title || ', ' || lower(to_char(r.first_at at time zone 'America/Chicago', 'FMHH12:MI am')) || '.'
               else 'Standing booking: ' || p_added || ' more ' || case when p_added = 1 then 'date' else 'dates' end || ' of ' || r.title || '.' end,
          r.n || case when r.n = 1 then ' date' else ' dates' end || ' booked, ' || public.day_date(r.first_at)
            || case when r.n > 1 then ' to ' || public.day_date(r.last_at) else '' end || ', '
            || case when r.until_date is null then 'until credits run out' else 'until ' || to_char(r.until_date, 'FMMon FMDD') end
            || '. Each date has its own free cancel window and can be cancelled on its own. ' || public.booking_rules(r.first_session, r.dog_id),
          public.dog_href('/month', r.dog_id), r.first_session);
end $$;
revoke execute on function public.notify_series from public, anon, authenticated;

-- Books the session the member picked and starts the series from it (same checks and errors as book_session).
create function public.start_series(p_session uuid, p_dog uuid, p_until date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  s public.sessions;
  b public.bookings;
  sid uuid;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  select * into s from public.sessions where id = p_session;
  if not found then raise exception 'not_found'; end if;
  if p_until is not null and p_until < (s.starts_at at time zone 'America/Chicago')::date then raise exception 'bad_until'; end if;
  perform set_config('packpass.waitlist_booking', 'on', true);
  b := public.book_session(p_session, p_dog);
  insert into public.booking_series (member_id, dog_id, class_id, weekday, local_time, until_date)
  values (me, p_dog, s.class_id, extract(dow from s.starts_at at time zone 'America/Chicago'), (s.starts_at at time zone 'America/Chicago')::time, p_until)
  returning id into sid;
  update public.bookings set series_id = sid where id = b.id;
  perform public.fill_series(sid);
  perform public.notify_series(sid, true, 0);
  return sid;
end $$;
revoke execute on function public.start_series from public, anon;
grant execute on function public.start_series to authenticated;

-- Ends a series: no more dates get booked, and the dates still inside their free cancel window are cancelled
-- (credits back). Dates inside 12 hours stay booked. Returns how many it cancelled.
create function public.end_series(p_series uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  b record;
  n int := 0;
begin
  update public.booking_series set ended_at = now() where id = p_series and member_id = auth.uid() and ended_at is null;
  if not found then raise exception 'not_found'; end if;
  for b in select x.id from public.bookings x join public.sessions s on s.id = x.session_id
           where x.series_id = p_series and x.status = 'booked' and s.starts_at - interval '12 hours' > now() loop
    perform public.cancel_booking(b.id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.end_series from public, anon;
grant execute on function public.end_series to authenticated;

-- The member's live series with their dates this credit month: booked, cancelled, or short (credits don't cover it).
create function public.my_series()
returns table (id uuid, dog_id uuid, class_id text, until_date date, dates jsonb)
language sql stable security definer set search_path = public as $$
  select bs.id, bs.dog_id, bs.class_id, bs.until_date,
         coalesce((select jsonb_agg(jsonb_build_object(
                    'session_id', x.session_id, 'starts_at', x.starts_at, 'booking_id', b.id,
                    'status', case when b.id is null then 'short' when b.status = 'cancelled' then 'cancelled' else 'booked' end)
                    order by x.starts_at)
                   from public.series_sessions(bs.id) x
                   left join lateral (select y.id, y.status from public.bookings y
                                      where y.session_id = x.session_id and y.dog_id = bs.dog_id
                                      order by y.status = 'cancelled', y.created_at desc limit 1) b on true), '[]')
  from public.booking_series bs
  where bs.member_id = auth.uid() and bs.ended_at is null
    and (bs.until_date is null or bs.until_date >= (now() at time zone 'America/Chicago')::date)
  order by bs.created_at
$$;
revoke execute on function public.my_series from public, anon;
grant execute on function public.my_series to authenticated;

-- Hourly: books every live series ahead (new credit months, credits topped up, dates cancelled elsewhere).
create function public.book_series_ahead()
returns int language plpgsql security definer set search_path = public as $$
declare
  bs record;
  k int;
  n int := 0;
begin
  for bs in select id from public.booking_series
            where ended_at is null and (until_date is null or until_date >= (now() at time zone 'America/Chicago')::date) loop
    k := public.fill_series(bs.id);
    if k > 0 then perform public.notify_series(bs.id, false, k); end if;
    n := n + k;
  end loop;
  -- Series past their end date are done.
  update public.booking_series set ended_at = now()
  where ended_at is null and until_date < (now() at time zone 'America/Chicago')::date;
  return n;
end $$;
revoke execute on function public.book_series_ahead from public, anon, authenticated;

create or replace function public.push_kind(k text) returns boolean language sql immutable set search_path = public as $$
  select k in ('hold_expiring', 'holds_released', 'clearance_earned', 'waitlist_booked', 'waitlist_open', 'waitlist_missed',
               'waitlist_offer', 'session_cancelled', 'session_note', 'assessment_result', 'path_step', 'records_approved',
               'records_denied', 'class_missed', 'reassessment', 'reminder_24h', 'reminder_2h', 'nudge_10d',
               'series_booked', 'series_short')
$$;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('standing-bookings', '20 * * * *', 'select public.book_series_ahead()');
  end if;
end $$;
