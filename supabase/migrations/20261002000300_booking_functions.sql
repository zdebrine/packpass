-- Booking rules. Clients call these through supabase.rpc(); they're the only way to move
-- credits, spots or booking status. Errors are raised with a short code as the message
-- (see apps/member/src/api/errors.ts for the copy each code maps to).

-- ---- Eligibility ---------------------------------------------------------------------------

-- A clearance counts if it hasn't expired by `on_day` and, for partner-scoped ones (Herding),
-- was issued by the partner running the class.
create function public.has_clearance(p_dog uuid, p_type public.clearance_type, p_partner text, p_on date)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.clearances c
    where c.dog_id = p_dog and c.type = p_type
      and (c.expires_on is null or c.expires_on >= p_on)
      and (c.scope = 'network' or c.partner_id = p_partner)
  )
$$;

-- Is this class a step on a training path the dog is still working through?
-- Path sessions stay bookable without Social, so the dog can earn it.
create function public.on_active_path(p_dog uuid, p_class text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.dog_paths dp
    join public.path_steps ps on ps.path_id = dp.path_id
    where dp.dog_id = p_dog and dp.completed_at is null and ps.class_id = p_class
  )
$$;

-- Null when the dog can book the session, otherwise a reason code:
--   needs_herding · needs_social · vaccines · started
create function public.booking_block(p_dog uuid, p_session uuid)
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

  if s.starts_at <= now() then return 'started'; end if;
  if c.requires = 'herding' and not public.has_clearance(p_dog, 'herding', c.partner_id, on_day) then
    return 'needs_herding';
  end if;
  -- Group classes need Social, unless the class is a step on the dog's own path.
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

-- ---- Booking -------------------------------------------------------------------------------

create function public.book_session(p_session uuid, p_dog uuid)
returns public.bookings language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  s public.sessions;
  c public.class_types;
  p public.profiles;
  block text;
  b public.bookings;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from public.dogs where id = p_dog and owner_id = me) then raise exception 'not_your_dog'; end if;

  -- Lock the session and the member so two taps can't double-spend spots or credits.
  select * into s from public.sessions where id = p_session for update;
  if not found then raise exception 'not_found'; end if;
  select * into c from public.class_types where id = s.class_id;
  select * into p from public.profiles where id = me for update;

  block := public.booking_block(p_dog, p_session);
  if block is not null then raise exception '%', block; end if;
  if exists (select 1 from public.bookings where session_id = p_session and dog_id = p_dog and status <> 'cancelled') then
    raise exception 'already_booked';
  end if;
  if s.spots_left <= 0 then raise exception 'full'; end if;
  if p.credits_balance < c.credits then raise exception 'credits'; end if;

  update public.sessions set spots_left = spots_left - 1 where id = p_session;
  update public.profiles set credits_balance = credits_balance - c.credits where id = me;
  insert into public.bookings (session_id, dog_id, member_id, credits_charged)
  values (p_session, p_dog, me, c.credits) returning * into b;
  insert into public.credit_ledger (member_id, delta, reason, booking_id) values (me, -c.credits, 'booking', b.id);
  return b;
end $$;

-- Free cancellation up to 12 hours before; later cancels keep the credits (paid to the partner).
create function public.cancel_booking(p_booking uuid)
returns public.bookings language plpgsql security definer set search_path = public as $$
declare
  b public.bookings;
  s public.sessions;
begin
  select * into b from public.bookings where id = p_booking and member_id = auth.uid() for update;
  if not found then raise exception 'not_found'; end if;
  if b.status <> 'booked' then raise exception 'not_cancellable'; end if;
  select * into s from public.sessions where id = b.session_id for update;

  update public.bookings set status = 'cancelled', cancelled_at = now() where id = p_booking returning * into b;
  update public.sessions set spots_left = spots_left + 1 where id = s.id;
  if s.starts_at - now() >= interval '12 hours' then
    update public.profiles set credits_balance = credits_balance + b.credits_charged where id = b.member_id;
    insert into public.credit_ledger (member_id, delta, reason, booking_id) values (b.member_id, b.credits_charged, 'refund', b.id);
  end if;
  return b;
end $$;

-- Books several sessions for one dog (01j "Book these"). Each one succeeds or fails on its
-- own; the result says which, with the same reason codes as book_session.
create function public.book_sessions(p_dog uuid, p_sessions uuid[])
returns table (session_id uuid, booking_id uuid, error text)
language plpgsql security definer set search_path = public as $$
declare
  sid uuid;
  b public.bookings;
begin
  foreach sid in array p_sessions loop
    begin
      b := public.book_session(sid, p_dog);
      session_id := sid; booking_id := b.id; error := null;
    exception when others then
      session_id := sid; booking_id := null; error := sqlerrm;
    end;
    return next;
  end loop;
end $$;

-- ---- Check-in ------------------------------------------------------------------------------

-- The partner's QR encodes "packpass:checkin:<session id>:<code>"; the 4-digit code is the
-- fallback. Check-in opens 60 minutes before the start and closes when the session ends.
create function public.check_in(p_booking uuid, p_code text)
returns public.bookings language plpgsql security definer set search_path = public as $$
declare
  b public.bookings;
  s public.sessions;
  c public.class_types;
  code text := p_code;
begin
  select * into b from public.bookings where id = p_booking and member_id = auth.uid() for update;
  if not found then raise exception 'not_found'; end if;
  if b.status = 'checked_in' then return b; end if;
  if b.status <> 'booked' then raise exception 'not_booked'; end if;
  select * into s from public.sessions where id = b.session_id;
  select * into c from public.class_types where id = s.class_id;

  if code like 'packpass:checkin:%' then
    if split_part(code, ':', 3) <> s.id::text then raise exception 'wrong_session'; end if;
    code := split_part(code, ':', 4);
  end if;
  if code is distinct from s.check_in_code then raise exception 'wrong_code'; end if;
  if now() < s.starts_at - interval '60 minutes' then raise exception 'too_early'; end if;
  if now() > s.starts_at + make_interval(mins => c.duration_min) then raise exception 'too_late'; end if;

  update public.bookings set status = 'checked_in', checked_in_at = now() where id = p_booking returning * into b;
  return b;
end $$;

-- ---- Passport and notifications ------------------------------------------------------------

-- Opening screen 13 marks the clearance as seen; until then the app shows "Working on it".
create function public.see_clearance(p_clearance uuid)
returns void language sql security definer set search_path = public as $$
  update public.clearances set seen_at = coalesce(seen_at, now())
  where id = p_clearance and public.owns_dog(dog_id)
$$;

create function public.mark_notifications_read(p_ids uuid[] default null)
returns void language sql security definer set search_path = public as $$
  update public.notifications set read_at = now()
  where member_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids))
$$;

create function public.start_path(p_dog uuid, p_path text)
returns public.dog_paths language plpgsql security definer set search_path = public as $$
declare dp public.dog_paths;
begin
  if not public.owns_dog(p_dog) then raise exception 'not_your_dog'; end if;
  insert into public.dog_paths (dog_id, path_id) values (p_dog, p_path)
  on conflict (dog_id, path_id) do update set path_id = excluded.path_id
  returning * into dp;
  return dp;
end $$;

-- ---- Partner side (service role) -----------------------------------------------------------

-- Called by the partner dashboard after an assessment. A pass grants the clearance, completes
-- any path that ends in it, and notifies the owner.
create function public.record_assessment(
  p_dog uuid, p_type public.clearance_type, p_partner text, p_assessor text, p_outcome public.assessment_outcome,
  p_strengths text[] default '{}', p_working text[] default '{}', p_quote text default null, p_booking uuid default null
) returns public.assessments language plpgsql security definer set search_path = public as $$
declare
  a public.assessments;
  owner uuid;
  dog_name text;
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
  end if;
  return a;
end $$;
revoke execute on function public.record_assessment from public, anon, authenticated;

-- Monthly credits (run daily with pg_cron: select cron.schedule('credits', '5 0 * * *', 'select public.grant_monthly_credits()')).
-- Unused credits roll over one month, capped at one month of credits (pivot spec).
create function public.grant_monthly_credits()
returns int language plpgsql security definer set search_path = public as $$
declare
  r public.profiles;
  n int := 0;
  plan_n int;
  kept int;
begin
  for r in select * from public.profiles where credits_reset_on <= current_date for update loop
    plan_n := public.plan_credits(r.plan);
    kept := least(r.credits_balance, plan_n);
    if kept < r.credits_balance then
      insert into public.credit_ledger (member_id, delta, reason) values (r.id, kept - r.credits_balance, 'adjustment');
    end if;
    insert into public.credit_ledger (member_id, delta, reason) values (r.id, plan_n, 'monthly_grant');
    update public.profiles
    set credits_balance = kept + plan_n,
        credits_reset_on = (date_trunc('month', current_date) + interval '1 month')::date
    where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.grant_monthly_credits from public, anon, authenticated;

-- Booking notifications for the member.
create function public.notify_booking() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t text;
  s public.sessions;
begin
  select * into s from public.sessions where id = new.session_id;
  select title into t from public.class_types where id = s.class_id;
  insert into public.notifications (member_id, category, kind, title, body, href)
  values (new.member_id, 'bookings', 'booked', 'Booked. ' || t,
          to_char(s.starts_at at time zone 'America/Chicago', 'FMDay FMHH12:MI am') || ' · ' || new.credits_charged
            || case when new.credits_charged = 1 then ' credit' else ' credits' end,
          '/class/' || new.session_id);
  return new;
end $$;
create trigger bookings_notify after insert on public.bookings for each row execute function public.notify_booking();

-- Functions callable by signed-in members.
revoke execute on function public.book_session, public.cancel_booking, public.book_sessions, public.check_in,
  public.see_clearance, public.mark_notifications_read, public.start_path, public.booking_block from public, anon;
grant execute on function public.book_session, public.cancel_booking, public.book_sessions, public.check_in,
  public.see_clearance, public.mark_notifications_read, public.start_path, public.booking_block to authenticated;
