-- The member app's Log (07): the sessions a member's dogs have been to, with the trainer's note and any
-- assessment result. Bookings that ran count whether or not the dog was checked in; cancelled ones don't.

create function public.my_log(p_months int default 6)
returns table (
  booking_id uuid, dog_id uuid, starts_at timestamptz, duration_min int, class_id text, title text, image text,
  balance public.balance_category, session_type public.session_type, partner_name text, trainer_name text,
  note text, skills text[], note_by text, assessed public.clearance_type, outcome public.assessment_outcome, quote text,
  strengths text[], working_on text[], assessor text
) language sql stable security definer set search_path = public as $$
  select b.id, b.dog_id, s.starts_at, c.duration_min, c.id, c.title, c.image, c.balance, c.session_type, p.name,
         t.name, n.note, coalesce(n.skills, '{}'), nt.name, a.type, a.outcome, a.quote,
         coalesce(a.strengths, '{}'), coalesce(a.working_on, '{}'), a.assessor
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
