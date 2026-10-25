-- PackPass › Calendar sync, part one: iCal busy feeds (v3 phase 4e, Partner Scheduling P6 to P6d, 14a, 14b).
--   * a partner pastes the iCal feed of the calendar they already book clients in (Gingr, Clicks!, Acuity, or any
--     calendar's secret .ics address), for the whole place or one trainer. The calendar-sync Edge Function reads each
--     feed every 15 minutes (pg_cron → pg_net, like the reminder emails) and stores the next two weeks of busy times.
--   * with "Hide PackPass spots when you're busy" on (the default), a session that overlaps a busy time is closed to
--     new PackPass bookings (sessions.busy_hidden): booking_block returns 'partner_busy', Book leaves it out, and the
--     partner's schedule says why. Dogs already booked keep their spots.
--   Google two-way sync follows in its own migration once the OAuth app exists.

-- ---- Feeds and busy times ------------------------------------------------------------------------------------

create table public.calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  partner_id text not null references public.partners (id) on delete cascade,
  -- Null: busy times close every class at the partner. A trainer: only that trainer's classes.
  trainer_id text references public.trainers (id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  url text not null check (url ~* '^(https|webcal)://[^[:space:]]+$' and length(url) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'ok', 'error')),
  error text check (length(error) <= 200),
  busy_count int not null default 0,
  last_read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.calendar_feeds (partner_id);
alter table public.calendar_feeds enable row level security;

create table public.busy_blocks (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid not null references public.calendar_feeds (id) on delete cascade,
  partner_id text not null references public.partners (id) on delete cascade,
  trainer_id text references public.trainers (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  -- The event's title, shown to the partner only.
  title text check (length(title) <= 120)
);
create index on public.busy_blocks (partner_id, starts_at);
create index on public.busy_blocks (feed_id);
alter table public.busy_blocks enable row level security;

alter table public.partners add column hide_when_busy boolean not null default true;

-- Closed to new PackPass bookings because the partner is busy then. Members read it to keep the session out of Book.
alter table public.sessions add column busy_hidden boolean not null default false;
grant select (busy_hidden) on public.sessions to anon, authenticated;

-- Is this session (of this class) inside one of the partner's busy times? Offered 1:1s were made for that member, so
-- they never close.
create function public.session_busy(p_class text, p_starts_at timestamptz, p_offered uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_offered is null and exists (
    select 1 from public.class_types c
    join public.partners p on p.id = c.partner_id and p.hide_when_busy
    join public.busy_blocks b on b.partner_id = c.partner_id and (b.trainer_id is null or b.trainer_id = c.trainer_id)
    where c.id = p_class
      and b.starts_at < p_starts_at + make_interval(mins => c.duration_min) and b.ends_at > p_starts_at)
$$;
revoke execute on function public.session_busy from public, anon, authenticated;

-- Sets busy_hidden on the partner's sessions still to come. Returns how many are hidden.
create function public.refresh_busy_hidden(p_partner text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.sessions s set busy_hidden = public.session_busy(s.class_id, s.starts_at, s.offered_member)
  from public.class_types c
  where c.id = s.class_id and c.partner_id = p_partner and s.starts_at > now() and s.cancelled_at is null
    and s.busy_hidden is distinct from public.session_busy(s.class_id, s.starts_at, s.offered_member);
  select count(*) into n from public.sessions s join public.class_types c on c.id = s.class_id
  where c.partner_id = p_partner and s.busy_hidden and s.starts_at > now() and s.cancelled_at is null;
  return n;
end $$;
revoke execute on function public.refresh_busy_hidden from public, anon, authenticated;

-- A session added inside a busy time (one session or a series) starts closed.
create function public.sessions_busy_hidden() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.busy_hidden := public.session_busy(new.class_id, new.starts_at, new.offered_member);
  return new;
end $$;
create trigger sessions_busy_hidden before insert on public.sessions
for each row execute function public.sessions_busy_hidden();

-- booking_block (as in …_clearance_types.sql) with one more reason: the partner is busy then.
create or replace function public.booking_block(p_dog uuid, p_session uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  s public.sessions;
  c public.class_types;
  on_day date;
  gate text;
  need text;
begin
  select * into s from public.sessions where id = p_session;
  if not found then raise exception 'not_found'; end if;
  select * into c from public.class_types where id = s.class_id;
  on_day := (s.starts_at at time zone 'America/Chicago')::date;

  if s.cancelled_at is not null then return 'cancelled'; end if;
  if s.starts_at <= now() then return 'started'; end if;
  if s.busy_hidden then return 'partner_busy'; end if;
  if c.grants is not null and public.has_clearance(p_dog, c.grants, c.partner_id, on_day) then
    return 'already_cleared';
  end if;
  gate := public.class_gate(p_dog, c, on_day);
  if gate is not null then return gate; end if;
  for need in
    select c.requires where c.requires is not null
    union all
    select k.group_also_requires from public.clearance_types k
    where k.id = c.requires and k.group_also_requires is not null and c.session_type = 'class' and c.group_size > 1
  loop
    if not public.has_clearance(p_dog, need, c.partner_id, on_day)
       and not exists (select 1 from public.dog_paths dp
                       join public.training_paths tp on tp.id = dp.path_id and tp.grants = need
                       join public.path_step_classes x on x.path_id = dp.path_id
                       where dp.dog_id = p_dog and dp.completed_at is null and x.class_id = c.id) then
      return 'needs_' || need;
    end if;
  end loop;
  if exists (select 1 from public.vet_record_reviews r where r.dog_id = p_dog and r.status = 'denied') then
    return 'records_denied';
  end if;
  if (select count(*) from public.vaccinations v
      where v.dog_id = p_dog and v.expires_on >= on_day) < 3 then
    return 'vaccines';
  end if;
  return null;
end $$;

-- ---- The partner's side --------------------------------------------------------------------------------------

-- Feeds and the hide setting. The feed's URL often carries a private token, so it shows as its host only.
create function public.partner_calendar()
returns table (id uuid, trainer_id text, trainer_name text, name text, host text, status text, error text, busy_count int,
               last_read_at timestamptz, hide_when_busy boolean, hidden_sessions int)
language sql stable security definer set search_path = public as $$
  select f.id, f.trainer_id, t.name, f.name, substring(f.url from '^[a-z]+://([^/?#]+)'), f.status, f.error, f.busy_count, f.last_read_at,
         p.hide_when_busy,
         (select count(*)::int from public.sessions s join public.class_types c on c.id = s.class_id
          where c.partner_id = p.id and s.busy_hidden and s.starts_at > now() and s.cancelled_at is null)
  from public.partners p
  left join public.calendar_feeds f on f.partner_id = p.id
  left join public.trainers t on t.id = f.trainer_id
  where p.id = public.staff_partner()
  order by f.created_at
$$;

-- Adds a feed (any staff). The Edge Function reads it straight after, then every 15 minutes.
create function public.partner_add_calendar_feed(p_name text, p_url text, p_trainer text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me text := public.staff_partner();
  v_url text := trim(coalesce(p_url, ''));
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  fid uuid;
begin
  if v_url !~* '^(https|webcal)://[^[:space:]]+$' or length(v_url) > 1000 then raise exception 'bad_feed_url'; end if;
  if v_name is null or length(v_name) > 60 then raise exception 'bad_name'; end if;
  if p_trainer is not null and not exists (select 1 from public.trainers where id = p_trainer and partner_id = me) then
    raise exception 'not_found';
  end if;
  if (select count(*) from public.calendar_feeds where partner_id = me) >= 10 then raise exception 'too_many'; end if;
  if exists (select 1 from public.calendar_feeds where partner_id = me and url = v_url) then raise exception 'already_added'; end if;
  insert into public.calendar_feeds (partner_id, trainer_id, name, url) values (me, p_trainer, v_name, v_url) returning id into fid;
  return fid;
end $$;

-- Removes a feed and its busy times; sessions it closed open again.
create function public.partner_remove_calendar_feed(p_feed uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me text := public.staff_partner();
begin
  delete from public.calendar_feeds where id = p_feed and partner_id = me;
  if not found then raise exception 'not_found'; end if;
  perform public.refresh_busy_hidden(me);
end $$;

-- "Hide PackPass spots when you're busy". Off: busy times show on the schedule but close nothing.
create function public.partner_set_hide_when_busy(p_on boolean)
returns int language plpgsql security definer set search_path = public as $$
declare me text := public.staff_partner();
begin
  update public.partners set hide_when_busy = coalesce(p_on, true) where id = me;
  return public.refresh_busy_hidden(me);
end $$;

-- Busy times and closed sessions in a range, for the schedule grid.
create function public.partner_busy(p_from timestamptz, p_to timestamptz)
returns table (kind text, id uuid, trainer_id text, starts_at timestamptz, ends_at timestamptz, title text, feed_name text)
language sql stable security definer set search_path = public as $$
  select 'busy', b.id, b.trainer_id, b.starts_at, b.ends_at, b.title, f.name
  from public.busy_blocks b join public.calendar_feeds f on f.id = b.feed_id
  where b.partner_id = public.staff_partner() and b.ends_at > p_from and b.starts_at < p_to
  union all
  select 'hidden', s.id, c.trainer_id, s.starts_at, s.starts_at + make_interval(mins => c.duration_min), null, null
  from public.sessions s join public.class_types c on c.id = s.class_id
  where c.partner_id = public.staff_partner() and s.busy_hidden and s.starts_at >= p_from and s.starts_at < p_to
  order by 4
$$;

-- Whether the caller may read this feed now (the Edge Function asks before reading it on the partner's behalf).
create function public.partner_owns_feed(p_feed uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.calendar_feeds where id = p_feed and partner_id = public.my_partner())
$$;

revoke execute on function public.partner_calendar, public.partner_add_calendar_feed, public.partner_remove_calendar_feed,
  public.partner_set_hide_when_busy, public.partner_busy, public.partner_owns_feed from public, anon;
grant execute on function public.partner_calendar, public.partner_add_calendar_feed, public.partner_remove_calendar_feed,
  public.partner_set_hide_when_busy, public.partner_busy, public.partner_owns_feed to authenticated;

-- ---- The Edge Function's side (service role) -----------------------------------------------------------------

-- Feeds to read: every feed not read in the last 14 minutes, or one feed on request.
create function public.calendar_feeds_due(p_feed uuid default null)
returns table (id uuid, url text)
language sql stable security definer set search_path = public as $$
  select f.id, f.url from public.calendar_feeds f
  where case when p_feed is null then f.last_read_at is null or f.last_read_at < now() - interval '14 minutes' else f.id = p_feed end
  order by f.last_read_at nulls first
  limit 200
$$;

-- Stores what a read found: the feed's busy times from now on (replacing the last read), or the error that stopped
-- it (keeping the busy times it had). Then re-checks the partner's sessions. Returns how many sessions are closed.
create function public.calendar_store_busy(p_feed uuid, p_blocks jsonb, p_error text default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  f public.calendar_feeds;
  n int;
begin
  select * into f from public.calendar_feeds where id = p_feed for update;
  if not found then raise exception 'not_found'; end if;
  if p_error is not null then
    update public.calendar_feeds set status = 'error', error = left(p_error, 200), last_read_at = now() where id = p_feed;
    return public.refresh_busy_hidden(f.partner_id);
  end if;
  delete from public.busy_blocks where feed_id = p_feed;
  insert into public.busy_blocks (feed_id, partner_id, trainer_id, starts_at, ends_at, title)
  select p_feed, f.partner_id, f.trainer_id, x.starts_at, x.ends_at, left(nullif(trim(x.title), ''), 120)
  from jsonb_to_recordset(coalesce(p_blocks, '[]')) as x (starts_at timestamptz, ends_at timestamptz, title text)
  where x.ends_at > x.starts_at and x.ends_at > now() and x.starts_at < now() + interval '15 days'
  limit 2000;
  get diagnostics n = row_count;
  update public.calendar_feeds set status = 'ok', error = null, busy_count = n, last_read_at = now() where id = p_feed;
  return public.refresh_busy_hidden(f.partner_id);
end $$;
revoke execute on function public.calendar_feeds_due, public.calendar_store_busy from public, anon, authenticated;
grant execute on function public.calendar_feeds_due, public.calendar_store_busy to service_role;

-- Every 15 minutes: ask the Edge Function to read the feeds that are due (Vault: calendar_function_url and the
-- shared push_webhook_secret). Without them, or without pg_net, nothing happens.
create function public.read_calendar_feeds()
returns void language plpgsql security definer set search_path = public as $$
declare
  url text := public.push_secret('calendar_function_url');
  secret text := public.push_secret('push_webhook_secret');
begin
  if url is null or secret is null or to_regproc('net.http_post') is null then return; end if;
  if not exists (select 1 from public.calendar_feeds) then return; end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 60000)'
  using url, '{"due": true}'::jsonb, jsonb_build_object('content-type', 'application/json', 'x-webhook-secret', secret);
end $$;
revoke execute on function public.read_calendar_feeds from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('calendar-feeds', '*/15 * * * *', 'select public.read_calendar_feeds()');
  end if;
end $$;
