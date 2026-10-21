-- Partners see every clearance by its name: the roster's Passport badges and the "not yet" notification used to
-- capitalise the clearance id (fine for Social and Herding, not for one PackPass adds).

create or replace function public.partner_roster(p_session uuid)
 RETURNS TABLE(booking_id uuid, status booking_status, checked_in_at timestamp with time zone, dog_id uuid, dog_name text, breed text, mixed boolean, birth_year integer, birth_month integer, energy energy_level, sociability sociability, traits text[], photo_path text, owner_name text, vaccine_line text, record_path text, record_verified boolean, clearances text[], last_note text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select b.id, b.status, b.checked_in_at, d.id, d.name, d.breed, d.mixed, d.birth_year, d.birth_month, d.energy, d.sociability,
         d.traits, d.photo_path, p.name,
         public.vaccine_line(d.id, (s.starts_at at time zone 'America/Chicago')::date),
         (select v.document_path from public.vaccinations v where v.dog_id = d.id and v.document_path is not null limit 1),
         coalesce((select bool_and(v.verified) from public.vaccinations v where v.dog_id = d.id), false),
         array(select distinct on (k.type) (select t.name from public.clearance_types t where t.id = k.type) || case when k.reassess_at is not null then ' · re-assess' else '' end
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
$function$

;

create or replace function public.partner_record_result(p_booking uuid, p_outcome assessment_outcome, p_strengths text[] DEFAULT '{}'::text[], p_working text[] DEFAULT '{}'::text[], p_quote text DEFAULT NULL::text, p_goal boolean DEFAULT false)
 RETURNS assessments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me text := public.staff_partner();
  r record;
  who text;
  a public.assessments;
begin
  select b.id, b.dog_id, b.member_id, s.starts_at, c.grants, d.name dog_name into r
  from public.bookings b join public.sessions s on s.id = b.session_id join public.class_types c on c.id = s.class_id
  join public.dogs d on d.id = b.dog_id
  where b.id = p_booking and c.partner_id = me and c.grants is not null and b.status <> 'cancelled';
  if not found then raise exception 'not_found'; end if;
  if r.starts_at > now() then raise exception 'too_early'; end if;
  if exists (select 1 from public.assessments where booking_id = p_booking) then raise exception 'already_recorded'; end if;
  select coalesce(t.name, pr.name) into who from public.partner_staff ps
  left join public.trainers t on t.id = ps.trainer_id left join public.profiles pr on pr.id = ps.user_id
  where ps.user_id = auth.uid();
  a := public.record_assessment(r.dog_id, r.grants, me, coalesce(nullif(who, ''), 'PackPass partner'), p_outcome,
                                p_strengths, p_working, nullif(trim(coalesce(p_quote, '')), ''), p_booking);
  if p_outcome = 'not_yet' then
    if p_goal then
      insert into public.dog_paths (dog_id, path_id)
      select r.dog_id, id from public.training_paths where grants = r.grants
      on conflict (dog_id, path_id) do update set completed_at = null;
    end if;
    insert into public.notifications (member_id, category, kind, title, body, href)
    values (r.member_id, 'clearances', 'assessment_result',
            r.dog_name || '''s ' || (select t.name from public.clearance_types t where t.id = r.grants) || ' assessment: not yet',
            coalesce(nullif(trim(coalesce(p_quote, '')), ''), 'Your trainer left notes on what to work on.')
              || case when p_goal then ' A training path is on ' || r.dog_name || '''s Passport.' else '' end,
            public.dog_href('/passport/' || r.grants, r.dog_id));
  end if;
  return a;
end $function$

;

