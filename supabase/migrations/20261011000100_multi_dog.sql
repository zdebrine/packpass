-- Multiple dogs per member (docs/MULTI_DOG_SPEC.md). The tables were already one-to-many; what wasn't is the
-- links in notifications that open one dog's screen (Clearance earned, a goal, the Passport, vaccines, Records
-- Denied). They now carry the dog, `?dog=<id>`, and the app opens that dog. The functions below are the current
-- definitions with only the link changed. No rows change: older notifications keep their links, which the app
-- opens for the dog that's showing, as before.

create function public.dog_href(p_path text, p_dog uuid) returns text
language sql immutable set search_path = public as $$
  select p_path || '?dog=' || p_dog::text
$$;

-- Clearance earned and held spots released (latest definition: …_held_spots.sql).
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
            public.dog_href('/clearance-earned', p_dog));
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
              dog_name || '''s Social assessment came back not yet, so the held group sessions went back to other members.', public.dog_href('/goal/calm-around-dogs', p_dog));
    end if;
  end if;
  return a;
end $$;

-- An assessment that came back "not yet" (…_partner_dashboard.sql).
create or replace function public.partner_record_result(p_booking uuid, p_outcome public.assessment_outcome,
  p_strengths text[] default '{}', p_working text[] default '{}', p_quote text default null, p_goal boolean default false)
returns public.assessments language plpgsql security definer set search_path = public as $$
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
            r.dog_name || '''s ' || initcap(r.grants::text) || ' assessment: not yet',
            coalesce(nullif(trim(coalesce(p_quote, '')), ''), 'Your trainer left notes on what to work on.')
              || case when p_goal then ' A training path is on ' || r.dog_name || '''s Passport.' else '' end,
            public.dog_href('/passport/' || r.grants::text, r.dog_id));
  end if;
  return a;
end $$;

-- A training-path step done (…_path_progress.sql).
create or replace function public.advance_paths() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cls text;
  dp record;
  total int;
  dog_name text;
  next_title text;
begin
  select s.class_id into cls from public.sessions s join public.class_types c on c.id = s.class_id
  where s.id = new.session_id and c.grants is null;
  if cls is null then return new; end if;
  select name into dog_name from public.dogs where id = new.dog_id;
  for dp in
    select d.path_id, d.next_step, ps.title step_title, tp.title path_title
    from public.dog_paths d
    join public.path_steps ps on ps.path_id = d.path_id and ps.position = d.next_step
    join public.training_paths tp on tp.id = d.path_id
    where d.dog_id = new.dog_id and d.completed_at is null and ps.class_id = cls
  loop
    select count(*) into total from public.path_steps where path_id = dp.path_id;
    insert into public.dog_path_steps (dog_id, path_id, position, booking_id) values (new.dog_id, dp.path_id, dp.next_step, new.id)
    on conflict do nothing;
    update public.dog_paths set next_step = dp.next_step + 1, completed_at = case when dp.next_step >= total then now() end
    where dog_id = new.dog_id and path_id = dp.path_id;
    select title into next_title from public.path_steps where path_id = dp.path_id and position = dp.next_step + 1;
    insert into public.notifications (member_id, category, kind, title, body, href)
    values (new.member_id, 'clearances', 'path_step',
            case when dp.next_step >= total then dp.path_title || ' is complete'
                 else 'Step ' || dp.next_step || ' of ' || total || ' done' end,
            dp.step_title || ' · ' || dog_name || coalesce('. Next: ' || next_title || '.', '. That was the last step.'),
            public.dog_href('/goal/' || dp.path_id, new.dog_id));
  end loop;
  return new;
end $$;

-- Undoing a check-in takes back the step's notification, whether its link names the dog (sent after this
-- migration) or not (sent before it) (…_path_undo.sql).
create or replace function public.rewind_paths() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  st record;
  total int;
begin
  for st in
    select ds.path_id, ds.position, d.next_step, d.completed_at
    from public.dog_path_steps ds join public.dog_paths d on d.dog_id = ds.dog_id and d.path_id = ds.path_id
    where ds.booking_id = new.id
  loop
    if st.next_step <> st.position + 1 then continue; end if;   -- a later step is done too
    select count(*) into total from public.path_steps where path_id = st.path_id;
    delete from public.dog_path_steps where dog_id = new.dog_id and path_id = st.path_id and position = st.position;
    update public.dog_paths set next_step = st.position, completed_at = null where dog_id = new.dog_id and path_id = st.path_id;
    delete from public.notifications where id = (
      select n.id from public.notifications n join public.training_paths tp on tp.id = st.path_id
      where n.member_id = new.member_id and n.kind = 'path_step' and n.href in ('/goal/' || st.path_id, public.dog_href('/goal/' || st.path_id, new.dog_id))
        and n.title = case when st.completed_at is not null then tp.title || ' is complete' else 'Step ' || st.position || ' of ' || total || ' done' end
      order by n.created_at desc limit 1);
  end loop;
  return new;
end $$;

-- Vet record approved or denied (…_vet_record_reviews.sql).
create or replace function public.admin_decide_vet_record(p_dog uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  dog public.dogs;
  path text;
begin
  perform public.admin_check();
  select * into dog from public.dogs where id = p_dog;
  if not found then raise exception 'not_found'; end if;
  select max(document_path) into path from public.vaccinations where dog_id = p_dog;
  if path is null then raise exception 'not_found'; end if;
  if not p_approve and length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'needs_reason'; end if;
  if p_approve and (select count(*) from public.vaccinations where dog_id = p_dog) < 3 then raise exception 'incomplete'; end if;

  update public.vaccinations set verified = p_approve where dog_id = p_dog;
  insert into public.vet_record_reviews (dog_id, status, reason, document_path, decided_at, decided_by)
  values (p_dog, case when p_approve then 'approved' else 'denied' end, case when p_approve then null else trim(p_reason) end, path, now(), auth.uid())
  on conflict (dog_id) do update set status = excluded.status, reason = excluded.reason, document_path = excluded.document_path,
                                      decided_at = excluded.decided_at, decided_by = excluded.decided_by;

  insert into public.notifications (member_id, category, kind, title, body, href)
  values (dog.owner_id, 'clearances',
          case when p_approve then 'records_approved' else 'records_denied' end,
          case when p_approve then dog.name || '''s vet records are approved' else dog.name || '''s vet records need another look' end,
          case when p_approve then 'PackPass checked the vaccine record. Partners see it was checked.' else trim(p_reason) end,
          public.dog_href(case when p_approve then '/vaccines' else '/onboarding/records-denied' end, p_dog));
end $$;
