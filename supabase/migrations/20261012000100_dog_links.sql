-- Every dog is its own profile in the app (docs/MULTI_DOG_SPEC.md), so every notification about one dog's class
-- opens that dog: booked, waitlist (spot open, booked, missed), session cancelled, trainer's note, held spots
-- releasing soon and missed class now carry `?dog=<id>` like the ones in …_multi_dog.sql. "A spot opened" goes
-- once per waiting dog instead of once per member. The functions are their current definitions with only that
-- changed. No rows change; older notifications keep their links and open for the dog that's showing.

-- Booked (latest definition: …_waitlist.sql).
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
          public.dog_href('/class/' || new.session_id, new.dog_id));
  return new;
end $$;

-- The waitlist (…_partner_dashboard.sql).
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
      returning member_id, dog_id
    )
    insert into public.notifications (member_id, category, kind, title, body, href)
    select distinct on (member_id, dog_id) member_id, 'bookings'::public.notification_category, 'waitlist_open', 'A spot opened. ' || t,
           to_char(s.starts_at at time zone 'America/Chicago', 'FMDay FMHH12:MI am') || '. First to book it gets it.',
           public.dog_href('/class/' || p_session, dog_id)
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

-- A partner cancels a session (…_partner_dashboard.sql).
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
  update public.waitlist set status = 'left', closed_at = now() where session_id = p_session and status = 'waiting';
  return n;
end $$;

-- A trainer's note (…_partner_dashboard.sql).
create or replace function public.partner_send_note(p_booking uuid, p_note text, p_skills text[] default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare
  me text := public.staff_partner();
  r record;
  trainer text;
begin
  if length(trim(coalesce(p_note, ''))) < 3 then raise exception 'empty_note'; end if;
  select b.id, b.member_id, b.dog_id, d.name dog_name, c.title, c.trainer_id into r
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
            r.title || ': ' || left(trim(p_note), 140), public.dog_href('/log', r.dog_id));
  end if;
end $$;

-- Held spots release soon (…_hold_reminders_and_push.sql).
create or replace function public.remind_expiring_holds()
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  perform public.release_expired_holds();
  for r in
    select h.member_id, h.dog_id, d.name dog_name, count(*) c, min(h.expires_at) first_release,
           public.has_clearance(h.dog_id, 'social', null, current_date) cleared
    from public.held_spots h join public.dogs d on d.id = h.dog_id
    where h.status = 'held' and h.reminded_at is null and h.expires_at <= now() + interval '24 hours'
    group by h.member_id, h.dog_id, d.name
  loop
    insert into public.notifications (member_id, category, kind, title, body, href)
    values (r.member_id, 'bookings', 'hold_expiring',
            case when r.cleared then 'Book ' || r.dog_name || '''s held sessions'
                 else r.dog_name || '''s held spots release soon' end,
            case when r.cleared
                 then case when r.c = 1 then 'A held session goes' else r.c || ' held sessions go' end
                      || ' back to other members within a day unless you book. It''s one tap from Today.'
                 else case when r.c = 1 then 'A held group session goes' else r.c || ' held group sessions go' end
                      || ' back to other members within a day. ' || r.dog_name || ' needs a Social clearance to book them.' end,
            public.dog_href('/', r.dog_id));
    update public.held_spots set reminded_at = now()
    where dog_id = r.dog_id and status = 'held' and reminded_at is null and expires_at <= now() + interval '24 hours';
    n := n + 1;
  end loop;
  return n;
end $$;

-- Missed class, and taking it back when the dog is checked in after all, with or without the dog in the link
-- (…_missed_classes.sql).
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
    returning b.id, b.member_id, b.dog_id, b.credits_charged, c.title, (select d.name from public.dogs d where d.id = b.dog_id) dog_name
  loop
    insert into public.notifications (member_id, category, kind, title, body, href)
    values (r.member_id, 'bookings', 'class_missed', r.dog_name || ' missed ' || r.title,
            r.dog_name || ' wasn''t checked in, so the ' || case when r.credits_charged = 1 then 'credit was' else r.credits_charged || ' credits were' end
            || ' used. Cancel at least 12 hours before and they come back.',
            public.dog_href('/missed/' || r.id, r.dog_id));
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.unmiss_booking() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.notifications where member_id = new.member_id and kind = 'class_missed' and href in ('/missed/' || new.id, public.dog_href('/missed/' || new.id, new.dog_id));
  return new;
end $$;
