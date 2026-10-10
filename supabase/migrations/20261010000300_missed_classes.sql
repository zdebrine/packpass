-- Missed classes. A booking nobody checked in (the member's scan, the partner's roster or a trainer's note) and
-- nobody cancelled becomes a no-show two hours after the session ends. The credits stay used, as with a cancel
-- inside 12 hours, and the member is told once: the app's Missed class screen (/missed/<booking>).
-- A partner who checks the dog in afterwards undoes it, and the notification goes away.

-- Marks no-shows and tells each member. Run hourly by pg_cron (below). Returns how many it marked.
create function public.mark_no_shows()
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
    returning b.id, b.member_id, b.credits_charged, c.title, (select d.name from public.dogs d where d.id = b.dog_id) dog_name
  loop
    insert into public.notifications (member_id, category, kind, title, body, href)
    values (r.member_id, 'bookings', 'class_missed', r.dog_name || ' missed ' || r.title,
            r.dog_name || ' wasn''t checked in, so the ' || case when r.credits_charged = 1 then 'credit was' else r.credits_charged || ' credits were' end
            || ' used. Cancel at least 12 hours before and they come back.',
            '/missed/' || r.id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.mark_no_shows from public, anon, authenticated;

-- Checked in after all (the partner's roster): take back the notification.
create function public.unmiss_booking() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.notifications where member_id = new.member_id and kind = 'class_missed' and href = '/missed/' || new.id;
  return new;
end $$;
revoke execute on function public.unmiss_booking from public, anon, authenticated;

create trigger bookings_unmiss after update of status on public.bookings
for each row when (old.status = 'no_show' and new.status is distinct from 'no_show')
execute function public.unmiss_booking();

-- A trainer's note means the dog was there, no-show or not.
create or replace function public.note_checks_in() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.bookings b set status = 'checked_in', checked_in_at = coalesce(b.checked_in_at, s.starts_at)
  from public.sessions s
  where b.id = new.booking_id and s.id = b.session_id and b.status in ('booked', 'no_show') and s.starts_at <= now();
  return new;
end $$;

-- The Log shows missed classes too, marked as missed (they don't count towards the dog's month).
drop function public.my_log(int);
create function public.my_log(p_months int default 6)
returns table (
  booking_id uuid, dog_id uuid, starts_at timestamptz, duration_min int, class_id text, title text, image text,
  balance public.balance_category, session_type public.session_type, partner_name text, trainer_name text,
  note text, skills text[], note_by text, assessed public.clearance_type, outcome public.assessment_outcome, quote text,
  strengths text[], working_on text[], assessor text, missed boolean, credits int
) language sql stable security definer set search_path = public as $$
  select b.id, b.dog_id, s.starts_at, c.duration_min, c.id, c.title, c.image, c.balance, c.session_type, p.name,
         t.name, n.note, coalesce(n.skills, '{}'), nt.name, a.type, a.outcome, a.quote,
         coalesce(a.strengths, '{}'), coalesce(a.working_on, '{}'), a.assessor, b.status = 'no_show', b.credits_charged
  from public.bookings b
  join public.sessions s on s.id = b.session_id
  join public.class_types c on c.id = s.class_id
  join public.partners p on p.id = c.partner_id
  left join public.trainers t on t.id = c.trainer_id
  left join public.session_notes n on n.booking_id = b.id
  left join public.trainers nt on nt.id = n.trainer_id
  left join public.assessments a on a.booking_id = b.id
  where b.member_id = (select auth.uid()) and b.status in ('booked', 'checked_in', 'no_show')
    and s.starts_at < now()
    and s.starts_at >= date_trunc('month', now() at time zone 'America/Chicago') at time zone 'America/Chicago'
                       - make_interval(months => greatest(p_months, 1) - 1)
  order by s.starts_at desc
$$;
revoke execute on function public.my_log from public, anon;
grant execute on function public.my_log to authenticated;

-- Pushed (same list as PUSH_KINDS in supabase/functions/send-push/push.ts).
create or replace function public.push_kind(k text) returns boolean language sql immutable set search_path = public as $$
  select k in ('hold_expiring', 'holds_released', 'clearance_earned', 'waitlist_booked', 'waitlist_open', 'waitlist_missed',
               'session_cancelled', 'session_note', 'assessment_result', 'path_step', 'records_approved', 'records_denied',
               'class_missed')
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('mark-no-shows', '20 * * * *', 'select public.mark_no_shows()');
  end if;
end $$;
