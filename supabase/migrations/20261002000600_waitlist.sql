-- Waitlist for full sessions.
-- A member joins for one dog. Every booking rule except "full" applies when joining (Social, Herding,
-- vaccines, credits), so a waitlisted dog is one that could book the moment a spot opens.
-- When a spot opens (a cancellation, a released hold), the first dog in line is booked automatically
-- and the credits are charged, as the join screen says. That only happens until 12 hours before the
-- start, so the member can still cancel for free. Inside 12 hours, everyone still waiting is told the
-- spot is open and the first to book it gets it.

create type public.waitlist_status as enum ('waiting', 'booked', 'left', 'missed');

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  status public.waitlist_status not null default 'waiting',
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  booking_id uuid references public.bookings (id),
  missed_reason text,       -- why an automatic booking failed (credits, vaccines, ...)
  alerted_at timestamptz    -- told about an open spot inside the 12-hour window
);
create unique index waitlist_one_live on public.waitlist (session_id, dog_id) where status = 'waiting';
create index on public.waitlist (session_id, created_at) where status = 'waiting';

alter table public.waitlist enable row level security;
create policy "waitlist: read own" on public.waitlist for select to authenticated using (member_id = auth.uid());

-- ---- Booking on someone's behalf ---------------------------------------------------------------

-- The body of book_session, for a given member. book_session calls it for the signed-in member;
-- the waitlist calls it for the member at the front of the line. Not callable from the API.
create function public.book_as(p_member uuid, p_session uuid, p_dog uuid)
returns public.bookings language plpgsql security definer set search_path = public as $$
declare
  s public.sessions;
  c public.class_types;
  p public.profiles;
  block text;
  b public.bookings;
  hold uuid;
begin
  if not exists (select 1 from public.dogs where id = p_dog and owner_id = p_member) then raise exception 'not_your_dog'; end if;

  -- Lock the session and the member so two taps can't double-spend spots or credits.
  select * into s from public.sessions where id = p_session for update;
  if not found then raise exception 'not_found'; end if;
  select * into c from public.class_types where id = s.class_id;
  select * into p from public.profiles where id = p_member for update;
  select id into hold from public.held_spots
  where session_id = p_session and dog_id = p_dog and member_id = p_member and status = 'held' and expires_at > now();

  block := public.booking_block(p_dog, p_session);
  if block is not null then raise exception '%', block; end if;
  if exists (select 1 from public.bookings where session_id = p_session and dog_id = p_dog and status <> 'cancelled') then
    raise exception 'already_booked';
  end if;
  if hold is null and s.spots_left <= 0 then raise exception 'full'; end if;
  if p.credits_balance < c.credits then raise exception 'credits'; end if;

  if hold is null then
    update public.sessions set spots_left = spots_left - 1 where id = p_session;
  else
    update public.held_spots set status = 'booked', closed_at = now() where id = hold;
  end if;
  update public.profiles set credits_balance = credits_balance - c.credits where id = p_member;
  insert into public.bookings (session_id, dog_id, member_id, credits_charged)
  values (p_session, p_dog, p_member, c.credits) returning * into b;
  insert into public.credit_ledger (member_id, delta, reason, booking_id) values (p_member, -c.credits, 'booking', b.id);
  -- Booking yourself means you're no longer waiting for it.
  update public.waitlist set status = 'booked', closed_at = now(), booking_id = b.id
  where session_id = p_session and dog_id = p_dog and status = 'waiting';
  return b;
end $$;
revoke execute on function public.book_as from public, anon, authenticated;

create or replace function public.book_session(p_session uuid, p_dog uuid)
returns public.bookings language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  return public.book_as(auth.uid(), p_session, p_dog);
end $$;

-- ---- Joining and leaving ------------------------------------------------------------------------

-- Joins the waitlist of a full session. Returns the dog's place in line (1 = next).
create function public.join_waitlist(p_dog uuid, p_session uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  s public.sessions;
  block text;
  w public.waitlist;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from public.dogs where id = p_dog and owner_id = me) then raise exception 'not_your_dog'; end if;
  select * into s from public.sessions where id = p_session for update;
  if not found then raise exception 'not_found'; end if;
  block := public.booking_block(p_dog, p_session);
  if block is not null then raise exception '%', block; end if;
  if exists (select 1 from public.bookings where session_id = p_session and dog_id = p_dog and status <> 'cancelled') then
    raise exception 'already_booked';
  end if;
  if exists (select 1 from public.waitlist where session_id = p_session and dog_id = p_dog and status = 'waiting') then
    raise exception 'already_waiting';
  end if;
  if s.spots_left > 0 then raise exception 'not_full'; end if;
  if (select credits_balance from public.profiles where id = me)
     < (select credits from public.class_types where id = s.class_id) then
    raise exception 'credits';
  end if;
  insert into public.waitlist (session_id, dog_id, member_id) values (p_session, p_dog, me) returning * into w;
  return (select count(*) from public.waitlist x where x.session_id = p_session and x.status = 'waiting' and x.created_at <= w.created_at);
end $$;

create function public.leave_waitlist(p_dog uuid, p_session uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.waitlist set status = 'left', closed_at = now()
  where session_id = p_session and dog_id = p_dog and member_id = auth.uid() and status = 'waiting';
end $$;

-- The signed-in member's waitlist entries for sessions that haven't started, with their place in line.
create function public.my_waitlist()
returns table (session_id uuid, dog_id uuid, place int)
language sql stable security definer set search_path = public as $$
  select w.session_id, w.dog_id,
         (select count(*) from public.waitlist x where x.session_id = w.session_id and x.status = 'waiting' and x.created_at <= w.created_at)::int
  from public.waitlist w join public.sessions s on s.id = w.session_id
  where w.member_id = auth.uid() and w.status = 'waiting' and s.starts_at > now()
  order by s.starts_at
$$;

revoke execute on function public.join_waitlist, public.leave_waitlist, public.my_waitlist from public, anon;
grant execute on function public.join_waitlist, public.leave_waitlist, public.my_waitlist to authenticated;

-- ---- Filling open spots -------------------------------------------------------------------------

create function public.fill_from_waitlist(p_session uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  s public.sessions;
  t text;
  w public.waitlist;
  b public.bookings;
  n int := 0;
begin
  select * into s from public.sessions where id = p_session;
  select title into t from public.class_types where id = s.class_id;
  if s.starts_at <= now() then return 0; end if;

  -- Inside 12 hours: no automatic booking (it couldn't be cancelled for free). Tell everyone waiting once.
  if s.starts_at - now() < interval '12 hours' then
    with told as (
      update public.waitlist set alerted_at = now()
      where session_id = p_session and status = 'waiting' and alerted_at is null
      returning member_id
    )
    insert into public.notifications (member_id, category, kind, title, body, href)
    select distinct member_id, 'bookings'::public.notification_category, 'waitlist_open', 'A spot opened. ' || t,
           to_char(s.starts_at at time zone 'America/Chicago', 'FMDay FMHH12:MI am') || '. First to book it gets it.',
           '/class/' || p_session
    from told;
    return 0;
  end if;

  loop
    select spots_left into s.spots_left from public.sessions where id = p_session;
    exit when s.spots_left <= 0;
    select * into w from public.waitlist where session_id = p_session and status = 'waiting' order by created_at limit 1 for update;
    exit when not found;
    begin
      -- Tell notify_booking to skip its plain "Booked." note; this one says it came off the waitlist (and is pushed).
      -- A failed booking rolls the setting back with the rest of this block.
      perform set_config('packpass.waitlist_booking', 'on', true);
      b := public.book_as(w.member_id, p_session, w.dog_id);
      perform set_config('packpass.waitlist_booking', 'off', true);
      insert into public.notifications (member_id, category, kind, title, body, href)
      values (w.member_id, 'bookings', 'waitlist_booked', 'Off the waitlist. ' || t || ' is booked.',
              to_char(s.starts_at at time zone 'America/Chicago', 'FMDay FMHH12:MI am') || ' · '
                || b.credits_charged || case when b.credits_charged = 1 then ' credit' else ' credits' end
                || '. Free to cancel until 12 hours before.',
              '/class/' || p_session);
      n := n + 1;
    exception when others then
      update public.waitlist set status = 'missed', closed_at = now(), missed_reason = sqlerrm where id = w.id;
      insert into public.notifications (member_id, category, kind, title, body, href)
      values (w.member_id, 'bookings', 'waitlist_missed', 'A spot opened, but we couldn''t book it',
              t || ': ' || case sqlerrm when 'credits' then 'not enough credits.' when 'vaccines' then 'vaccines need updating for that day.'
                                        when 'needs_social' then 'it needs a Social clearance.' else 'it can''t be booked right now.' end,
              '/class/' || p_session);
    end;
  end loop;
  return n;
end $$;
revoke execute on function public.fill_from_waitlist from public, anon, authenticated;

-- Booking notifications, except for waitlist bookings (fill_from_waitlist writes its own).
create or replace function public.notify_booking() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t text;
  s public.sessions;
begin
  if current_setting('packpass.waitlist_booking', true) = 'on' then return new; end if;
  select * into s from public.sessions where id = new.session_id;
  select title into t from public.class_types where id = s.class_id;
  insert into public.notifications (member_id, category, kind, title, body, href)
  values (new.member_id, 'bookings', 'booked', 'Booked. ' || t,
          to_char(s.starts_at at time zone 'America/Chicago', 'FMDay FMHH12:MI am') || ' · ' || new.credits_charged
            || case when new.credits_charged = 1 then ' credit' else ' credits' end,
          '/class/' || new.session_id);
  return new;
end $$;

-- Any time a session gets spots back (cancel_booking, released or expired holds), offer them to the line.
create function public.sessions_spot_opened() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.fill_from_waitlist(new.id);
  return null;
end $$;
create trigger sessions_fill_waitlist after update of spots_left on public.sessions
for each row when (new.spots_left > old.spots_left) execute function public.sessions_spot_opened();
