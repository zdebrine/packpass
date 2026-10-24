-- Reminder sequence per booking (Scheduling flow §4, notif-before and notif-after). Every booking gets:
--   1. Booked: class, time, credits used and left, stay or drop-off, free cancel time (notify_booking).
--   2. 24 hours before: parking and where to meet, stay or drop-off, free cancel time. Confirm or Cancel.
--   3. 2 hours before: address and where to meet, with Check in and Directions.
--   4. After class: the trainer's note, now with Book again for the same class (partner_send_note).
--   5. No booking in 10 days: one nudge with two classes that fit the dog (the app picks them).
-- Each one is a notification, pushed to phones (send-push) and emailed (send-email) unless the member turned
-- email reminders off. send_reminders and send_nudges run from pg_cron.
--
-- notifications.session_id says which session a notification is about, so its card can offer the session's
-- actions (Cancel, Check in, Book again) without parsing the link.

alter table public.notifications add column session_id uuid references public.sessions (id) on delete set null;
alter table public.bookings add column reminded_24h_at timestamptz, add column reminded_2h_at timestamptz;
alter table public.profiles add column email_reminders boolean not null default true, add column nudged_at timestamptz;

-- The member sets their own email preference (Settings › Notifications).
create function public.set_email_reminders(p_on boolean)
returns void language sql security definer set search_path = public as $$
  update public.profiles set email_reminders = coalesce(p_on, true) where id = auth.uid()
$$;
revoke execute on function public.set_email_reminders from public, anon;
grant execute on function public.set_email_reminders to authenticated;

-- "Sat 10:00 am" in Austin time.
create function public.day_time(p_at timestamptz) returns text language sql stable set search_path = public as $$
  select to_char(p_at at time zone 'America/Chicago', 'FMDy FMHH12:MI am')
$$;

-- The two lines every reminder carries: stay or drop-off, and the free cancel time (12 hours before, as
-- cancel_booking refunds).
create function public.booking_rules(p_session uuid, p_dog uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when c.drop_off then 'Drop-off: leave ' || d.name || ' with the trainer.' else 'You stay with ' || d.name || '.' end
         || case when s.starts_at - interval '12 hours' > now() then ' Free cancel until ' || public.day_time(s.starts_at - interval '12 hours') || '.'
                 else ' Free cancel closed ' || public.day_time(s.starts_at - interval '12 hours') || '.' end
  from public.sessions s join public.class_types c on c.id = s.class_id, public.dogs d
  where s.id = p_session and d.id = p_dog
$$;
revoke execute on function public.booking_rules from public, anon, authenticated;

-- 1. Booked (latest definition: …_dog_links.sql).
create or replace function public.notify_booking() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if current_setting('packpass.waitlist_booking', true) = 'on' then return new; end if;
  select s.starts_at, c.title, pa.name partner, p.credits_balance, public.plan_credits(p.plan) monthly into r
  from public.sessions s join public.class_types c on c.id = s.class_id join public.partners pa on pa.id = c.partner_id
  join public.profiles p on p.id = new.member_id
  where s.id = new.session_id;
  insert into public.notifications (member_id, category, kind, title, body, href, session_id)
  values (new.member_id, 'bookings', 'booked', 'Booked. ' || r.title || ', ' || public.day_time(r.starts_at) || '.',
          new.credits_charged || case when new.credits_charged = 1 then ' credit' else ' credits' end || ' used · '
            || r.credits_balance || case when r.credits_balance <= r.monthly then ' of ' || r.monthly else '' end || ' left. ' || r.partner || '. ' || public.booking_rules(new.session_id, new.dog_id),
          public.dog_href('/class/' || new.session_id, new.dog_id), new.session_id);
  return new;
end $$;

-- 2 and 3. The 24-hour and 2-hour reminders for booked classes, each once. A class booked inside a window skips
-- that reminder (the booking notice just said it all). Run every 15 minutes by pg_cron.
create function public.send_reminders()
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select b.id, b.member_id, b.dog_id, b.session_id, b.created_at, s.starts_at, c.title, pa.name partner, pa.address, pa.parking, pa.meet_at
    from public.bookings b join public.sessions s on s.id = b.session_id join public.class_types c on c.id = s.class_id
    join public.partners pa on pa.id = c.partner_id
    where b.status = 'booked' and s.cancelled_at is null and s.starts_at > now()
      and ((b.reminded_24h_at is null and s.starts_at <= now() + interval '24 hours')
        or (b.reminded_2h_at is null and s.starts_at <= now() + interval '2 hours'))
    for update of b skip locked
  loop
    if r.starts_at <= now() + interval '2 hours' then
      if r.created_at < r.starts_at - interval '2 hours' then
        insert into public.notifications (member_id, category, kind, title, body, href, session_id)
        values (r.member_id, 'bookings', 'reminder_2h', 'In 2 hours: ' || r.title,
                r.partner || ', ' || r.address || '.' || coalesce(' ' || nullif(trim(r.meet_at), '') || '.', '') || ' '
                  || public.booking_rules(r.session_id, r.dog_id),
                public.dog_href('/class/' || r.session_id, r.dog_id), r.session_id);
        n := n + 1;
      end if;
      update public.bookings set reminded_2h_at = now(), reminded_24h_at = coalesce(reminded_24h_at, now()) where id = r.id;
    else
      if r.created_at < r.starts_at - interval '24 hours' then
        insert into public.notifications (member_id, category, kind, title, body, href, session_id)
        values (r.member_id, 'bookings', 'reminder_24h',
                case when (r.starts_at at time zone 'America/Chicago')::date = (now() at time zone 'America/Chicago')::date
                     then 'Today, ' else 'Tomorrow, ' end || to_char(r.starts_at at time zone 'America/Chicago', 'FMHH12:MI am') || ': ' || r.title,
                r.partner || '.' || coalesce(' ' || nullif(trim(r.parking), '') || '.', '') || coalesce(' Meet at the ' || lower(nullif(trim(r.meet_at), '')) || '.', '') || ' '
                  || public.booking_rules(r.session_id, r.dog_id),
                public.dog_href('/class/' || r.session_id, r.dog_id), r.session_id);
        n := n + 1;
      end if;
      update public.bookings set reminded_24h_at = now() where id = r.id;
    end if;
  end loop;
  return n;
end $$;
revoke execute on function public.send_reminders from public, anon, authenticated;

-- 5. One nudge for members with nothing booked and no new booking in 10 days, then not again until they book.
-- Run daily by pg_cron. The card shows two classes that fit the member's first dog, picked in the app.
create function public.send_nudges()
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select p.id, (select d.id from public.dogs d where d.owner_id = p.id order by d.created_at limit 1) dog_id,
           (select d.name from public.dogs d where d.owner_id = p.id order by d.created_at limit 1) dog_name
    from public.profiles p
    where p.created_at <= now() - interval '10 days'
      and exists (select 1 from public.dogs d where d.owner_id = p.id)
      and not exists (select 1 from public.bookings b join public.sessions s on s.id = b.session_id
                      where b.member_id = p.id and b.status = 'booked' and s.starts_at > now())
      and not exists (select 1 from public.bookings b where b.member_id = p.id and b.created_at > now() - interval '10 days')
      and (p.nudged_at is null or p.nudged_at < coalesce((select max(b.created_at) from public.bookings b where b.member_id = p.id), p.created_at))
  loop
    insert into public.notifications (member_id, category, kind, title, body, href)
    values (r.id, 'bookings', 'nudge_10d', 'No booking in 10 days.', 'Two that fit ' || r.dog_name || ' this week.',
            public.dog_href('/book', r.dog_id));
    update public.profiles set nudged_at = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.send_nudges from public, anon, authenticated;

-- 4. A trainer's note (latest definition: …_dog_links.sql), now about its session so the card offers Book again.
create or replace function public.partner_send_note(p_booking uuid, p_note text, p_skills text[] default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare
  me text := public.staff_partner();
  r record;
  trainer text;
begin
  if length(trim(coalesce(p_note, ''))) < 3 then raise exception 'empty_note'; end if;
  select b.id, b.member_id, b.dog_id, b.session_id, d.name dog_name, c.title, c.trainer_id into r
  from public.bookings b join public.sessions s on s.id = b.session_id join public.class_types c on c.id = s.class_id
  join public.dogs d on d.id = b.dog_id
  where b.id = p_booking and c.partner_id = me and b.status <> 'cancelled';
  if not found then raise exception 'not_found'; end if;
  trainer := coalesce((select trainer_id from public.partner_staff where user_id = auth.uid()), r.trainer_id);
  if exists (select 1 from public.session_notes where booking_id = p_booking) then
    update public.session_notes set note = trim(p_note), skills = p_skills, trainer_id = trainer where booking_id = p_booking;
  else
    insert into public.session_notes (booking_id, trainer_id, note, skills) values (p_booking, trainer, trim(p_note), p_skills);
    insert into public.notifications (member_id, category, kind, title, body, href, session_id)
    values (r.member_id, 'notes', 'session_note',
            'Note on ' || r.dog_name || ' from ' || coalesce((select split_part(name, ' ', 1) from public.trainers where id = trainer), 'your trainer'),
            r.title || ': ' || left(trim(p_note), 140), public.dog_href('/log', r.dog_id), r.session_id);
  end if;
end $$;

-- Pushed (same list as PUSH_KINDS in supabase/functions/send-push/push.ts).
create or replace function public.push_kind(k text) returns boolean language sql immutable set search_path = public as $$
  select k in ('hold_expiring', 'holds_released', 'clearance_earned', 'waitlist_booked', 'waitlist_open', 'waitlist_missed',
               'waitlist_offer', 'session_cancelled', 'session_note', 'assessment_result', 'path_step', 'records_approved',
               'records_denied', 'class_missed', 'reassessment', 'reminder_24h', 'reminder_2h', 'nudge_10d')
$$;

-- ---- Email ------------------------------------------------------------------------------------------

-- Emailed (same list as EMAIL_KINDS in supabase/functions/send-email/email.ts): the reminder sequence, plus
-- waitlist news that needs an answer.
create function public.email_kind(k text) returns boolean language sql immutable set search_path = public as $$
  select k in ('booked', 'reminder_24h', 'reminder_2h', 'session_note', 'nudge_10d', 'waitlist_booked', 'waitlist_offer')
$$;

-- Like send_push (…_push_webhook.sql): calls the send-email Edge Function through pg_net with the shared
-- webhook secret. Its URL lives in Vault:
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/send-email', 'email_function_url');
-- Without pg_net, Vault or that secret (plain Postgres, the tests), nothing is sent.
create function public.send_email() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  url text;
  secret text;
begin
  if not public.email_kind(new.kind) or to_regproc('net.http_post') is null then return new; end if;
  if not exists (select 1 from public.profiles where id = new.member_id and email_reminders and email is not null) then return new; end if;
  url := public.push_secret('email_function_url');
  secret := public.push_secret('push_webhook_secret');
  if url is null or secret is null then return new; end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
  using url,
        jsonb_build_object('type', 'INSERT', 'table', 'notifications', 'record', to_jsonb(new)),
        jsonb_build_object('content-type', 'application/json', 'x-webhook-secret', secret);
  return new;
end $$;
revoke execute on function public.send_email from public, anon, authenticated;

create trigger notifications_email after insert on public.notifications
for each row execute function public.send_email();

-- For send-email (service role): what the email shows beyond the notification itself.
create function public.email_context(p_notification uuid)
returns table (email text, name text, partner text, address text, starts_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.email, p.name, pa.name, pa.address, s.starts_at
  from public.notifications n join public.profiles p on p.id = n.member_id
  left join public.sessions s on s.id = n.session_id left join public.class_types c on c.id = s.class_id
  left join public.partners pa on pa.id = c.partner_id
  where n.id = p_notification and p.email_reminders
$$;
revoke execute on function public.email_context from public, anon, authenticated;
grant execute on function public.email_context to service_role;

-- ---- Jobs -------------------------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('reminders', '*/15 * * * *', 'select public.send_reminders()');
    perform cron.schedule('booking-nudges', '0 16 * * *', 'select public.send_nudges()');
  end if;
end $$;
