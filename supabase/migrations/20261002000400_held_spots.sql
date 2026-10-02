-- Held spots: the rest of a starting month (01j) for a dog that still needs its Social assessment.
-- A hold reserves the spot (spots_left goes down) but charges no credits. The member books held
-- sessions in one tap once the dog is cleared (Today › "Rest of Juno's month").
-- Holds release on their own 24 hours before the session, or when the assessment comes back
-- "not yet", so spots don't sit empty.

create type public.hold_status as enum ('held', 'booked', 'released');

create table public.held_spots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  status public.hold_status not null default 'held',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create unique index held_spots_one_live on public.held_spots (session_id, dog_id) where status = 'held';
create index on public.held_spots (member_id, status);

alter table public.held_spots enable row level security;
create policy "held_spots: read own" on public.held_spots for select to authenticated using (member_id = auth.uid());

-- Gives back the spot of every hold past its expiry. Called at the start of the hold and booking
-- functions, and every 15 minutes by pg_cron:
--   select cron.schedule('holds', '*/15 * * * *', 'select public.release_expired_holds()')
create function public.release_expired_holds()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with gone as (
    update public.held_spots set status = 'released', closed_at = now()
    where status = 'held' and expires_at <= now()
    returning session_id
  ), per as (select session_id, count(*) c from gone group by session_id)
  update public.sessions s set spots_left = s.spots_left + per.c from per where s.id = per.session_id;
  get diagnostics n = row_count;
  return n;
end $$;

-- Holds sessions for a dog. Social is the only rule a hold may skip; anything else that would stop
-- the booking (vaccines, Herding, full, already booked) fails the hold with the same reason code.
create function public.hold_sessions(p_dog uuid, p_sessions uuid[])
returns table (session_id uuid, hold_id uuid, error text)
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  sid uuid;
  s public.sessions;
  block text;
  h public.held_spots;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from public.dogs where id = p_dog and owner_id = me) then raise exception 'not_your_dog'; end if;
  perform public.release_expired_holds();
  foreach sid in array p_sessions loop
    session_id := sid; hold_id := null; error := null;
    select * into s from public.sessions where id = sid for update;
    if not found then
      error := 'not_found';
    else
      block := public.booking_block(p_dog, sid);
      if block is not null and block <> 'needs_social' then
        error := block;
      elsif s.starts_at - interval '24 hours' <= now() then
        error := 'too_soon';
      elsif exists (select 1 from public.bookings b where b.session_id = sid and b.dog_id = p_dog and b.status <> 'cancelled')
         or exists (select 1 from public.held_spots x where x.session_id = sid and x.dog_id = p_dog and x.status = 'held') then
        error := 'already_booked';
      elsif s.spots_left <= 0 then
        error := 'full';
      else
        update public.sessions set spots_left = spots_left - 1 where id = sid;
        insert into public.held_spots (session_id, dog_id, member_id, expires_at)
        values (sid, p_dog, me, s.starts_at - interval '24 hours') returning * into h;
        hold_id := h.id;
      end if;
    end if;
    return next;
  end loop;
end $$;

-- Books every live hold for a dog. Each one succeeds or fails on its own (for example, Social still
-- missing or not enough credits); failed holds stay held.
create function public.book_held(p_dog uuid)
returns table (session_id uuid, booking_id uuid, error text)
language plpgsql security definer set search_path = public as $$
declare
  h public.held_spots;
  b public.bookings;
begin
  perform public.release_expired_holds();
  for h in select * from public.held_spots where dog_id = p_dog and member_id = auth.uid() and status = 'held' order by expires_at loop
    begin
      b := public.book_session(h.session_id, p_dog);
      session_id := h.session_id; booking_id := b.id; error := null;
    exception when others then
      session_id := h.session_id; booking_id := null; error := sqlerrm;
    end;
    return next;
  end loop;
end $$;

-- Lets the member give held spots back (one, or all of a dog's).
create function public.release_holds(p_dog uuid, p_session uuid default null)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with gone as (
    update public.held_spots set status = 'released', closed_at = now()
    where dog_id = p_dog and member_id = auth.uid() and status = 'held' and (p_session is null or session_id = p_session)
    returning session_id
  ), per as (select session_id, count(*) c from gone group by session_id)
  update public.sessions s set spots_left = s.spots_left + per.c from per where s.id = per.session_id;
  get diagnostics n = row_count;
  return n;
end $$;

-- book_session: a dog booking a session it holds uses the held spot instead of taking another.
create or replace function public.book_session(p_session uuid, p_dog uuid)
returns public.bookings language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  s public.sessions;
  c public.class_types;
  p public.profiles;
  block text;
  b public.bookings;
  hold uuid;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from public.dogs where id = p_dog and owner_id = me) then raise exception 'not_your_dog'; end if;

  -- Lock the session and the member so two taps can't double-spend spots or credits.
  select * into s from public.sessions where id = p_session for update;
  if not found then raise exception 'not_found'; end if;
  select * into c from public.class_types where id = s.class_id;
  select * into p from public.profiles where id = me for update;
  select id into hold from public.held_spots
  where session_id = p_session and dog_id = p_dog and member_id = me and status = 'held' and expires_at > now();

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
  update public.profiles set credits_balance = credits_balance - c.credits where id = me;
  insert into public.bookings (session_id, dog_id, member_id, credits_charged)
  values (p_session, p_dog, me, c.credits) returning * into b;
  insert into public.credit_ledger (member_id, delta, reason, booking_id) values (me, -c.credits, 'booking', b.id);
  return b;
end $$;

-- record_assessment: a "not yet" releases the dog's held spots (it's going onto a training path instead).
create or replace function public.record_assessment(
  p_dog uuid, p_type public.clearance_type, p_partner text, p_assessor text, p_outcome public.assessment_outcome,
  p_strengths text[] default '{}', p_working text[] default '{}', p_quote text default null, p_booking uuid default null
) returns public.assessments language plpgsql security definer set search_path = public as $$
declare
  a public.assessments;
  owner uuid;
  dog_name text;
  released int;
begin
  select owner_id, name into owner, dog_name from public.dogs where id = p_dog;
  insert into public.assessments (dog_id, booking_id, type, partner_id, assessor, outcome, assessed_on, strengths, working_on, quote)
  values (p_dog, p_booking, p_type, p_partner, p_assessor, p_outcome, current_date, p_strengths, p_working, p_quote)
  returning * into a;

  if p_outcome = 'cleared' then
    insert into public.clearances (dog_id, type, scope, partner_id, assessed_on, expires_on, assessor, strengths, working_on, quote)
    values (p_dog, p_type, case when p_type = 'social' then 'network' else 'partner' end::public.clearance_scope,
            p_partner, current_date, (current_date + interval '1 year')::date, p_assessor, p_strengths, p_working, p_quote);
    update public.dog_paths dp set completed_at = now(), next_step = (select count(*) + 1 from public.path_steps ps where ps.path_id = dp.path_id)
    where dp.dog_id = p_dog and dp.completed_at is null
      and dp.path_id in (select id from public.training_paths where grants = p_type);
    insert into public.notifications (member_id, category, kind, title, body, href)
    values (owner, 'clearances', 'clearance_earned',
            dog_name || ' is ' || initcap(p_type::text) || ' cleared.',
            p_assessor || ' · ' || (select name from public.partners where id = p_partner),
            '/clearance-earned');
  elsif p_type = 'social' then
    with gone as (
      update public.held_spots set status = 'released', closed_at = now()
      where dog_id = p_dog and status = 'held' returning session_id
    ), per as (select session_id, count(*) c from gone group by session_id)
    update public.sessions s set spots_left = s.spots_left + per.c from per where s.id = per.session_id;
    get diagnostics released = row_count;
    if released > 0 then
      insert into public.notifications (member_id, category, kind, title, body, href)
      values (owner, 'bookings', 'holds_released', 'Held sessions released',
              dog_name || '''s Social assessment came back not yet, so the held group sessions went back to other members.', '/goal/calm-around-dogs');
    end if;
  end if;
  return a;
end $$;
revoke execute on function public.record_assessment from public, anon, authenticated;
revoke execute on function public.release_expired_holds from public, anon, authenticated;

revoke execute on function public.hold_sessions, public.book_held, public.release_holds from public, anon;
grant execute on function public.hold_sessions, public.book_held, public.release_holds to authenticated;
