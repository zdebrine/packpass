-- PackPass › Minimum enrollment and the free cancel window (v3 phase 4b, Pack Partner Scheduling 10b).
--   * a template can set a minimum number of dogs and a cutoff: below the minimum at the cutoff, the session
--     cancels on its own, members get their credits back and a notification, and the schedule marks it
--     Cancelled (low enrollment)
--   * Run it anyway: before the cutoff it keeps the session whatever the count; after a low-enrollment cancel it
--     brings the session back and re-books the dogs that were on it
--   * the free cancel window is the template's (it was 12 hours everywhere). A late cancellation pays the partner
--     unless its credits were refunded.

alter table public.class_types
  -- Fewest dogs the session runs with; null means it always runs.
  add column min_dogs int check (min_dogs between 1 and 40),
  -- How many hours before the start the minimum is checked.
  add column min_cutoff_hours int not null default 12 check (min_cutoff_hours between 1 and 72),
  -- Members cancel free until this many hours before the start.
  add column cancel_hours int not null default 12 check (cancel_hours between 1 and 72);

alter table public.sessions
  add column created_at timestamptz not null default now(),
  -- Set once the minimum was checked at the cutoff (or the session was told to run).
  add column min_checked_at timestamptz,
  add column run_anyway_at timestamptz,
  -- Set when the session was cancelled for low enrollment, until it's run anyway.
  add column low_enrollment_at timestamptz;

-- When free cancellation ends for a session.
create function public.free_cancel_until(p_session uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select s.starts_at - make_interval(hours => c.cancel_hours)
  from public.sessions s join public.class_types c on c.id = s.class_id where s.id = p_session
$$;
grant execute on function public.free_cancel_until to anon, authenticated;

-- ---- Minimum enrollment ----------------------------------------------------------------------------------------

-- Runs every 15 minutes: each session whose cutoff has passed is checked once. Below the minimum it's cancelled
-- with refunds (cancel_session_for_partner); otherwise it runs. Sessions added after their cutoff aren't checked.
create function public.enforce_minimums()
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select s.id, c.min_dogs,
           (select count(*) from public.bookings b where b.session_id = s.id and b.status in ('booked', 'checked_in'))::int booked
    from public.sessions s join public.class_types c on c.id = s.class_id
    where c.min_dogs is not null and s.cancelled_at is null and s.min_checked_at is null and s.run_anyway_at is null
      and s.starts_at > now() and s.starts_at - make_interval(hours => c.min_cutoff_hours) <= now()
      and s.created_at <= s.starts_at - make_interval(hours => c.min_cutoff_hours)
    for update of s skip locked
  loop
    if r.booked < r.min_dogs then
      perform public.cancel_session_for_partner(r.id, 'Not enough dogs signed up', null);
      update public.sessions set low_enrollment_at = cancelled_at, min_checked_at = now() where id = r.id;
      n := n + 1;
    else
      update public.sessions set min_checked_at = now() where id = r.id;
    end if;
  end loop;
  return n;
end $$;
revoke execute on function public.enforce_minimums from public, anon, authenticated;

-- Template enrollment rules. Setting them never cancels a session whose cutoff has already passed.
create function public.partner_set_class_enrollment(p_class text, p_min int, p_cutoff int, p_cancel int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_min is not null and (p_min < 1 or p_min > (select group_size from public.class_types where id = p_class)) then raise exception 'bad_min'; end if;
  if p_cutoff not between 1 and 72 or p_cancel not between 1 and 72 then raise exception 'bad_hours'; end if;
  update public.class_types set min_dogs = p_min, min_cutoff_hours = p_cutoff, cancel_hours = p_cancel
  where id = p_class and partner_id = public.staff_partner();
  if not found then raise exception 'not_found'; end if;
  update public.sessions set min_checked_at = now()
  where class_id = p_class and min_checked_at is null and cancelled_at is null and starts_at > now()
    and starts_at - make_interval(hours => p_cutoff) <= now();
end $$;
revoke execute on function public.partner_set_class_enrollment from public, anon;
grant execute on function public.partner_set_class_enrollment to authenticated;

-- Run it anyway. Before the cutoff, the session runs whatever the count. After a low-enrollment cancel, it's back
-- on and the dogs that were booked are booked again (their credits are taken again); a dog that can't be booked
-- now (credits, vaccines) is told so. Returns how many dogs were re-booked.
create function public.partner_run_anyway(p_session uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  s record;
  b record;
  nb public.bookings;
  n int := 0;
begin
  select ss.*, c.title, pa.name pname into s
  from public.sessions ss join public.class_types c on c.id = ss.class_id join public.partners pa on pa.id = c.partner_id
  where ss.id = p_session and c.partner_id = public.staff_partner() for update of ss;
  if not found then raise exception 'not_found'; end if;
  if s.starts_at <= now() then raise exception 'started'; end if;
  if s.cancelled_at is null then
    update public.sessions set run_anyway_at = coalesce(run_anyway_at, now()) where id = p_session;
    return 0;
  end if;
  if s.low_enrollment_at is null then raise exception 'not_low_enrollment'; end if;

  update public.sessions set cancelled_at = null, cancel_reason = null, low_enrollment_at = null, run_anyway_at = now(),
    spots_left = least(packpass_spots, spots_left + (select count(*) from public.bookings x where x.session_id = p_session
                                                       and x.status = 'cancelled' and x.cancelled_at = s.cancelled_at))
  where id = p_session;
  for b in select x.member_id, x.dog_id, (select d.name from public.dogs d where d.id = x.dog_id) dog_name
           from public.bookings x where x.session_id = p_session and x.status = 'cancelled' and x.cancelled_at = s.cancelled_at loop
    begin
      nb := public.book_as(b.member_id, p_session, b.dog_id);
      insert into public.notifications (member_id, category, kind, title, body, href)
      values (b.member_id, 'bookings', 'session_back_on', s.title || ' is back on',
              to_char(s.starts_at at time zone 'America/Chicago', 'FMDay FMMon FMDD, FMHH12:MI am') || ' at ' || s.pname || '. '
                || b.dog_name || ' is booked again for ' || nb.credits_charged || case when nb.credits_charged = 1 then ' credit.' else ' credits.' end,
              public.dog_href('/class/' || p_session, b.dog_id));
      n := n + 1;
    exception when others then
      insert into public.notifications (member_id, category, kind, title, body, href)
      values (b.member_id, 'bookings', 'session_back_on', s.title || ' is back on',
              to_char(s.starts_at at time zone 'America/Chicago', 'FMDay FMMon FMDD, FMHH12:MI am') || ' at ' || s.pname
                || '. We couldn''t book ' || b.dog_name || ' again (' || case sqlerrm when 'credits' then 'not enough credits'
                   when 'vaccines' then 'vaccines need updating' else 'it can''t be booked right now' end || '). Book it from the class if you still want the spot.',
              public.dog_href('/class/' || p_session, b.dog_id));
    end;
  end loop;
  return n;
end $$;
revoke execute on function public.partner_run_anyway from public, anon;
grant execute on function public.partner_run_anyway to authenticated;

-- Enrollment state of the partner's sessions, alongside partner_sessions.
create function public.partner_enrollment(p_from timestamptz, p_to timestamptz)
returns table (session_id uuid, min_checked_at timestamptz, run_anyway_at timestamptz, low_enrollment_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.id, s.min_checked_at, s.run_anyway_at, s.low_enrollment_at
  from public.sessions s join public.class_types c on c.id = s.class_id
  where c.partner_id = public.staff_partner() and s.starts_at >= p_from and s.starts_at < p_to
$$;
revoke execute on function public.partner_enrollment from public, anon;
grant execute on function public.partner_enrollment to authenticated;

-- ---- The template's free cancel window, where it was 12 hours ----------------------------------------------------


create or replace function public.cancel_booking(p_booking uuid)
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
  if now() <= public.free_cancel_until(s.id) then
    update public.profiles set credits_balance = credits_balance + b.credits_charged where id = b.member_id;
    insert into public.credit_ledger (member_id, delta, reason, booking_id) values (b.member_id, b.credits_charged, 'refund', b.id);
  end if;
  return b;
end $$;

create or replace function public.end_series(p_series uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  b record;
  n int := 0;
begin
  update public.booking_series set ended_at = now() where id = p_series and member_id = auth.uid() and ended_at is null;
  if not found then raise exception 'not_found'; end if;
  for b in select x.id from public.bookings x join public.sessions s on s.id = x.session_id
           where x.series_id = p_series and x.status = 'booked' and public.free_cancel_until(s.id) > now() loop
    perform public.cancel_booking(b.id);
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.booking_rules(p_session uuid, p_dog uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when c.drop_off then 'Drop-off: leave ' || d.name || ' with the trainer.' else 'You stay with ' || d.name || '.' end
         || case when public.free_cancel_until(s.id) > now() then ' Free cancel until ' || public.day_time(public.free_cancel_until(s.id)) || '.'
                 else ' Free cancel closed ' || public.day_time(public.free_cancel_until(s.id)) || '.' end
  from public.sessions s join public.class_types c on c.id = s.class_id, public.dogs d
  where s.id = p_session and d.id = p_dog
$$;

create or replace function public.fill_from_waitlist(p_session uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  s public.sessions;
  c public.class_types;
  t text;
  w public.waitlist;
  b public.bookings;
  block text;
  until timestamptz;
  n int := 0;
begin
  select * into s from public.sessions where id = p_session;
  select * into c from public.class_types where id = s.class_id;
  t := c.title;
  if s.starts_at <= now() or s.cancelled_at is not null then return 0; end if;

  if not s.auto_promote then
    with told as (
      update public.waitlist set alerted_at = now()
      where session_id = p_session and status = 'waiting' and alerted_at is null
      returning member_id, dog_id
    )
    insert into public.notifications (member_id, category, kind, title, body, href)
    select distinct on (member_id, dog_id) member_id, 'bookings'::public.notification_category, 'waitlist_open', 'A spot opened. ' || t,
           to_char(s.starts_at at time zone 'America/Chicago', 'FMDay FMHH12:MI am') || '. First to book it gets it.',
           public.dog_href('/class/' || p_session, dog_id)
    from told;
    return 0;
  end if;

  -- Inside the free cancel window: hold each open spot for the next dog in line for 2 hours (no later than the start).
  if now() > public.free_cancel_until(p_session) then
    loop
      select spots_left into s.spots_left from public.sessions where id = p_session;
      exit when s.spots_left <= 0;
      select * into w from public.waitlist where session_id = p_session and status = 'waiting' order by created_at limit 1 for update;
      exit when not found;
      block := coalesce(public.booking_block(w.dog_id, p_session),
                        case when (select credits_balance from public.profiles where id = w.member_id) < c.credits then 'credits' end);
      if block is not null then
        update public.waitlist set status = 'missed', closed_at = now(), missed_reason = block where id = w.id;
        insert into public.notifications (member_id, category, kind, title, body, href)
        values (w.member_id, 'bookings', 'waitlist_missed', 'A spot opened, but we couldn''t offer it',
                t || ': ' || case block when 'credits' then 'not enough credits.' when 'vaccines' then 'vaccines need updating for that day.'
                                        when 'needs_social' then 'it needs a Social clearance.' else 'it can''t be booked right now.' end,
                public.dog_href('/class/' || p_session, w.dog_id));
        continue;
      end if;
      until := least(now() + interval '2 hours', s.starts_at);
      update public.sessions set spots_left = spots_left - 1 where id = p_session;
      update public.waitlist set status = 'offered', offer_expires_at = until where id = w.id;
      insert into public.notifications (member_id, category, kind, title, body, href)
      values (w.member_id, 'bookings', 'waitlist_offer', 'A spot opened. Accept by ' || to_char(until at time zone 'America/Chicago', 'FMHH12:MI am') || '.',
              t || ', ' || to_char(s.starts_at at time zone 'America/Chicago', 'FMDay FMHH12:MI am')
                || '. The free cancel window has closed, so PackPass holds the spot for 2 hours, then offers it to the next dog.',
              public.dog_href('/class/' || p_session, w.dog_id));
      n := n + 1;
    end loop;
    return n;
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
                || '. Free to cancel until ' || public.day_time(public.free_cancel_until(p_session)) || '.',
              public.dog_href('/class/' || p_session, w.dog_id));
      n := n + 1;
    exception when others then
      update public.waitlist set status = 'missed', closed_at = now(), missed_reason = sqlerrm where id = w.id;
      insert into public.notifications (member_id, category, kind, title, body, href)
      values (w.member_id, 'bookings', 'waitlist_missed', 'A spot opened, but we couldn''t book it',
              t || ': ' || case sqlerrm when 'credits' then 'not enough credits.' when 'vaccines' then 'vaccines need updating for that day.'
                                        when 'needs_social' then 'it needs a Social clearance.' else 'it can''t be booked right now.' end,
              public.dog_href('/class/' || p_session, w.dog_id));
    end;
  end loop;
  return n;
end $$;

create or replace function public.mark_no_shows()
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  for r in
    update public.bookings b set status = 'no_show'
    from public.sessions s join public.class_types c on c.id = s.class_id
    where s.id = b.session_id and b.status = 'booked' and s.cancelled_at is null
      and s.starts_at + make_interval(mins => c.duration_min) + interval '2 hours' < now()
    returning b.id, b.member_id, b.dog_id, b.credits_charged, c.title, c.cancel_hours, (select d.name from public.dogs d where d.id = b.dog_id) dog_name
  loop
    insert into public.notifications (member_id, category, kind, title, body, href)
    values (r.member_id, 'bookings', 'class_missed', r.dog_name || ' missed ' || r.title,
            r.dog_name || ' wasn''t checked in, so the ' || case when r.credits_charged = 1 then 'credit was' else r.credits_charged || ' credits were' end
            || ' used. Cancel at least ' || r.cancel_hours || ' hours before and they come back.',
            public.dog_href('/missed/' || r.id, r.dog_id));
    n := n + 1;
  end loop;
  return n;
end $$;

-- Earnings: a cancellation inside the template's window pays the partner, unless its credits were refunded (a session
-- the partner or a low enrollment cancelled).

create or replace function public.partner_earnings(p_months int default 6)
returns table (month date, sessions int, dogs int, credits int, amount_cents int)
language sql stable security definer set search_path = public as $$
  with mine as (
    select date_trunc('month', s.starts_at at time zone 'America/Chicago')::date m, s.id sid, b.credits_charged cr
    from public.bookings b join public.sessions s on s.id = b.session_id join public.class_types c on c.id = s.class_id
    where c.partner_id = public.owner_partner() and s.starts_at < now()
      and (b.status in ('booked', 'checked_in', 'no_show')
           or (b.status = 'cancelled' and b.cancelled_at > s.starts_at - make_interval(hours => c.cancel_hours)
               and not exists (select 1 from public.credit_ledger l where l.booking_id = b.id and l.reason = 'refund')))
  )
  select g.m::date, count(distinct mine.sid)::int, count(mine.sid)::int, coalesce(sum(mine.cr), 0)::int,
         (coalesce(sum(mine.cr), 0) * (select payout_rate_cents from public.partners where id = public.owner_partner()))::int
  from generate_series(date_trunc('month', now() at time zone 'America/Chicago') - make_interval(months => p_months - 1),
                       date_trunc('month', now() at time zone 'America/Chicago'), interval '1 month') g(m)
  left join mine on mine.m = g.m::date
  group by g.m order by g.m desc
$$;

create or replace function public.partner_earnings_by_class()
returns table (class_id text, title text, dogs int, credits int, amount_cents int)
language sql stable security definer set search_path = public as $$
  select c.id, c.title, count(*)::int, sum(b.credits_charged)::int,
         (sum(b.credits_charged) * (select payout_rate_cents from public.partners where id = public.owner_partner()))::int
  from public.bookings b join public.sessions s on s.id = b.session_id join public.class_types c on c.id = s.class_id
  where c.partner_id = public.owner_partner() and s.starts_at < now()
    and s.starts_at >= date_trunc('month', now() at time zone 'America/Chicago') at time zone 'America/Chicago'
    and (b.status in ('booked', 'checked_in', 'no_show') or (b.status = 'cancelled' and b.cancelled_at > s.starts_at - make_interval(hours => c.cancel_hours)
               and not exists (select 1 from public.credit_ledger l where l.booking_id = b.id and l.reason = 'refund')))
  group by c.id, c.title order by 4 desc
$$;

create or replace function public.payouts_due()
returns table (partner_id text, account_id text, month date, credits int, amount_cents int)
language sql stable security definer set search_path = public as $$
  with earned as (
    select c.partner_id, date_trunc('month', s.starts_at at time zone 'America/Chicago')::date m, sum(b.credits_charged)::int cr
    from public.bookings b join public.sessions s on s.id = b.session_id join public.class_types c on c.id = s.class_id
    where s.starts_at < date_trunc('month', now() at time zone 'America/Chicago') at time zone 'America/Chicago'
      and (b.status in ('booked', 'checked_in', 'no_show')
           or (b.status = 'cancelled' and b.cancelled_at > s.starts_at - make_interval(hours => c.cancel_hours)
               and not exists (select 1 from public.credit_ledger l where l.booking_id = b.id and l.reason = 'refund')))
    group by 1, 2
  )
  select e.partner_id, ps.account_id, e.m, e.cr, e.cr * p.payout_rate_cents
  from earned e join public.partners p on p.id = e.partner_id join public.partner_stripe ps on ps.partner_id = e.partner_id
  where p.payout_status = 'connected' and e.cr > 0
    and not exists (select 1 from public.partner_payouts x where x.partner_id = e.partner_id and x.month = e.m)
  order by e.partner_id, e.m
$$;


do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('enforce-minimums', '*/15 * * * *', 'select public.enforce_minimums()');
  end if;
end $$;
