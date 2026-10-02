-- Partner dashboard (apps/partner): staff accounts and everything a partner does from the web.
-- Staff sign in with the same Supabase Auth as members. A staff row ties an account to one partner
-- (and, for trainers, to their trainer profile). Every partner function checks it and only touches
-- that partner's classes, sessions and the dogs booked into them.

-- ---- Staff ----------------------------------------------------------------------------------------

create table public.partner_staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  partner_id text not null references public.partners (id),
  trainer_id text references public.trainers (id),
  role text not null default 'trainer' check (role in ('owner', 'trainer')),
  created_at timestamptz not null default now()
);
create index on public.partner_staff (partner_id);
create index on public.partner_staff (trainer_id);
alter table public.partner_staff enable row level security;
create policy "partner_staff: read own" on public.partner_staff for select to authenticated using (user_id = (select auth.uid()));

-- The signed-in account's partner, or null.
create function public.my_partner() returns text
language sql stable security definer set search_path = public as $$
  select partner_id from public.partner_staff where user_id = auth.uid()
$$;
-- Callable by anyone: the class_types read policy uses it, and it's null for members and visitors.
grant execute on function public.my_partner to anon, authenticated;

-- Same, but raises 'not_partner' for accounts that aren't staff.
create function public.staff_partner() returns text
language plpgsql stable security definer set search_path = public as $$
declare p text := public.my_partner();
begin
  if p is null then raise exception 'not_partner'; end if;
  return p;
end $$;
revoke execute on function public.staff_partner from public, anon, authenticated;

-- PackPass links an account to a partner (service role, e.g. from the SQL editor).
create function public.link_partner_staff(p_email text, p_partner text, p_role text default 'owner', p_trainer text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is null then raise exception 'no_account'; end if;
  insert into public.partner_staff (user_id, partner_id, role, trainer_id) values (uid, p_partner, p_role, p_trainer)
  on conflict (user_id) do update set partner_id = excluded.partner_id, role = excluded.role, trainer_id = excluded.trainer_id;
end $$;
revoke execute on function public.link_partner_staff from public, anon, authenticated;

-- ---- New columns ----------------------------------------------------------------------------------

alter table public.partners
  add column payout_status text not null default 'none' check (payout_status in ('none', 'pending', 'connected')),
  add column payout_rate_cents int not null default 950;           -- paid per credit used (pivot spec)

alter table public.trainers
  add column bio text,
  add column specialties text[] not null default '{}',
  add column private_sessions boolean not null default true;

-- New and changed classes wait for PackPass to set (or re-check) the credit cost.
alter table public.class_types
  add column status text not null default 'live' check (status in ('live', 'in_review', 'paused')),
  add column credit_review boolean not null default false,
  add column energy text[] not null default '{}',
  add column sociability text[] not null default '{}',
  alter column credits drop not null;

alter table public.sessions
  add column waitlist_open boolean not null default true,
  add column auto_promote boolean not null default true,
  add column cancelled_at timestamptz,
  add column cancel_reason text;

-- Members see live classes and sessions that aren't cancelled; staff also see their own in review.
alter policy "class_types: read" on public.class_types using (status = 'live' or partner_id = (select public.my_partner()));
alter policy "sessions: read" on public.sessions using (cancelled_at is null);

-- ---- Booking rules: cancelled sessions, waitlist switches --------------------------------------------

create or replace function public.booking_block(p_dog uuid, p_session uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  s public.sessions;
  c public.class_types;
  on_day date;
begin
  select * into s from public.sessions where id = p_session;
  if not found then raise exception 'not_found'; end if;
  select * into c from public.class_types where id = s.class_id;
  on_day := (s.starts_at at time zone 'America/Chicago')::date;

  if s.cancelled_at is not null then return 'cancelled'; end if;
  if s.starts_at <= now() then return 'started'; end if;
  if c.requires = 'herding' and not public.has_clearance(p_dog, 'herding', c.partner_id, on_day) then
    return 'needs_herding';
  end if;
  if c.session_type = 'class' and c.group_size > 1
     and not public.has_clearance(p_dog, 'social', c.partner_id, on_day)
     and not public.on_active_path(p_dog, c.id) then
    return 'needs_social';
  end if;
  if (select count(*) from public.vaccinations v
      where v.dog_id = p_dog and v.expires_on >= on_day) < 3 then
    return 'vaccines';
  end if;
  return null;
end $$;

create or replace function public.join_waitlist(p_dog uuid, p_session uuid)
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
  if not s.waitlist_open then raise exception 'waitlist_closed'; end if;
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

-- With auto-promote off (or inside 12 hours), an open spot is announced instead of booked.
create or replace function public.fill_from_waitlist(p_session uuid)
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
  if s.starts_at <= now() or s.cancelled_at is not null then return 0; end if;

  if s.starts_at - now() < interval '12 hours' or not s.auto_promote then
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

-- The new notification kinds are pushed too.
create or replace function public.push_kind(k text) returns boolean language sql immutable set search_path = public as $$
  select k in ('hold_expiring', 'holds_released', 'clearance_earned', 'waitlist_booked', 'waitlist_open', 'waitlist_missed',
               'session_cancelled', 'session_note', 'assessment_result')
$$;

-- Classes in review don't get sessions until PackPass puts them live.
create or replace function public.extend_schedule(p_days int default 28)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.sessions (class_id, starts_at, capacity, packpass_spots, spots_left)
  select t.class_id, (d.day + t.starts) at time zone 'America/Chicago', c.group_size, c.group_size, c.group_size
  from generate_series(0, p_days - 1) g(i)
  cross join lateral (select ((now() at time zone 'America/Chicago')::date + g.i) as day) d
  join public.timetable t on t.weekday is null or t.weekday = extract(dow from d.day)
  join public.class_types c on c.id = t.class_id and c.status = 'live'
  where (d.day + t.starts) at time zone 'America/Chicago' > now()
    and not exists (
      select 1 from public.sessions s
      where s.class_id = t.class_id and s.starts_at = (d.day + t.starts) at time zone 'America/Chicago'
    );
  get diagnostics n = row_count;
  return n;
end $$;

-- ---- Reading the schedule and rosters ---------------------------------------------------------------

-- Sessions of the staff member's partner between two times, with what the dashboard shows about each.
create function public.partner_sessions(p_from timestamptz, p_to timestamptz)
returns table (
  id uuid, class_id text, starts_at timestamptz, capacity int, packpass_spots int, spots_left int,
  booked int, checked_in int, waiting int, check_in_code text, waitlist_open boolean, auto_promote boolean,
  cancelled_at timestamptz, cancel_reason text
) language sql stable security definer set search_path = public as $$
  select s.id, s.class_id, s.starts_at, s.capacity, s.packpass_spots, s.spots_left,
         (select count(*) from public.bookings b where b.session_id = s.id and b.status <> 'cancelled')::int,
         (select count(*) from public.bookings b where b.session_id = s.id and b.status = 'checked_in')::int,
         (select count(*) from public.waitlist w where w.session_id = s.id and w.status = 'waiting')::int,
         s.check_in_code, s.waitlist_open, s.auto_promote, s.cancelled_at, s.cancel_reason
  from public.sessions s join public.class_types c on c.id = s.class_id
  where c.partner_id = public.staff_partner() and s.starts_at >= p_from and s.starts_at < p_to
  order by s.starts_at
$$;

-- Does this dog have a booking with the staff member's partner (past, upcoming or cancelled)?
create function public.dog_at_my_partner(p_dog uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.bookings b join public.sessions s on s.id = b.session_id join public.class_types c on c.id = s.class_id
    where b.dog_id = p_dog and c.partner_id = public.my_partner()
  )
$$;
revoke execute on function public.dog_at_my_partner from public, anon;
grant execute on function public.dog_at_my_partner to authenticated;

-- One-line vaccine status for a dog on a given day, as the roster shows it.
create function public.vaccine_line(p_dog uuid, p_on date) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  n int;
  first_type text;
  first_exp date;
  all_ok boolean;
begin
  select count(*), bool_and(verified) into n, all_ok from public.vaccinations where dog_id = p_dog;
  if n < 3 then return 'Vaccine records missing'; end if;
  select case type when 'dhpp' then 'DHPP' else initcap(type::text) end, expires_on into first_type, first_exp
  from public.vaccinations where dog_id = p_dog order by expires_on limit 1;
  if first_exp < p_on then return first_type || ' expired ' || to_char(first_exp, 'Mon FMDD'); end if;
  if first_exp < p_on + 30 then return first_type || ' expires ' || to_char(first_exp, 'Mon FMDD'); end if;
  return case when all_ok then 'Vaccines verified' else 'Vaccines not checked yet' end;
end $$;
revoke execute on function public.vaccine_line from public, anon, authenticated;

create function public.partner_roster(p_session uuid)
returns table (
  booking_id uuid, status public.booking_status, checked_in_at timestamptz, dog_id uuid, dog_name text, breed text,
  mixed boolean, birth_year int, birth_month int, energy public.energy_level, sociability public.sociability,
  traits text[], photo_path text, owner_name text, vaccine_line text, record_path text,
  record_verified boolean, clearances text[], last_note text
) language sql stable security definer set search_path = public as $$
  select b.id, b.status, b.checked_in_at, d.id, d.name, d.breed, d.mixed, d.birth_year, d.birth_month, d.energy, d.sociability,
         d.traits, d.photo_path, p.name,
         public.vaccine_line(d.id, (s.starts_at at time zone 'America/Chicago')::date),
         (select v.document_path from public.vaccinations v where v.dog_id = d.id and v.document_path is not null limit 1),
         coalesce((select bool_and(v.verified) from public.vaccinations v where v.dog_id = d.id), false),
         array(select initcap(k.type::text) from public.clearances k where k.dog_id = d.id
               and (k.expires_on is null or k.expires_on >= current_date) and (k.scope = 'network' or k.partner_id = c.partner_id)
               order by k.type),
         (select n.note from public.session_notes n join public.bookings bb on bb.id = n.booking_id
          where bb.dog_id = d.id order by n.created_at desc limit 1)
  from public.sessions s
  join public.class_types c on c.id = s.class_id
  join public.bookings b on b.session_id = s.id and b.status <> 'cancelled'
  join public.dogs d on d.id = b.dog_id
  join public.profiles p on p.id = b.member_id
  where s.id = p_session and c.partner_id = public.staff_partner()
  order by d.name
$$;

create function public.partner_waitlist(p_session uuid)
returns table (dog_name text, breed text, joined_at timestamptz, place int)
language sql stable security definer set search_path = public as $$
  select d.name, d.breed, w.created_at, row_number() over (order by w.created_at)::int
  from public.waitlist w join public.dogs d on d.id = w.dog_id
  join public.sessions s on s.id = w.session_id join public.class_types c on c.id = s.class_id
  where w.session_id = p_session and w.status = 'waiting' and c.partner_id = public.staff_partner()
  order by w.created_at
$$;

-- ---- Running sessions ---------------------------------------------------------------------------------

-- Check a dog in by hand (or undo it), e.g. when the owner forgot their phone.
create function public.partner_check_in(p_booking uuid, p_undo boolean default false)
returns public.bookings language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  select bk.* into b from public.bookings bk join public.sessions s on s.id = bk.session_id join public.class_types c on c.id = s.class_id
  where bk.id = p_booking and c.partner_id = public.staff_partner() for update of bk;
  if not found then raise exception 'not_found'; end if;
  if b.status = 'cancelled' then raise exception 'not_booked'; end if;
  update public.bookings
  set status = case when p_undo then 'booked' else 'checked_in' end::public.booking_status,
      checked_in_at = case when p_undo then null else coalesce(checked_in_at, now()) end
  where id = p_booking returning * into b;
  return b;
end $$;

-- Capacity, PackPass spots and the waitlist switches. PackPass spots can't drop below the dogs
-- already booked or held; opening spots offers them to the waitlist (the spots trigger does that).
create function public.partner_update_session(p_session uuid, p_capacity int, p_packpass int, p_waitlist_open boolean, p_auto_promote boolean)
returns public.sessions language plpgsql security definer set search_path = public as $$
declare
  s public.sessions;
  taken int;
begin
  select ss.* into s from public.sessions ss join public.class_types c on c.id = ss.class_id
  where ss.id = p_session and c.partner_id = public.staff_partner() for update of ss;
  if not found then raise exception 'not_found'; end if;
  taken := s.packpass_spots - s.spots_left;
  if p_packpass < taken then raise exception 'below_booked'; end if;
  if p_capacity < p_packpass or p_capacity > 40 then raise exception 'bad_capacity'; end if;
  update public.sessions set capacity = p_capacity, packpass_spots = p_packpass, spots_left = p_packpass - taken,
         waitlist_open = p_waitlist_open, auto_promote = p_auto_promote
  where id = p_session returning * into s;
  return s;
end $$;

-- Adds one session, and optionally the weekly slot so it keeps repeating (extend_schedule adds the rest).
create function public.partner_add_session(p_class text, p_starts_at timestamptz, p_capacity int, p_packpass int, p_repeat boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  c public.class_types;
  sid uuid;
  local timestamp := p_starts_at at time zone 'America/Chicago';
begin
  select * into c from public.class_types where id = p_class and partner_id = public.staff_partner();
  if not found then raise exception 'not_found'; end if;
  if c.status <> 'live' then raise exception 'not_live'; end if;
  if p_starts_at <= now() then raise exception 'started'; end if;
  if p_packpass < 0 or p_capacity < p_packpass or p_capacity > 40 then raise exception 'bad_capacity'; end if;
  insert into public.sessions (class_id, starts_at, capacity, packpass_spots, spots_left)
  values (p_class, p_starts_at, p_capacity, p_packpass, p_packpass) returning id into sid;
  if p_repeat then
    insert into public.timetable (class_id, weekday, starts) values (p_class, extract(dow from local)::smallint, local::time)
    on conflict do nothing;
  end if;
  return sid;
end $$;

-- Turns the weekly repeat of a session's slot on or off (the timetable row for its class, weekday and
-- time). Turning it off keeps sessions already on the schedule; extend_schedule just stops adding more.
create function public.partner_set_repeat(p_session uuid, p_repeat boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  s record;
begin
  select ss.class_id, ss.starts_at at time zone 'America/Chicago' local into s
  from public.sessions ss join public.class_types c on c.id = ss.class_id
  where ss.id = p_session and c.partner_id = public.staff_partner();
  if not found then raise exception 'not_found'; end if;
  if p_repeat then
    insert into public.timetable (class_id, weekday, starts) values (s.class_id, extract(dow from s.local)::smallint, s.local::time) on conflict do nothing;
  else
    -- A daily slot (weekday null) becomes the other six days, so only this weekday stops.
    if exists (select 1 from public.timetable where class_id = s.class_id and weekday is null and starts = s.local::time) then
      delete from public.timetable where class_id = s.class_id and weekday is null and starts = s.local::time;
      insert into public.timetable (class_id, weekday, starts)
      select s.class_id, d, s.local::time from generate_series(0, 6) d where d <> extract(dow from s.local) on conflict do nothing;
    else
      delete from public.timetable where class_id = s.class_id and weekday = extract(dow from s.local) and starts = s.local::time;
    end if;
  end if;
end $$;

-- Cancels one session for the partner: bookings are refunded in full and the owners told, holds and
-- the waitlist are closed. Returns how many dogs were booked. Used by the two functions below.
create function public.cancel_session_for_partner(p_session uuid, p_reason text, p_message text)
returns int language plpgsql security definer set search_path = public as $$
declare
  s record;
  b public.bookings;
  n int := 0;
begin
  select ss.id, ss.starts_at, c.title, pa.name pname into s
  from public.sessions ss join public.class_types c on c.id = ss.class_id join public.partners pa on pa.id = c.partner_id
  where ss.id = p_session for update of ss;
  update public.sessions set cancelled_at = now(), cancel_reason = p_reason where id = p_session;
  for b in update public.bookings set status = 'cancelled', cancelled_at = now()
           where session_id = p_session and status = 'booked' returning * loop
    update public.profiles set credits_balance = credits_balance + b.credits_charged where id = b.member_id;
    insert into public.credit_ledger (member_id, delta, reason, booking_id) values (b.member_id, b.credits_charged, 'refund', b.id);
    insert into public.notifications (member_id, category, kind, title, body, href)
    values (b.member_id, 'bookings', 'session_cancelled', s.title || ' is cancelled',
            to_char(s.starts_at at time zone 'America/Chicago', 'FMDay FMMon FMDD, FMHH12:MI am') || ' at ' || s.pname || ' (' || lower(p_reason) || '). '
              || b.credits_charged || case when b.credits_charged = 1 then ' credit is' else ' credits are' end || ' back in your balance.'
              || coalesce(' ' || nullif(trim(p_message), ''), ''),
            '/book');
    n := n + 1;
  end loop;
  update public.held_spots set status = 'released', closed_at = now() where session_id = p_session and status = 'held';
  update public.waitlist set status = 'left', closed_at = now() where session_id = p_session and status = 'waiting';
  return n;
end $$;
revoke execute on function public.cancel_session_for_partner from public, anon, authenticated;

-- Cancels one upcoming session (Schedule › Cancel this session).
create function public.partner_cancel_session(p_session uuid, p_reason text, p_message text default null)
returns int language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.sessions s join public.class_types c on c.id = s.class_id
    where s.id = p_session and c.partner_id = public.staff_partner() and s.cancelled_at is null and s.starts_at > now()
  ) then raise exception 'not_found'; end if;
  return public.cancel_session_for_partner(p_session, coalesce(nullif(trim(p_reason), ''), 'Cancelled by the partner'), p_message);
end $$;

-- Blocks days (weather, holidays): every upcoming session in the range is cancelled as above.
-- Returns the counts for the confirmation.
create function public.partner_block_dates(p_from date, p_to date, p_reason text, p_message text default null)
returns table (sessions int, dogs int) language plpgsql security definer set search_path = public as $$
declare
  me text := public.staff_partner();
  sid uuid;
  n_s int := 0;
  n_d int := 0;
begin
  if p_to < p_from or p_to > p_from + 60 then raise exception 'bad_range'; end if;
  for sid in
    select ss.id from public.sessions ss join public.class_types c on c.id = ss.class_id
    where c.partner_id = me and ss.cancelled_at is null and ss.starts_at > now()
      and (ss.starts_at at time zone 'America/Chicago')::date between p_from and p_to
  loop
    n_d := n_d + public.cancel_session_for_partner(sid, p_reason, p_message);
    n_s := n_s + 1;
  end loop;
  sessions := n_s; dogs := n_d;
  return next;
end $$;

-- ---- Notes and assessments ------------------------------------------------------------------------------

-- Bookings from the last p_days that have run, with the note sent for each (if any).
create function public.partner_notes(p_days int default 7)
returns table (booking_id uuid, session_id uuid, starts_at timestamptz, class_title text, dog_name text, breed text,
               owner_name text, photo_path text, note text, skills text[], sent_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.id, s.id, s.starts_at, c.title, d.name, d.breed, p.name, d.photo_path, n.note, coalesce(n.skills, '{}'), n.created_at
  from public.bookings b
  join public.sessions s on s.id = b.session_id
  join public.class_types c on c.id = s.class_id
  join public.dogs d on d.id = b.dog_id
  join public.profiles p on p.id = b.member_id
  left join public.session_notes n on n.booking_id = b.id
  where c.partner_id = public.staff_partner() and b.status in ('checked_in', 'booked')
    and s.starts_at < now() and s.starts_at > now() - make_interval(days => p_days)
  order by s.starts_at desc, d.name
$$;

-- Sends (or edits) the note for a booking; the owner is notified the first time.
create function public.partner_send_note(p_booking uuid, p_note text, p_skills text[] default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare
  me text := public.staff_partner();
  r record;
  trainer text;
begin
  if length(trim(coalesce(p_note, ''))) < 3 then raise exception 'empty_note'; end if;
  select b.id, b.member_id, d.name dog_name, c.title, c.trainer_id into r
  from public.bookings b join public.sessions s on s.id = b.session_id join public.class_types c on c.id = s.class_id
  join public.dogs d on d.id = b.dog_id
  where b.id = p_booking and c.partner_id = me and b.status <> 'cancelled';
  if not found then raise exception 'not_found'; end if;
  trainer := coalesce((select trainer_id from public.partner_staff where user_id = auth.uid()), r.trainer_id);
  if exists (select 1 from public.session_notes where booking_id = p_booking) then
    update public.session_notes set note = trim(p_note), skills = p_skills, trainer_id = trainer where booking_id = p_booking;
  else
    insert into public.session_notes (booking_id, trainer_id, note, skills) values (p_booking, trainer, trim(p_note), p_skills);
    insert into public.notifications (member_id, category, kind, title, body, href)
    values (r.member_id, 'notes', 'session_note',
            'Note on ' || r.dog_name || ' from ' || coalesce((select split_part(name, ' ', 1) from public.trainers where id = trainer), 'your trainer'),
            r.title || ': ' || left(trim(p_note), 140), '/log');
  end if;
end $$;

-- Assessment bookings (classes that grant a clearance) from two weeks back to two weeks ahead.
create function public.partner_assessments()
returns table (booking_id uuid, starts_at timestamptz, class_title text, grants public.clearance_type, duration_min int,
               dog_id uuid, dog_name text, breed text, owner_name text, photo_path text, traits text[],
               clearances text[], outcome public.assessment_outcome, strengths text[], working_on text[], quote text)
language sql stable security definer set search_path = public as $$
  select b.id, s.starts_at, c.title, c.grants, c.duration_min, d.id, d.name, d.breed, p.name, d.photo_path, d.traits,
         array(select initcap(k.type::text) || case when k.expires_on < current_date then ' · expired ' || to_char(k.expires_on, 'Mon YYYY') else '' end
               from public.clearances k where k.dog_id = d.id order by k.assessed_on desc),
         a.outcome, coalesce(a.strengths, '{}'), coalesce(a.working_on, '{}'), a.quote
  from public.bookings b
  join public.sessions s on s.id = b.session_id
  join public.class_types c on c.id = s.class_id
  join public.dogs d on d.id = b.dog_id
  join public.profiles p on p.id = b.member_id
  left join public.assessments a on a.booking_id = b.id
  where c.partner_id = public.staff_partner() and c.grants is not null and b.status <> 'cancelled'
    and s.starts_at between now() - interval '14 days' and now() + interval '14 days'
  order by (a.outcome is not null), s.starts_at
$$;

-- Records the result: a pass grants the clearance (record_assessment does the rest); "not yet" tells
-- the owner and, with p_goal, starts the training path that leads back to the clearance.
create function public.partner_record_result(p_booking uuid, p_outcome public.assessment_outcome,
  p_strengths text[] default '{}', p_working text[] default '{}', p_quote text default null, p_goal boolean default false)
returns public.assessments language plpgsql security definer set search_path = public as $$
declare
  me text := public.staff_partner();
  r record;
  who text;
  a public.assessments;
begin
  select b.id, b.dog_id, b.member_id, s.starts_at, c.grants, d.name dog_name into r
  from public.bookings b join public.sessions s on s.id = b.session_id join public.class_types c on c.id = s.class_id
  join public.dogs d on d.id = b.dog_id
  where b.id = p_booking and c.partner_id = me and c.grants is not null and b.status <> 'cancelled';
  if not found then raise exception 'not_found'; end if;
  if r.starts_at > now() then raise exception 'too_early'; end if;
  if exists (select 1 from public.assessments where booking_id = p_booking) then raise exception 'already_recorded'; end if;
  select coalesce(t.name, pr.name) into who from public.partner_staff ps
  left join public.trainers t on t.id = ps.trainer_id left join public.profiles pr on pr.id = ps.user_id
  where ps.user_id = auth.uid();
  a := public.record_assessment(r.dog_id, r.grants, me, coalesce(nullif(who, ''), 'PackPass partner'), p_outcome,
                                p_strengths, p_working, nullif(trim(coalesce(p_quote, '')), ''), p_booking);
  if p_outcome = 'not_yet' then
    if p_goal then
      insert into public.dog_paths (dog_id, path_id)
      select r.dog_id, id from public.training_paths where grants = r.grants
      on conflict (dog_id, path_id) do update set completed_at = null;
    end if;
    insert into public.notifications (member_id, category, kind, title, body, href)
    values (r.member_id, 'clearances', 'assessment_result',
            r.dog_name || '''s ' || initcap(r.grants::text) || ' assessment: not yet',
            coalesce(nullif(trim(coalesce(p_quote, '')), ''), 'Your trainer left notes on what to work on.')
              || case when p_goal then ' A training path is on ' || r.dog_name || '''s Passport.' else '' end,
            '/passport/' || r.grants::text);
  end if;
  return a;
end $$;

-- Marks a dog's vaccine records as checked against the uploaded vet record.
create function public.partner_check_vaccines(p_dog uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.staff_partner();
  if not public.dog_at_my_partner(p_dog) then raise exception 'not_found'; end if;
  if (select count(*) from public.vaccinations where dog_id = p_dog) < 3 then raise exception 'vaccines'; end if;
  update public.vaccinations set verified = true where dog_id = p_dog;
end $$;

-- Staff can open the photos and vet records of dogs booked with them. Files are <member>/<dog>/<file>.
create function public.file_of_my_partners_dog(p_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare folder text := split_part(p_name, '/', 2);
begin
  if public.my_partner() is null or folder !~ '^[0-9a-f-]{36}$' then return false; end if;
  return public.dog_at_my_partner(folder::uuid);
end $$;
revoke execute on function public.file_of_my_partners_dog from public, anon;
grant execute on function public.file_of_my_partners_dog to authenticated;
create policy "dog files: partner reads booked dogs" on storage.objects for select to authenticated
  using (bucket_id in ('dog-photos', 'vaccine-docs') and public.file_of_my_partners_dog(name));

-- ---- Classes and trainers --------------------------------------------------------------------------------

-- Creates a class (in review until PackPass sets its credits) or edits one. Changing what the credit
-- cost is based on (length, intensity, group size, type) sends a live class back for a credit review;
-- existing sessions and bookings keep their price.
create function public.partner_save_class(p_id text, p jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  me text := public.staff_partner();
  c public.class_types;
  new_id text;
  st public.session_type := coalesce(nullif(p ->> 'session_type', ''), 'class')::public.session_type;
  grp int := case when coalesce(nullif(p ->> 'session_type', ''), 'class') = 'class' then greatest(2, (p ->> 'group_size')::int) else 1 end;
begin
  if length(trim(coalesce(p ->> 'title', ''))) < 3 then raise exception 'bad_title'; end if;
  if p_id is null then
    new_id := me || '-' || trim(both '-' from regexp_replace(lower(p ->> 'title'), '[^a-z0-9]+', '-', 'g'));
    if exists (select 1 from public.class_types where id = new_id) then new_id := new_id || '-' || substr(md5(random()::text), 1, 4); end if;
    insert into public.class_types (id, partner_id, trainer_id, title, discipline, category, session_type, credits, duration_min,
      intensity, group_size, suits, suits_note, balance, description, image, requires, grants, requirements, status, energy, sociability)
    values (new_id, me, nullif(p ->> 'trainer_id', ''), trim(p ->> 'title'), p ->> 'discipline', (p ->> 'category')::public.class_category,
      st, null, (p ->> 'duration_min')::int, (p ->> 'intensity')::int, grp, p ->> 'suits', p ->> 'suits_note',
      (p ->> 'balance')::public.balance_category, p ->> 'description', p ->> 'image',
      case when st = 'assessment' then null else nullif(p ->> 'clearance', '')::public.clearance_type end,
      case when st = 'assessment' then nullif(p ->> 'clearance', '')::public.clearance_type else null end,
      coalesce(p -> 'requirements', '[]'), 'in_review',
      coalesce(array(select jsonb_array_elements_text(p -> 'energy')), '{}'), coalesce(array(select jsonb_array_elements_text(p -> 'sociability')), '{}'));
    return new_id;
  end if;

  select * into c from public.class_types where id = p_id and partner_id = me for update;
  if not found then raise exception 'not_found'; end if;
  update public.class_types set
    title = trim(p ->> 'title'), discipline = p ->> 'discipline', category = (p ->> 'category')::public.class_category,
    session_type = st, duration_min = (p ->> 'duration_min')::int, intensity = (p ->> 'intensity')::int, group_size = grp,
    suits = p ->> 'suits', suits_note = p ->> 'suits_note', description = p ->> 'description', image = coalesce(p ->> 'image', image),
    trainer_id = coalesce(nullif(p ->> 'trainer_id', ''), trainer_id),
    requires = case when st = 'assessment' then null else nullif(p ->> 'clearance', '')::public.clearance_type end,
    grants = case when st = 'assessment' then nullif(p ->> 'clearance', '')::public.clearance_type else null end,
    requirements = coalesce(p -> 'requirements', requirements),
    energy = coalesce(array(select jsonb_array_elements_text(p -> 'energy')), energy),
    sociability = coalesce(array(select jsonb_array_elements_text(p -> 'sociability')), sociability),
    credit_review = credit_review or (status = 'live' and (c.duration_min <> (p ->> 'duration_min')::int
      or c.intensity <> (p ->> 'intensity')::int or c.group_size <> grp or c.session_type <> st))
  where id = p_id;
  return p_id;
end $$;

create function public.partner_save_trainer(p_id text, p_bio text, p_specialties text[], p_private boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.trainers set bio = nullif(trim(coalesce(p_bio, '')), ''), specialties = coalesce(p_specialties, '{}'), private_sessions = p_private
  where id = p_id and partner_id = public.staff_partner();
  if not found then raise exception 'not_found'; end if;
end $$;

-- Where members park and meet the trainer (shown on the class page). Blank clears it.
create function public.partner_save_location(p_parking text, p_meet_at text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.partners set parking = nullif(trim(coalesce(p_parking, '')), ''), meet_at = nullif(trim(coalesce(p_meet_at, '')), '')
  where id = public.staff_partner();
end $$;

-- ---- Earnings ------------------------------------------------------------------------------------------

-- Credits earned per month (sessions that have run, plus late cancellations, which keep their
-- credits) and what that pays at the partner's rate. p_months back from this month.
create function public.partner_earnings(p_months int default 6)
returns table (month date, sessions int, dogs int, credits int, amount_cents int)
language sql stable security definer set search_path = public as $$
  with mine as (
    select date_trunc('month', s.starts_at at time zone 'America/Chicago')::date m, s.id sid, b.credits_charged cr
    from public.bookings b join public.sessions s on s.id = b.session_id join public.class_types c on c.id = s.class_id
    where c.partner_id = public.staff_partner() and s.starts_at < now()
      and (b.status in ('booked', 'checked_in', 'no_show')
           or (b.status = 'cancelled' and b.cancelled_at > s.starts_at - interval '12 hours'))
  )
  select g.m::date, count(distinct mine.sid)::int, count(mine.sid)::int, coalesce(sum(mine.cr), 0)::int,
         (coalesce(sum(mine.cr), 0) * (select payout_rate_cents from public.partners where id = public.staff_partner()))::int
  from generate_series(date_trunc('month', now() at time zone 'America/Chicago') - make_interval(months => p_months - 1),
                       date_trunc('month', now() at time zone 'America/Chicago'), interval '1 month') g(m)
  left join mine on mine.m = g.m::date
  group by g.m order by g.m desc
$$;

-- Credits per class this month, for the earnings breakdown.
create function public.partner_earnings_by_class()
returns table (class_id text, title text, dogs int, credits int, amount_cents int)
language sql stable security definer set search_path = public as $$
  select c.id, c.title, count(*)::int, sum(b.credits_charged)::int,
         (sum(b.credits_charged) * (select payout_rate_cents from public.partners where id = public.staff_partner()))::int
  from public.bookings b join public.sessions s on s.id = b.session_id join public.class_types c on c.id = s.class_id
  where c.partner_id = public.staff_partner() and s.starts_at < now()
    and s.starts_at >= date_trunc('month', now() at time zone 'America/Chicago') at time zone 'America/Chicago'
    and (b.status in ('booked', 'checked_in', 'no_show') or (b.status = 'cancelled' and b.cancelled_at > s.starts_at - interval '12 hours'))
  group by c.id, c.title order by 4 desc
$$;

-- ---- Grants --------------------------------------------------------------------------------------------

revoke execute on function public.partner_sessions, public.partner_roster, public.partner_waitlist, public.partner_check_in,
  public.partner_update_session, public.partner_add_session, public.partner_block_dates, public.partner_cancel_session, public.partner_set_repeat, public.partner_notes,
  public.partner_send_note, public.partner_assessments, public.partner_record_result, public.partner_check_vaccines,
  public.partner_save_class, public.partner_save_trainer, public.partner_save_location, public.partner_earnings, public.partner_earnings_by_class
  from public, anon;
grant execute on function public.partner_sessions, public.partner_roster, public.partner_waitlist, public.partner_check_in,
  public.partner_update_session, public.partner_add_session, public.partner_block_dates, public.partner_cancel_session, public.partner_set_repeat, public.partner_notes,
  public.partner_send_note, public.partner_assessments, public.partner_record_result, public.partner_check_vaccines,
  public.partner_save_class, public.partner_save_trainer, public.partner_save_location, public.partner_earnings, public.partner_earnings_by_class
  to authenticated;
