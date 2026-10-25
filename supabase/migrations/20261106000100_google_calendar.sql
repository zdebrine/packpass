-- PackPass › Calendar sync, part two: Google Calendar, two-way (v3 phase 4e, Partner Scheduling P6 to P6d, 14a, 14b).
--   * a partner signs in with Google from Settings › Calendar sync (for the whole place or one trainer). The
--     calendar-sync Edge Function keeps the Google tokens here, where only it can read them.
--   * every 15 minutes, with the iCal feeds, it reads the next two weeks of the Google calendar into busy_blocks (the
--     same busy times and hide rules as part one, through calendar_store_busy) and writes each PackPass session with
--     dogs booked in the next 30 days to that calendar: the class, the dogs and a roster link. Its own events are
--     marked, so they never count as busy.
--   * disconnecting removes PackPass's events from the calendar, revokes the Google access and forgets the tokens.
-- A Google connection is a calendar_feeds row with kind 'google', so it lists, closes sessions and shows errors like
-- an iCal feed.

alter table public.calendar_feeds add column kind text not null default 'ical' check (kind in ('ical', 'google'));

-- The Google tokens, one row per Google connection. No policies and no grants: the service role only.
create table public.calendar_google_tokens (
  feed_id uuid primary key references public.calendar_feeds (id) on delete cascade,
  email text not null,
  refresh_token text not null,
  access_token text,
  access_expires_at timestamptz
);
alter table public.calendar_google_tokens enable row level security;
revoke all on public.calendar_google_tokens from anon, authenticated;

-- The events PackPass wrote to a Google calendar, one per session, with a hash of what it wrote.
create table public.calendar_exports (
  feed_id uuid not null references public.calendar_feeds (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  event_id text not null check (length(event_id) <= 1024),
  hash text not null check (length(hash) <= 64),
  primary key (feed_id, session_id)
);
alter table public.calendar_exports enable row level security;
revoke all on public.calendar_exports from anon, authenticated;

-- A Google sign-in in progress: who started it and for what. Used once, within 15 minutes.
create table public.calendar_oauth_states (
  state uuid primary key default gen_random_uuid(),
  partner_id text not null references public.partners (id) on delete cascade,
  trainer_id text references public.trainers (id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now()
);
alter table public.calendar_oauth_states enable row level security;
revoke all on public.calendar_oauth_states from anon, authenticated;

-- ---- The partner's side --------------------------------------------------------------------------------------

-- Starts a Google sign-in (any staff). The dashboard then opens calendar-sync/google/start?state=… .
create function public.partner_google_start(p_trainer text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me text := public.staff_partner();
  st uuid;
begin
  if p_trainer is not null and not exists (select 1 from public.trainers where id = p_trainer and partner_id = me) then
    raise exception 'not_found';
  end if;
  delete from public.calendar_oauth_states where created_at < now() - interval '1 day';
  insert into public.calendar_oauth_states (partner_id, trainer_id, user_id) values (me, p_trainer, auth.uid()) returning state into st;
  return st;
end $$;
revoke execute on function public.partner_google_start from public, anon;
grant execute on function public.partner_google_start to authenticated;

-- ---- The Edge Function's side (service role) -----------------------------------------------------------------

-- iCal feeds to read (as in …_calendar_sync.sql), now leaving Google connections to calendar_google_due.
create or replace function public.calendar_feeds_due(p_feed uuid default null)
returns table (id uuid, url text)
language sql stable security definer set search_path = public as $$
  select f.id, f.url from public.calendar_feeds f
  where f.kind = 'ical'
    and case when p_feed is null then f.last_read_at is null or f.last_read_at < now() - interval '14 minutes' else f.id = p_feed end
  order by f.last_read_at nulls first
  limit 200
$$;

-- Google connections to sync: every one not read in the last 14 minutes, or one on request.
create function public.calendar_google_due(p_feed uuid default null)
returns table (id uuid, email text, refresh_token text, access_token text, access_expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select f.id, t.email, t.refresh_token, t.access_token, t.access_expires_at
  from public.calendar_feeds f join public.calendar_google_tokens t on t.feed_id = f.id
  where f.kind = 'google'
    and case when p_feed is null then f.last_read_at is null or f.last_read_at < now() - interval '14 minutes' else f.id = p_feed end
  order by f.last_read_at nulls first
  limit 200
$$;

-- Whether a sign-in is still waiting (the start link was opened within 15 minutes and not used).
create function public.calendar_google_state_ok(p_state uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.calendar_oauth_states where state = p_state and created_at > now() - interval '15 minutes')
$$;

-- Finishes a sign-in: one Google connection per partner, trainer and Google account. Signing in again with the same
-- account replaces its tokens (Google sends a refresh token only on the first consent, so an empty one keeps the
-- last). Returns the connection's feed id.
create function public.calendar_google_connect(p_state uuid, p_email text, p_refresh_token text, p_access_token text, p_expires_in int)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  st public.calendar_oauth_states;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_url text;
  fid uuid;
begin
  delete from public.calendar_oauth_states where state = p_state and created_at > now() - interval '15 minutes' returning * into st;
  if not found then raise exception 'expired'; end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+$' or length(v_email) > 254 then raise exception 'bad_email'; end if;
  v_url := 'https://www.googleapis.com/calendar/v3/calendars/' || replace(v_email, '@', '%40');
  select id into fid from public.calendar_feeds
  where partner_id = st.partner_id and trainer_id is not distinct from st.trainer_id and url = v_url;
  if fid is null then
    if nullif(p_refresh_token, '') is null then raise exception 'no_refresh_token'; end if;
    if (select count(*) from public.calendar_feeds where partner_id = st.partner_id) >= 10 then raise exception 'too_many'; end if;
    insert into public.calendar_feeds (partner_id, trainer_id, name, url, kind)
    values (st.partner_id, st.trainer_id, left('Google Calendar · ' || v_email, 60), v_url, 'google')
    returning id into fid;
    insert into public.calendar_google_tokens (feed_id, email, refresh_token) values (fid, v_email, p_refresh_token);
  else
    update public.calendar_feeds set status = 'pending', error = null where id = fid;
    insert into public.calendar_google_tokens (feed_id, email, refresh_token) values (fid, v_email, coalesce(nullif(p_refresh_token, ''), ''))
    on conflict (feed_id) do update set refresh_token = coalesce(nullif(excluded.refresh_token, ''), calendar_google_tokens.refresh_token);
    if (select refresh_token from public.calendar_google_tokens where feed_id = fid) = '' then raise exception 'no_refresh_token'; end if;
  end if;
  update public.calendar_google_tokens
  set access_token = nullif(p_access_token, ''), access_expires_at = now() + make_interval(secs => greatest(coalesce(p_expires_in, 0) - 60, 0))
  where feed_id = fid;
  return fid;
end $$;

-- Keeps a refreshed access token.
create function public.calendar_google_token(p_feed uuid, p_access_token text, p_expires_in int)
returns void language sql security definer set search_path = public as $$
  update public.calendar_google_tokens
  set access_token = p_access_token, access_expires_at = now() + make_interval(secs => greatest(coalesce(p_expires_in, 0) - 60, 0))
  where feed_id = p_feed
$$;

-- What the calendar should hold: each session with dogs booked from now to 30 days out (for a trainer's connection,
-- that trainer's classes), next to the event PackPass already wrote for it. A row with no title is an event to
-- remove: its session was cancelled, emptied or moved out of the connection's classes. Past events stay as they are.
create function public.calendar_google_exports(p_feed uuid)
returns table (session_id uuid, starts_at timestamptz, ends_at timestamptz, title text, dogs text, event_id text, hash text)
language sql stable security definer set search_path = public as $$
  with f as (select * from public.calendar_feeds where id = p_feed and kind = 'google'),
  want as (
    select s.id, s.starts_at, s.starts_at + make_interval(mins => c.duration_min) as ends_at, c.title,
           string_agg(d.name, ', ' order by d.name) as dogs
    from f
    join public.class_types c on c.partner_id = f.partner_id and (f.trainer_id is null or c.trainer_id = f.trainer_id)
    join public.sessions s on s.class_id = c.id
    join public.bookings b on b.session_id = s.id and b.status in ('booked', 'checked_in')
    join public.dogs d on d.id = b.dog_id
    where s.cancelled_at is null and s.starts_at > now() and s.starts_at < now() + interval '30 days'
    group by s.id, s.starts_at, c.duration_min, c.title
  ),
  have as (
    select x.session_id, x.event_id, x.hash from public.calendar_exports x
    join public.sessions s on s.id = x.session_id
    where x.feed_id = p_feed and s.starts_at > now()
  )
  select coalesce(w.id, h.session_id), w.starts_at, w.ends_at, w.title, w.dogs, h.event_id, h.hash
  from want w full join have h on h.session_id = w.id
  order by 2 nulls first
  limit 1000
$$;

-- Records what a sync wrote ([{session_id, event_id, hash}]) and the events it removed.
create function public.calendar_google_store_exports(p_feed uuid, p_written jsonb, p_removed uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.calendar_exports (feed_id, session_id, event_id, hash)
  select p_feed, x.session_id, x.event_id, x.hash
  from jsonb_to_recordset(coalesce(p_written, '[]')) as x (session_id uuid, event_id text, hash text)
  where exists (select 1 from public.sessions where id = x.session_id)
  on conflict (feed_id, session_id) do update set event_id = excluded.event_id, hash = excluded.hash;
  delete from public.calendar_exports where feed_id = p_feed and session_id = any (coalesce(p_removed, '{}'));
end $$;

-- After the Edge Function removed PackPass's events and revoked the access: forgets the connection. Sessions it
-- closed open again.
create function public.calendar_google_disconnect(p_feed uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p text;
begin
  delete from public.calendar_feeds where id = p_feed and kind = 'google' returning partner_id into p;
  if p is null then raise exception 'not_found'; end if;
  perform public.refresh_busy_hidden(p);
end $$;

revoke execute on function public.calendar_google_due, public.calendar_google_state_ok, public.calendar_google_connect,
  public.calendar_google_token, public.calendar_google_exports, public.calendar_google_store_exports,
  public.calendar_google_disconnect from public, anon, authenticated;
grant execute on function public.calendar_google_due, public.calendar_google_state_ok, public.calendar_google_connect,
  public.calendar_google_token, public.calendar_google_exports, public.calendar_google_store_exports,
  public.calendar_google_disconnect to service_role;

-- The 15-minute run (read_calendar_feeds in part one) only calls the Edge Function when there's a feed to read;
-- Google connections are feeds too, so it needs no change.
