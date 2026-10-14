-- Re-assessment: a partner or PackPass can send a cleared dog back for re-assessment, with a reason.
-- The flag ends the clearance today (it reads as expired everywhere: has_clearance, rosters, the Passport),
-- remembers the old expiry so the flag can be undone, and tells the owner. Passing again adds a new clearance.
-- Partners flag Social for any dog that has booked with them, and Herding only where they assessed it.

alter table public.clearances
  add column reassess_at timestamptz,
  add column reassess_reason text,
  add column reassess_by text,
  add column expires_before date;

create function public.flag_reassessment(p_dog uuid, p_type public.clearance_type, p_reason text, p_undo boolean default false)
returns int language plpgsql security definer set search_path = public as $$
declare
  admin boolean := public.is_packpass_admin();
  me text := public.staff_partner();
  why text := nullif(trim(coalesce(p_reason, '')), '');
  who text;
  n int;
  owner uuid;
  dog_name text;
begin
  if not admin then
    if me is null then raise exception 'permission denied'; end if;
    if not exists (select 1 from public.bookings b join public.sessions s on s.id = b.session_id
                   join public.class_types c on c.id = s.class_id where b.dog_id = p_dog and c.partner_id = me) then
      raise exception 'not_found';
    end if;
  end if;

  if p_undo then
    update public.clearances k set expires_on = k.expires_before, expires_before = null,
      reassess_at = null, reassess_reason = null, reassess_by = null
    where k.dog_id = p_dog and k.type = p_type and k.reassess_at is not null
      and (admin or k.type = 'social' or k.partner_id = me);
    get diagnostics n = row_count;
    if n = 0 then raise exception 'not_found'; end if;
    return n;
  end if;

  if why is null then raise exception 'reason_required'; end if;
  if me is null then
    who := 'PackPass';
  else
    select coalesce(nullif(coalesce(t.name, pr.name), ''), 'A trainer') || ', ' || pa.name into who
    from public.partner_staff ps
    join public.partners pa on pa.id = ps.partner_id
    left join public.trainers t on t.id = ps.trainer_id
    left join public.profiles pr on pr.id = ps.user_id
    where ps.user_id = auth.uid();
  end if;

  update public.clearances k set expires_before = k.expires_on, expires_on = current_date - 1,
    reassess_at = now(), reassess_reason = why, reassess_by = who
  where k.dog_id = p_dog and k.type = p_type and (k.expires_on is null or k.expires_on >= current_date)
    and (admin or k.type = 'social' or k.partner_id = me);
  get diagnostics n = row_count;
  if n = 0 then raise exception 'not_found'; end if;

  select d.owner_id, d.name into owner, dog_name from public.dogs d where d.id = p_dog;
  insert into public.notifications (member_id, category, kind, title, body, href)
  values (owner, 'clearances', 'reassessment',
          dog_name || ' needs a ' || initcap(p_type::text) || ' re-assessment',
          why || ' · ' || who,
          public.dog_href('/passport/' || p_type::text, p_dog));
  return n;
end $$;
revoke execute on function public.flag_reassessment from public, anon;
grant execute on function public.flag_reassessment to authenticated;

create or replace function public.push_kind(k text) returns boolean language sql immutable set search_path = public as $$
  select k in ('hold_expiring', 'holds_released', 'clearance_earned', 'waitlist_booked', 'waitlist_open', 'waitlist_missed',
               'session_cancelled', 'session_note', 'assessment_result', 'path_step', 'records_approved', 'records_denied',
               'class_missed', 'reassessment')
$$;

-- PackPass › Clearances: every current clearance, and flagged ones still waiting on a re-assessment.
create function public.admin_clearances()
returns table (dog_id uuid, dog_name text, breed text, owner_name text, type public.clearance_type, partner_name text,
               assessed_on date, expires_on date, reassess_at timestamptz, reassess_reason text, reassess_by text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_packpass_admin() then raise exception 'permission denied'; end if;
  return query
  select d.id, d.name, d.breed, p.name, k.type, pa.name, k.assessed_on, k.expires_on, k.reassess_at, k.reassess_reason, k.reassess_by
  from public.clearances k
  join public.dogs d on d.id = k.dog_id
  join public.profiles p on p.id = d.owner_id
  join public.partners pa on pa.id = k.partner_id
  where (k.expires_on is null or k.expires_on >= current_date)
     or (k.reassess_at is not null and not public.has_clearance(k.dog_id, k.type, k.partner_id, current_date))
  order by k.reassess_at desc nulls last, d.name, k.type;
end $$;
revoke execute on function public.admin_clearances from public, anon;
grant execute on function public.admin_clearances to authenticated;

-- As before (…_partner_dashboard.sql), plus a flagged clearance still waiting on its re-assessment, as "Herding · re-assess".
create or replace function public.partner_roster(p_session uuid)
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
         array(select distinct on (k.type) initcap(k.type::text) || case when k.reassess_at is not null then ' · re-assess' else '' end
               from public.clearances k where k.dog_id = d.id and (k.scope = 'network' or k.partner_id = c.partner_id)
                 and ((k.expires_on is null or k.expires_on >= current_date)
                      or (k.reassess_at is not null and not public.has_clearance(d.id, k.type, c.partner_id, current_date)))
               order by k.type, (k.reassess_at is null) desc),
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

-- As before, with a flagged clearance labelled "re-assess" rather than expired.
create or replace function public.partner_assessments()
returns table (booking_id uuid, starts_at timestamptz, class_title text, grants public.clearance_type, duration_min int,
               dog_id uuid, dog_name text, breed text, owner_name text, photo_path text, traits text[],
               clearances text[], outcome public.assessment_outcome, strengths text[], working_on text[], quote text)
language sql stable security definer set search_path = public as $$
  select b.id, s.starts_at, c.title, c.grants, c.duration_min, d.id, d.name, d.breed, p.name, d.photo_path, d.traits,
         array(select initcap(k.type::text) || case when k.reassess_at is not null then ' · re-assess: ' || k.reassess_reason
                                                    when k.expires_on < current_date then ' · expired ' || to_char(k.expires_on, 'Mon YYYY') else '' end
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
