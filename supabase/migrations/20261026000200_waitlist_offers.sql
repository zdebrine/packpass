-- Waitlist offers (Scheduling flow, notif-waitlist). Inside 12 hours of the start the free cancel window has
-- closed, so PackPass no longer books the first dog in line on its own. Instead it holds the spot for that dog
-- for 2 hours ("A spot opened. Accept by 11:40 am."). The member accepts (books it, paying the credits then) or
-- passes; a pass or an expired offer moves the spot to the next dog in line. Sessions with auto-promote off keep
-- telling everyone waiting, first to book gets it.
--
-- An offer is the waitlist row itself: status 'offered' until offer_expires_at, with the spot taken out of
-- spots_left while it lasts. Booking the session uses the offered spot (book_as), and release_expired_holds
-- (every 15 minutes) closes offers that ran out.

alter table public.waitlist add column offer_expires_at timestamptz;

-- The app says what happens when a spot opens, which depends on the partner's auto-promote switch.
grant select (auto_promote) on public.sessions to anon, authenticated;

-- One live entry per dog, waiting or offered.
drop index public.waitlist_one_live;
create unique index waitlist_one_live on public.waitlist (session_id, dog_id) where status in ('waiting', 'offered');

-- Gives a spot back to the line: an offer the member passed on or let run out. spots_left going up fills it.
create function public.close_offer(p_entry uuid, p_status public.waitlist_status, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  w public.waitlist;
begin
  update public.waitlist set status = p_status, closed_at = now(), missed_reason = p_reason
  where id = p_entry and status = 'offered' returning * into w;
  if found then update public.sessions set spots_left = spots_left + 1 where id = w.session_id; end if;
end $$;
revoke execute on function public.close_offer from public, anon, authenticated;

-- Closes every offer past its time. Called by release_expired_holds.
create function public.expire_waitlist_offers()
returns int language plpgsql security definer set search_path = public as $$
declare
  w public.waitlist;
  n int := 0;
begin
  for w in select * from public.waitlist where status = 'offered' and offer_expires_at <= now() order by offer_expires_at loop
    perform public.close_offer(w.id, 'missed', 'offer_expired');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.expire_waitlist_offers from public, anon, authenticated;

-- Latest definition: …_held_spots.sql. Expired offers go back to the line too.
create or replace function public.release_expired_holds()
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
  return n + public.expire_waitlist_offers();
end $$;

-- Latest definition: …_dog_links.sql.
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

  -- Inside 12 hours: hold each open spot for the next dog in line for 2 hours (no later than the start).
  if s.starts_at - now() < interval '12 hours' then
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
                || '. Free to cancel until 12 hours before.',
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

-- Latest definition: …_waitlist.sql. A dog with a live offer books the spot held for it.
create or replace function public.book_as(p_member uuid, p_session uuid, p_dog uuid)
returns public.bookings language plpgsql security definer set search_path = public as $$
declare
  s public.sessions;
  c public.class_types;
  p public.profiles;
  block text;
  b public.bookings;
  hold uuid;
  offer uuid;
begin
  if not exists (select 1 from public.dogs where id = p_dog and owner_id = p_member) then raise exception 'not_your_dog'; end if;

  -- Lock the session and the member so two taps can't double-spend spots or credits.
  select * into s from public.sessions where id = p_session for update;
  if not found then raise exception 'not_found'; end if;
  select * into c from public.class_types where id = s.class_id;
  select * into p from public.profiles where id = p_member for update;
  select id into hold from public.held_spots
  where session_id = p_session and dog_id = p_dog and member_id = p_member and status = 'held' and expires_at > now();
  select id into offer from public.waitlist
  where session_id = p_session and dog_id = p_dog and member_id = p_member and status = 'offered' and offer_expires_at > now();

  block := public.booking_block(p_dog, p_session);
  if block is not null then raise exception '%', block; end if;
  if exists (select 1 from public.bookings where session_id = p_session and dog_id = p_dog and status <> 'cancelled') then
    raise exception 'already_booked';
  end if;
  if hold is null and offer is null and s.spots_left <= 0 then raise exception 'full'; end if;
  if p.credits_balance < c.credits then raise exception 'credits'; end if;

  if hold is not null then
    update public.held_spots set status = 'booked', closed_at = now() where id = hold;
  elsif offer is null then
    update public.sessions set spots_left = spots_left - 1 where id = p_session;
  end if;
  update public.profiles set credits_balance = credits_balance - c.credits where id = p_member;
  insert into public.bookings (session_id, dog_id, member_id, credits_charged)
  values (p_session, p_dog, p_member, c.credits) returning * into b;
  insert into public.credit_ledger (member_id, delta, reason, booking_id) values (p_member, -c.credits, 'booking', b.id);
  -- Booking yourself means you're no longer waiting for it (or holding an offer).
  update public.waitlist set status = 'booked', closed_at = now(), booking_id = b.id
  where session_id = p_session and dog_id = p_dog and status in ('waiting', 'offered');
  return b;
end $$;
revoke execute on function public.book_as from public, anon, authenticated;

-- Latest definition: …_waitlist.sql. Leaving with an offer passes it to the next dog.
create or replace function public.leave_waitlist(p_dog uuid, p_session uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  w public.waitlist;
begin
  select * into w from public.waitlist
  where session_id = p_session and dog_id = p_dog and member_id = auth.uid() and status in ('waiting', 'offered');
  if not found then return; end if;
  if w.status = 'offered' then
    perform public.close_offer(w.id, 'left');
  else
    update public.waitlist set status = 'left', closed_at = now() where id = w.id;
  end if;
end $$;

-- Latest definition: …_waitlist.sql. Adds the offer's deadline; an offered dog is first in line.
drop function public.my_waitlist();
create function public.my_waitlist()
returns table (session_id uuid, dog_id uuid, place int, offer_until timestamptz)
language sql stable security definer set search_path = public as $$
  select w.session_id, w.dog_id,
         case when w.status = 'offered' then 1
              else (select count(*) from public.waitlist x where x.session_id = w.session_id and x.status = 'waiting' and x.created_at <= w.created_at) end::int,
         case when w.status = 'offered' then w.offer_expires_at end
  from public.waitlist w join public.sessions s on s.id = w.session_id
  where w.member_id = auth.uid() and s.starts_at > now()
    and (w.status = 'waiting' or (w.status = 'offered' and w.offer_expires_at > now()))
  order by s.starts_at
$$;
revoke execute on function public.my_waitlist from public, anon;
grant execute on function public.my_waitlist to authenticated;

-- Latest definition: …_partner_dashboard.sql. Shows the dog holding an offer, and until when.
drop function public.partner_waitlist(uuid);
create function public.partner_waitlist(p_session uuid)
returns table (dog_name text, breed text, joined_at timestamptz, place int, offer_until timestamptz)
language sql stable security definer set search_path = public as $$
  select d.name, d.breed, w.created_at,
         row_number() over (order by w.status = 'offered' desc, w.created_at)::int,
         case when w.status = 'offered' then w.offer_expires_at end
  from public.waitlist w join public.dogs d on d.id = w.dog_id
  join public.sessions s on s.id = w.session_id join public.class_types c on c.id = s.class_id
  where w.session_id = p_session and w.status in ('waiting', 'offered') and c.partner_id = public.staff_partner()
  order by w.status = 'offered' desc, w.created_at
$$;
revoke execute on function public.partner_waitlist from public, anon;
grant execute on function public.partner_waitlist to authenticated;

-- Latest definition: …_dog_links.sql. Offers close with the session.
create or replace function public.cancel_session_for_partner(p_session uuid, p_reason text, p_message text)
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
            public.dog_href('/book', b.dog_id));
    n := n + 1;
  end loop;
  update public.held_spots set status = 'released', closed_at = now() where session_id = p_session and status = 'held';
  update public.waitlist set status = 'left', closed_at = now() where session_id = p_session and status in ('waiting', 'offered');
  return n;
end $$;

-- Latest definition: …_delete_account.sql. An offer this member holds goes to the next dog.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  me uuid := auth.uid();
  w public.waitlist;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  -- Off the waitlists first, so a spot given back here isn't handed to this member's own waiting dog.
  update public.waitlist set status = 'left', closed_at = now() where member_id = me and status = 'waiting';
  for w in select * from public.waitlist where member_id = me and status = 'offered' loop
    perform public.close_offer(w.id, 'left');
  end loop;

  with upcoming as (
    select b.session_id, count(*) n from public.bookings b join public.sessions s on s.id = b.session_id
    where b.member_id = me and b.status = 'booked' and s.starts_at > now() and s.cancelled_at is null
    group by b.session_id
  )
  update public.sessions s set spots_left = s.spots_left + upcoming.n from upcoming where s.id = upcoming.session_id;

  with held as (
    update public.held_spots set status = 'released', closed_at = now()
    where member_id = me and status = 'held'
    returning session_id
  ), per as (select session_id, count(*) n from held group by session_id)
  update public.sessions s set spots_left = s.spots_left + per.n from per where s.id = per.session_id;

  delete from auth.users where id = me;
end $$;

create or replace function public.push_kind(k text) returns boolean language sql immutable set search_path = public as $$
  select k in ('hold_expiring', 'holds_released', 'clearance_earned', 'waitlist_booked', 'waitlist_open', 'waitlist_missed',
               'waitlist_offer', 'session_cancelled', 'session_note', 'assessment_result', 'path_step', 'records_approved',
               'records_denied', 'class_missed', 'reassessment')
$$;
