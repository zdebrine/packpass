-- PackPass › Intake calls and 1:1 offers (v3 phase 4d, Pack Scheduling 23d to 23f).
--   * a specialist (any partner trainer) takes 15-minute intake calls for 0 credits. They paste a meeting link and
--     open times, or a Calendly link that does the scheduling. Members book from Book › Skills, by video or phone;
--     the meeting link goes out 10 minutes before (send_intake_links), never earlier.
--   * after the call the specialist offers the dog a 1:1 in the app: a session of one of their Private templates
--     that only that member can see (sessions.offered_member). The member books it for its credits or asks for
--     another time; an offer nobody answers expires and its session is cancelled (expire_private_offers).

-- ---- Specialists and their open times ----------------------------------------------------------------------

-- A trainer taking intake calls. The link stays private: members get it 10 minutes before a video call, or as the
-- place to book when it's a Calendly link.
create table public.intake_settings (
  trainer_id text primary key references public.trainers (id) on delete cascade,
  link text not null check (link ~ '^https://[^[:space:]]+$' and length(link) <= 500),
  -- One line on what the specialist helps with, e.g. "reactivity, new dogs".
  focus text check (length(focus) <= 80),
  phone boolean not null default true,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.intake_settings enable row level security;

create function public.is_calendly(p_link text) returns boolean
language sql immutable set search_path = public as $$
  select coalesce(p_link ~* '^https://([a-z0-9-]+\.)?calendly\.com/', false)
$$;

-- 15-minute openings a specialist adds (a Calendly specialist doesn't need any).
create table public.intake_slots (
  id uuid primary key default gen_random_uuid(),
  trainer_id text not null references public.trainers (id) on delete cascade,
  starts_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (trainer_id, starts_at)
);
alter table public.intake_slots enable row level security;

-- A booked call (or, with Calendly, a request that shares the dog's profile; starts_at is then null).
create table public.intake_calls (
  id uuid primary key default gen_random_uuid(),
  trainer_id text not null references public.trainers (id) on delete cascade,
  slot_id uuid references public.intake_slots (id) on delete set null,
  member_id uuid not null references public.profiles (id) on delete cascade,
  dog_id uuid not null references public.dogs (id) on delete cascade,
  starts_at timestamptz,
  mode text not null check (mode in ('video', 'phone', 'calendly')),
  phone text check (phone ~ '^\+?[0-9]{7,15}$'),
  status text not null default 'booked' check (status in ('booked', 'cancelled')),
  link_sent_at timestamptz,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);
create unique index intake_calls_one_per_slot on public.intake_calls (slot_id) where status = 'booked';
create index on public.intake_calls (trainer_id, starts_at);
create index on public.intake_calls (member_id);
alter table public.intake_calls enable row level security;
create policy "intake_calls: read own" on public.intake_calls for select to authenticated using (member_id = (select auth.uid()));
grant select on public.intake_calls to authenticated;

-- ---- 1:1 offers ---------------------------------------------------------------------------------------------

create table public.private_offers (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid references public.intake_calls (id) on delete set null,
  trainer_id text references public.trainers (id) on delete set null,
  member_id uuid not null references public.profiles (id) on delete cascade,
  dog_id uuid not null references public.dogs (id) on delete cascade,
  session_id uuid not null unique references public.sessions (id) on delete cascade,
  note text check (length(note) <= 280),
  status text not null default 'offered' check (status in ('offered', 'booked', 'other_time', 'expired')),
  expires_at timestamptz not null,
  booking_id uuid references public.bookings (id) on delete set null,
  -- clock_timestamp: several offers after one call stay in order even within a transaction.
  created_at timestamptz not null default clock_timestamp(),
  closed_at timestamptz
);
create index on public.private_offers (member_id);
create index on public.private_offers (intake_id);
alter table public.private_offers enable row level security;
create policy "private_offers: read own" on public.private_offers for select to authenticated using (member_id = (select auth.uid()));
grant select on public.private_offers to authenticated;

-- A session made for an offer is the offered member's alone: hidden from everyone else, so the only id anyone reads
-- in the column is their own (the app keeps these out of Book).
alter table public.sessions add column offered_member uuid references public.profiles (id) on delete cascade;
create policy "sessions: offered 1:1s for that member only" on public.sessions as restrictive for select to anon, authenticated
  using (offered_member is null or offered_member = (select auth.uid()));
grant select (offered_member) on public.sessions to anon, authenticated;

-- ---- The member's side ---------------------------------------------------------------------------------------

-- Specialists taking intake calls, with their open times over the next two weeks (at least an hour ahead).
create function public.intake_specialists()
returns table (trainer_id text, name text, credential text, photo_url text, partner_id text, partner_name text, focus text,
               phone boolean, calendly boolean, slots jsonb)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, t.credential, t.photo_url, pa.id, pa.name, i.focus, i.phone, public.is_calendly(i.link),
         coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'starts_at', s.starts_at) order by s.starts_at)
                   from public.intake_slots s
                   where s.trainer_id = t.id and s.starts_at > now() + interval '1 hour' and s.starts_at < now() + interval '14 days'
                     and not exists (select 1 from public.intake_calls c where c.slot_id = s.id and c.status = 'booked')), '[]')
  from public.intake_settings i
  join public.trainers t on t.id = i.trainer_id
  join public.partners pa on pa.id = t.partner_id
  where i.active
  order by t.name
$$;
revoke execute on function public.intake_specialists from public, anon;
grant execute on function public.intake_specialists to authenticated;

-- The member's calls (and Calendly requests) from the last 30 days on. The link shows for a Calendly request, and
-- for a video call from 10 minutes before it starts until 30 minutes after.
create function public.my_intake_calls()
returns table (id uuid, trainer_id text, trainer_name text, trainer_photo text, partner_name text, dog_id uuid,
               starts_at timestamptz, mode text, status text, link text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, t.id, t.name, t.photo_url, pa.name, c.dog_id, c.starts_at, c.mode, c.status,
         case when c.status = 'booked' and (c.mode = 'calendly'
                   or (c.mode = 'video' and now() >= c.starts_at - interval '10 minutes' and now() < c.starts_at + interval '30 minutes'))
              then i.link end,
         c.created_at
  from public.intake_calls c
  join public.trainers t on t.id = c.trainer_id
  join public.partners pa on pa.id = t.partner_id
  left join public.intake_settings i on i.trainer_id = c.trainer_id
  where c.member_id = (select auth.uid()) and coalesce(c.starts_at, c.created_at) > now() - interval '30 days'
  order by coalesce(c.starts_at, c.created_at) desc
$$;
revoke execute on function public.my_intake_calls from public, anon;
grant execute on function public.my_intake_calls to authenticated;

-- Books an open time for one dog, by video or phone (a phone call needs the member's number). One upcoming call
-- per dog with each specialist.
create function public.book_intake(p_slot uuid, p_dog uuid, p_mode text, p_phone text default null)
returns public.intake_calls language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  s public.intake_slots;
  i public.intake_settings;
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), '');
  r public.intake_calls;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from public.dogs where id = p_dog and owner_id = me) then raise exception 'not_your_dog'; end if;
  select * into s from public.intake_slots where id = p_slot for update;
  if not found then raise exception 'not_found'; end if;
  select * into i from public.intake_settings where trainer_id = s.trainer_id and active;
  if not found then raise exception 'not_found'; end if;
  if s.starts_at <= now() then raise exception 'started'; end if;
  if p_mode not in ('video', 'phone') or (p_mode = 'phone' and not i.phone) then raise exception 'bad_mode'; end if;
  if p_mode = 'phone' and (v_phone is null or v_phone !~ '^\+?[0-9]{7,15}$') then raise exception 'bad_phone'; end if;
  if exists (select 1 from public.intake_calls where slot_id = p_slot and status = 'booked') then raise exception 'full'; end if;
  if exists (select 1 from public.intake_calls where trainer_id = s.trainer_id and dog_id = p_dog and status = 'booked'
             and (starts_at > now() or (starts_at is null and created_at > now() - interval '14 days'))) then
    raise exception 'already_booked';
  end if;
  insert into public.intake_calls (trainer_id, slot_id, member_id, dog_id, starts_at, mode, phone)
  values (s.trainer_id, p_slot, me, p_dog, s.starts_at, p_mode, case when p_mode = 'phone' then v_phone end)
  returning * into r;
  return r;
end $$;
revoke execute on function public.book_intake from public, anon;
grant execute on function public.book_intake to authenticated;

-- A Calendly specialist: the member books on Calendly, and this shares the dog's profile so the specialist can
-- offer a 1:1 after. Returns the link. Asking again within two weeks returns the same request.
create function public.request_intake(p_trainer text, p_dog uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  i public.intake_settings;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from public.dogs where id = p_dog and owner_id = me) then raise exception 'not_your_dog'; end if;
  select * into i from public.intake_settings where trainer_id = p_trainer and active;
  if not found or not public.is_calendly(i.link) then raise exception 'not_found'; end if;
  if not exists (select 1 from public.intake_calls where trainer_id = p_trainer and dog_id = p_dog and mode = 'calendly'
                 and status = 'booked' and created_at > now() - interval '14 days') then
    insert into public.intake_calls (trainer_id, member_id, dog_id, mode) values (p_trainer, me, p_dog, 'calendly');
  end if;
  return i.link;
end $$;
revoke execute on function public.request_intake from public, anon;
grant execute on function public.request_intake to authenticated;

-- Free cancel any time before the call; the open time goes back on the list.
create function public.cancel_intake(p_call uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.intake_calls set status = 'cancelled', cancelled_at = now()
  where id = p_call and member_id = auth.uid() and status = 'booked' and (starts_at is null or starts_at > now());
  if not found then raise exception 'not_found'; end if;
end $$;
revoke execute on function public.cancel_intake from public, anon;
grant execute on function public.cancel_intake to authenticated;

-- The member's 1:1 offers from the last 30 days, with what the offer screen shows.
create function public.my_private_offers()
returns table (id uuid, dog_id uuid, session_id uuid, class_id text, title text, starts_at timestamptz, duration_min int,
               credits int, cancel_hours int, partner_name text, trainer_name text, trainer_photo text, note text, status text,
               expires_at timestamptz, booking_id uuid)
language sql stable security definer set search_path = public as $$
  select o.id, o.dog_id, s.id, c.id, c.title, s.starts_at, c.duration_min, c.credits, c.cancel_hours, pa.name, t.name, t.photo_url,
         o.note, case when o.status = 'offered' and o.expires_at <= now() then 'expired' else o.status end, o.expires_at, o.booking_id
  from public.private_offers o
  join public.sessions s on s.id = o.session_id
  join public.class_types c on c.id = s.class_id
  join public.partners pa on pa.id = c.partner_id
  left join public.trainers t on t.id = o.trainer_id
  where o.member_id = (select auth.uid()) and o.created_at > now() - interval '30 days'
  order by o.created_at desc
$$;
revoke execute on function public.my_private_offers from public, anon;
grant execute on function public.my_private_offers to authenticated;

-- Books the offered 1:1 (the same checks and errors as book_session) or asks for another time, which cancels the
-- offered session so the specialist can offer a new one.
create function public.answer_private_offer(p_offer uuid, p_book boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  o public.private_offers;
  b public.bookings;
begin
  select * into o from public.private_offers where id = p_offer and member_id = auth.uid() for update;
  if not found then raise exception 'not_found'; end if;
  if o.status <> 'offered' then raise exception 'offer_closed'; end if;
  if o.expires_at <= now() then raise exception 'offer_expired'; end if;
  if p_book then
    b := public.book_session(o.session_id, o.dog_id); -- bookings_close_offer marks the offer booked
    return b.id;
  end if;
  update public.private_offers set status = 'other_time', closed_at = now() where id = p_offer;
  update public.sessions set cancelled_at = now(), cancel_reason = 'Owner asked for another time'
  where id = o.session_id and cancelled_at is null
    and not exists (select 1 from public.bookings where session_id = o.session_id and status <> 'cancelled');
  return null;
end $$;
revoke execute on function public.answer_private_offer from public, anon;
grant execute on function public.answer_private_offer to authenticated;

-- Booking the offered session from the booking sheet closes the offer as booked.
create function public.bookings_close_offer() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.private_offers set status = 'booked', booking_id = new.id, closed_at = now()
  where session_id = new.session_id and member_id = new.member_id and status = 'offered';
  return new;
end $$;
create trigger bookings_close_offer after insert on public.bookings
for each row execute function public.bookings_close_offer();

-- ---- The partner's side --------------------------------------------------------------------------------------

-- Each of the partner's trainers and how they take intake calls (null link: not set up).
create function public.partner_intake_settings()
returns table (trainer_id text, name text, link text, focus text, phone boolean, active boolean, calendly boolean)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, i.link, i.focus, coalesce(i.phone, true), coalesce(i.active, false), public.is_calendly(i.link)
  from public.trainers t left join public.intake_settings i on i.trainer_id = t.id
  where t.partner_id = public.staff_partner()
  order by t.name
$$;

-- Saves a trainer's intake settings (any staff, the same rule as partner_save_trainer).
create function public.partner_save_intake(p_trainer text, p_link text, p_focus text, p_phone boolean, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_link text := trim(coalesce(p_link, ''));
  v_focus text := nullif(trim(coalesce(p_focus, '')), '');
begin
  if not exists (select 1 from public.trainers where id = p_trainer and partner_id = public.staff_partner()) then raise exception 'not_found'; end if;
  if v_link !~ '^https://[^[:space:]]+$' or length(v_link) > 500 then raise exception 'bad_link'; end if;
  if length(v_focus) > 80 then raise exception 'bad_focus'; end if;
  insert into public.intake_settings (trainer_id, link, focus, phone, active)
  values (p_trainer, v_link, v_focus, coalesce(p_phone, true), coalesce(p_active, true))
  on conflict (trainer_id) do update set link = excluded.link, focus = excluded.focus, phone = excluded.phone,
    active = excluded.active, updated_at = now();
end $$;

-- Adds open times for a trainer (past times and duplicates are skipped). Returns how many were added.
create function public.partner_add_intake_slots(p_trainer text, p_starts timestamptz[])
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not exists (select 1 from public.trainers where id = p_trainer and partner_id = public.staff_partner()) then raise exception 'not_found'; end if;
  if cardinality(p_starts) > 40 then raise exception 'too_many'; end if;
  insert into public.intake_slots (trainer_id, starts_at)
  select p_trainer, x from unnest(p_starts) x where x > now()
  on conflict (trainer_id, starts_at) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- Removes an open time nobody has booked.
create function public.partner_remove_intake_slot(p_slot uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.intake_calls where slot_id = p_slot and status = 'booked') then raise exception 'booked'; end if;
  delete from public.intake_slots s using public.trainers t
  where s.id = p_slot and t.id = s.trainer_id and t.partner_id = public.staff_partner();
  if not found then raise exception 'not_found'; end if;
end $$;

-- Upcoming open times for the partner's trainers, booked or not.
create function public.partner_intake_slots()
returns table (id uuid, trainer_id text, starts_at timestamptz, booked boolean)
language sql stable security definer set search_path = public as $$
  select s.id, s.trainer_id, s.starts_at, exists (select 1 from public.intake_calls c where c.slot_id = s.id and c.status = 'booked')
  from public.intake_slots s join public.trainers t on t.id = s.trainer_id
  where t.partner_id = public.staff_partner() and s.starts_at > now() - interval '15 minutes'
  order by s.starts_at
$$;

-- Calls with the partner's trainers from two weeks back on, with the dog's profile, its last three trainer notes,
-- and the latest 1:1 offered after the call.
create function public.partner_intake_calls()
returns table (id uuid, trainer_id text, trainer_name text, starts_at timestamptz, mode text, phone text, status text, created_at timestamptz,
               dog_id uuid, dog_name text, breed text, photo_path text, energy public.energy_level, sociability public.sociability, traits text[],
               owner_name text, notes text[], offer_id uuid, offer_status text, offer_title text, offer_starts_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, t.id, t.name, c.starts_at, c.mode, c.phone, c.status, c.created_at,
         d.id, d.name, d.breed, d.photo_path, d.energy, d.sociability, d.traits, p.name,
         array(select n.note from public.session_notes n join public.bookings bb on bb.id = n.booking_id
               where bb.dog_id = d.id order by n.created_at desc limit 3),
         o.id, case when o.status = 'offered' and o.expires_at <= now() then 'expired' else o.status end, oc.title, os.starts_at
  from public.intake_calls c
  join public.trainers t on t.id = c.trainer_id
  join public.dogs d on d.id = c.dog_id
  join public.profiles p on p.id = c.member_id
  left join lateral (select * from public.private_offers x where x.intake_id = c.id order by x.created_at desc limit 1) o on true
  left join public.sessions os on os.id = o.session_id
  left join public.class_types oc on oc.id = os.class_id
  where t.partner_id = public.staff_partner() and coalesce(c.starts_at, c.created_at) > now() - interval '14 days'
  order by c.status = 'cancelled', coalesce(c.starts_at, c.created_at)
$$;

-- Offers the dog from an intake call a 1:1: a new session of one of the partner's Private templates, seen only by
-- that member. Open for two days, and never past two hours before it starts.
create function public.partner_offer_private(p_call uuid, p_class text, p_starts_at timestamptz, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me text := public.staff_partner();
  r record;
  c public.class_types;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  sid uuid;
  oid uuid;
  v_until timestamptz;
begin
  select ic.id, ic.trainer_id, ic.member_id, ic.dog_id, ic.status, d.name dog_name into r
  from public.intake_calls ic join public.trainers t on t.id = ic.trainer_id join public.dogs d on d.id = ic.dog_id
  where ic.id = p_call and t.partner_id = me;
  if not found or r.status <> 'booked' then raise exception 'not_found'; end if;
  select * into c from public.class_types where id = p_class and partner_id = me;
  if not found or c.session_type <> 'private' then raise exception 'not_private'; end if;
  if c.archived_at is not null then raise exception 'archived'; end if;
  if c.status <> 'live' then raise exception 'not_live'; end if;
  if p_starts_at < now() + interval '3 hours' then raise exception 'too_soon'; end if;
  if length(v_note) > 280 then raise exception 'bad_note'; end if;
  if exists (select 1 from public.private_offers where intake_id = p_call and status = 'offered' and expires_at > now()) then
    raise exception 'already_offered';
  end if;
  v_until := least(now() + interval '2 days', p_starts_at - interval '2 hours');
  insert into public.sessions (class_id, starts_at, capacity, packpass_spots, spots_left, auto_promote, waitlist_open, offered_member, min_checked_at)
  values (p_class, p_starts_at, 1, 1, 1, false, false, r.member_id, now()) returning id into sid;
  insert into public.private_offers (intake_id, trainer_id, member_id, dog_id, session_id, note, expires_at)
  values (p_call, coalesce(c.trainer_id, r.trainer_id), r.member_id, r.dog_id, sid, v_note, v_until) returning id into oid;
  insert into public.notifications (member_id, category, kind, title, body, href, session_id)
  values (r.member_id, 'bookings', 'private_offer',
          coalesce((select split_part(name, ' ', 1) from public.trainers where id = r.trainer_id), 'Your specialist') || ' offered ' || r.dog_name || ' a 1:1.',
          c.title || ', ' || to_char(p_starts_at at time zone 'America/Chicago', 'FMDy FMHH12:MI am') || ' · '
            || c.credits || case when c.credits = 1 then ' credit' else ' credits' end
            || '. Book by ' || to_char(v_until at time zone 'America/Chicago', 'FMDy FMHH12:MI am') || '.',
          public.dog_href('/offer/' || oid, r.dog_id), sid);
  return oid;
end $$;

revoke execute on function public.partner_intake_settings, public.partner_save_intake, public.partner_add_intake_slots,
  public.partner_remove_intake_slot, public.partner_intake_slots, public.partner_intake_calls, public.partner_offer_private from public, anon;
grant execute on function public.partner_intake_settings, public.partner_save_intake, public.partner_add_intake_slots,
  public.partner_remove_intake_slot, public.partner_intake_slots, public.partner_intake_calls, public.partner_offer_private to authenticated;

-- ---- Jobs ---------------------------------------------------------------------------------------------------

-- The meeting link, 10 minutes before each video call (every 5 minutes). Phone calls get a heads-up instead.
create function public.send_intake_links()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with due as (
    update public.intake_calls c set link_sent_at = now()
    where c.status = 'booked' and c.mode in ('video', 'phone') and c.link_sent_at is null
      and c.starts_at > now() and c.starts_at <= now() + interval '10 minutes'
    returning c.*
  )
  insert into public.notifications (member_id, category, kind, title, body, href)
  select d.member_id, 'bookings', 'intake_link',
         'Your call with ' || split_part(t.name, ' ', 1) || ' starts at ' || to_char(d.starts_at at time zone 'America/Chicago', 'FMHH12:MI am') || '.',
         case when d.mode = 'phone' then split_part(t.name, ' ', 1) || ' calls you on the number you gave.'
              else 'Join from Pack, or open the link: ' || coalesce(i.link, '') end,
         public.dog_href('/intake/' || d.trainer_id, d.dog_id)
  from due d join public.trainers t on t.id = d.trainer_id left join public.intake_settings i on i.trainer_id = d.trainer_id;
  get diagnostics n = row_count;
  return n;
end $$;

-- Offers nobody answered: closed, and their sessions cancelled (every 15 minutes).
create function public.expire_private_offers()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with gone as (
    update public.private_offers set status = 'expired', closed_at = now()
    where status = 'offered' and expires_at <= now()
    returning session_id
  )
  update public.sessions s set cancelled_at = now(), cancel_reason = '1:1 offer expired'
  from gone where s.id = gone.session_id and s.cancelled_at is null
    and not exists (select 1 from public.bookings b where b.session_id = s.id and b.status <> 'cancelled');
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.send_intake_links, public.expire_private_offers from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('intake-links', '*/5 * * * *', 'select public.send_intake_links()');
    perform cron.schedule('expire-private-offers', '*/15 * * * *', 'select public.expire_private_offers()');
  end if;
end $$;
