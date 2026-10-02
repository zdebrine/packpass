-- Recurring timetable and scheduled jobs.
-- Partners run classes on a weekly rhythm. `timetable` holds that rhythm (the partner dashboard will
-- write it; until then the seed loads the sample one) and `extend_schedule` turns it into dated
-- sessions, keeping four weeks bookable. It runs daily, with the other jobs, through pg_cron.

create table public.timetable (
  id uuid primary key default gen_random_uuid(),
  class_id text not null references public.class_types (id) on delete cascade,
  weekday smallint check (weekday between 0 and 6),   -- 0 = Sunday; null = every day
  starts time not null,                               -- Austin time
  unique nulls not distinct (class_id, weekday, starts)
);

alter table public.timetable enable row level security;
create policy "timetable: read" on public.timetable for select to anon, authenticated using (true);
revoke insert, update, delete on public.timetable from anon, authenticated;

-- Adds sessions for the next p_days days (Austin dates) that the timetable calls for and that don't
-- exist yet. New sessions open every spot to PackPass members. Returns how many it added.
create function public.extend_schedule(p_days int default 28)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.sessions (class_id, starts_at, capacity, packpass_spots, spots_left)
  select t.class_id, (d.day + t.starts) at time zone 'America/Chicago', c.group_size, c.group_size, c.group_size
  from generate_series(0, p_days - 1) g(i)
  cross join lateral (select ((now() at time zone 'America/Chicago')::date + g.i) as day) d
  join public.timetable t on t.weekday is null or t.weekday = extract(dow from d.day)
  join public.class_types c on c.id = t.class_id
  where (d.day + t.starts) at time zone 'America/Chicago' > now()
    and not exists (
      select 1 from public.sessions s
      where s.class_id = t.class_id and s.starts_at = (d.day + t.starts) at time zone 'America/Chicago'
    );
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.extend_schedule from public, anon, authenticated;

-- Scheduled jobs, where pg_cron is available (hosted and `supabase start`; not plain Postgres).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('release-expired-holds', '*/15 * * * *', 'select public.release_expired_holds()');
    perform cron.schedule('hold-reminders', '0 * * * *', 'select public.remind_expiring_holds()');
    perform cron.schedule('monthly-credits', '5 6 * * *', 'select public.grant_monthly_credits()');
    perform cron.schedule('extend-schedule', '10 6 * * *', 'select public.extend_schedule()');
  end if;
end $$;
