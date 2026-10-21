-- Clearances become data. Until now Social and Herding were a Postgres enum, so adding a clearance meant a
-- migration and app changes. They're now rows in clearance_types, which PackPass will manage from the admin
-- dashboard. Social and Herding keep their ids ('social', 'herding') and today's settings, so every clearance,
-- assessment, class and path a dog already has carries over unchanged.

create table public.clearance_types (
  id text primary key check (id ~ '^[a-z][a-z0-9-]*$'),
  name text not null,
  description text not null default '',
  -- network: every partner honours it; partner: only the partner that granted it.
  scope public.clearance_scope not null,
  -- How long it lasts after an assessment.
  expiry_months int not null default 12 check (expiry_months between 1 and 120),
  -- Group classes (more than one dog) that need this clearance also need this one; Herding needs Social.
  group_also_requires text references public.clearance_types (id),
  -- draft: only PackPass sees it. retired: no new grants, existing clearances run to expiry.
  status text not null default 'active' check (status in ('draft', 'active', 'retired')),
  position int not null default 0,
  created_at timestamptz not null default now(),
  check (group_also_requires is distinct from id)
);
alter table public.clearance_types enable row level security;
create policy "clearance_types: read" on public.clearance_types for select to anon, authenticated using (status <> 'draft');

insert into public.clearance_types (id, name, description, scope, expiry_months, group_also_requires, position) values
  ('social', 'Social', 'Comfortable around other dogs in a group. Honoured by every PackPass partner.', 'network', 12, null, 1),
  ('herding', 'Herding', 'Safe to work livestock with this partner.', 'partner', 12, 'social', 2);

-- Every function whose arguments or results used the enum is dropped and re-created below with text.
drop function public.admin_clearances();
drop function public.admin_path_classes();
drop function public.admin_review_queue();
drop function public.flag_reassessment(uuid, public.clearance_type, text, boolean);
drop function public.has_clearance(uuid, public.clearance_type, text, date);
drop function public.my_log(integer);
drop function public.my_paths(uuid);
drop function public.partner_assessments();
drop function public.partner_save_class(text, jsonb);
drop function public.record_assessment(uuid, public.clearance_type, text, text, public.assessment_outcome, text[], text[], text, uuid);

alter table public.class_types
  alter column requires type text using requires::text,
  alter column grants type text using grants::text,
  add constraint class_types_requires_fkey foreign key (requires) references public.clearance_types (id),
  add constraint class_types_grants_fkey foreign key (grants) references public.clearance_types (id);
alter table public.clearances
  alter column type type text using type::text,
  add constraint clearances_type_fkey foreign key (type) references public.clearance_types (id);
alter table public.assessments
  alter column type type text using type::text,
  add constraint assessments_type_fkey foreign key (type) references public.clearance_types (id);
alter table public.training_paths
  alter column grants type text using grants::text,
  add constraint training_paths_grants_fkey foreign key (grants) references public.clearance_types (id);

drop type public.clearance_type;

create function public.admin_clearances()
 RETURNS TABLE(dog_id uuid, dog_name text, breed text, owner_name text, type text, partner_name text, assessed_on date, expires_on date, reassess_at timestamp with time zone, reassess_reason text, reassess_by text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

create function public.admin_path_classes()
 RETURNS TABLE(id text, title text, partner_name text, status text, session_type session_type, group_size integer, min_age_months integer, max_age_months integer, requires text, steps jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.admin_check();
  return query
  select c.id, c.title, p.name, c.status, c.session_type, c.group_size, c.min_age_months, c.max_age_months, c.requires,
         coalesce((select jsonb_agg(jsonb_build_object('path_id', x.path_id, 'position', x.position) order by x.path_id, x.position)
                   from public.path_step_classes x where x.class_id = c.id), '[]')
  from public.class_types c join public.partners p on p.id = c.partner_id
  where c.session_type <> 'assessment'
  order by p.name, c.title;
end $function$
;

create function public.admin_review_queue()
 RETURNS TABLE(id text, partner_id text, partner_name text, trainer_name text, title text, discipline text, session_type session_type, duration_min integer, intensity integer, group_size integer, credits integer, premium boolean, status text, credit_review boolean, description text, image text, energy text[], sociability text[], requires text, grants text, built_for aptitude[], breed_only_reason text, breed_only_status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.admin_check();
  return query
  select c.id, c.partner_id, p.name, t.name, c.title, c.discipline, c.session_type, c.duration_min, c.intensity, c.group_size,
         c.credits, c.premium, c.status, c.credit_review, c.description, c.image, c.energy, c.sociability, c.requires, c.grants,
         c.built_for, c.breed_only_reason, c.breed_only_status
  from public.class_types c join public.partners p on p.id = c.partner_id left join public.trainers t on t.id = c.trainer_id
  where c.status = 'in_review' or c.credit_review or c.breed_only_status = 'pending'
  order by c.status = 'in_review' desc, p.name, c.title;
end $function$
;

create function public.flag_reassessment(p_dog uuid, p_type text, p_reason text, p_undo boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and (admin or k.scope = 'network' or k.partner_id = me);
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
    and (admin or k.scope = 'network' or k.partner_id = me);
  get diagnostics n = row_count;
  if n = 0 then raise exception 'not_found'; end if;

  select d.owner_id, d.name into owner, dog_name from public.dogs d where d.id = p_dog;
  insert into public.notifications (member_id, category, kind, title, body, href)
  values (owner, 'clearances', 'reassessment',
          dog_name || ' needs a ' || (select name from public.clearance_types where id = p_type) || ' re-assessment',
          why || ' · ' || who,
          public.dog_href('/passport/' || p_type, p_dog));
  return n;
end $function$
;

create function public.has_clearance(p_dog uuid, p_type text, p_partner text, p_on date)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.clearances c
    where c.dog_id = p_dog and c.type = p_type
      and (c.expires_on is null or c.expires_on >= p_on)
      and (c.scope = 'network' or c.partner_id = p_partner)
  )
$function$
;

create function public.my_log(p_months integer DEFAULT 6)
 RETURNS TABLE(booking_id uuid, dog_id uuid, starts_at timestamp with time zone, duration_min integer, class_id text, title text, image text, balance balance_category, session_type session_type, partner_name text, trainer_name text, note text, skills text[], note_by text, assessed text, outcome assessment_outcome, quote text, strengths text[], working_on text[], assessor text, missed boolean, credits integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

create function public.my_paths(p_dog uuid)
 RETURNS TABLE(path_id text, title text, lede text, grants text, started_at timestamp with time zone, next_step integer, completed_at timestamp with time zone, steps jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select tp.id, tp.title, tp.lede, tp.grants, dp.started_at, dp.next_step, dp.completed_at,
         (select jsonb_agg(jsonb_build_object('position', ps.position, 'title', ps.title,
                                              'class_id', coalesce(o.options ->> 0, ps.class_id),
                                              'options', o.options, 'done_at', st.done_at)
                           order by ps.position)
          from public.path_steps ps
          cross join lateral (
            select coalesce(jsonb_agg(k.id order by k.id <> ps.class_id, k.title), '[]') options
            from public.path_step_classes x join public.class_types k on k.id = x.class_id
            where x.path_id = ps.path_id and x.position = ps.position and k.status = 'live'
              and public.class_gate(p_dog, k, (now() at time zone 'America/Chicago')::date) is null
          ) o
          left join public.dog_path_steps st on st.dog_id = p_dog and st.path_id = ps.path_id and st.position = ps.position
          where ps.path_id = tp.id)
  from public.training_paths tp
  left join public.dog_paths dp on dp.path_id = tp.id and dp.dog_id = p_dog
  where public.owns_dog(p_dog)
  order by dp.started_at is null, dp.completed_at is not null, tp.title
$function$
;

create function public.partner_assessments()
 RETURNS TABLE(booking_id uuid, starts_at timestamp with time zone, class_title text, grants text, duration_min integer, dog_id uuid, dog_name text, breed text, owner_name text, photo_path text, traits text[], clearances text[], outcome assessment_outcome, strengths text[], working_on text[], quote text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select b.id, s.starts_at, c.title, c.grants, c.duration_min, d.id, d.name, d.breed, p.name, d.photo_path, d.traits,
         array(select (select t.name from public.clearance_types t where t.id = k.type) || case when k.reassess_at is not null then ' · re-assess: ' || k.reassess_reason
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
$function$
;

create function public.partner_save_class(p_id text, p jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me text := public.staff_partner();
  c public.class_types;
  new_id text;
  st public.session_type := coalesce(nullif(p ->> 'session_type', ''), 'class')::public.session_type;
  grp int := case when coalesce(nullif(p ->> 'session_type', ''), 'class') = 'class' then greatest(2, (p ->> 'group_size')::int) else 1 end;
begin
  if length(trim(coalesce(p ->> 'title', ''))) < 3 then raise exception 'bad_title'; end if;
  if p_id is null then
    new_id := me || '-' || trim(both '-' from regexp_replace(lower(p ->> 'title'), '[^a-z0-9]+', '-', 'g'));
    if exists (select 1 from public.class_types where id = new_id) then new_id := new_id || '-' || substr(md5(random()::text), 1, 4); end if;
    insert into public.class_types (id, partner_id, trainer_id, title, discipline, category, session_type, credits, duration_min,
      intensity, group_size, suits, suits_note, balance, description, image, requires, grants, requirements, status, energy, sociability, drop_off,
      min_age_months, max_age_months, min_weight_lb, max_weight_lb, requires_fixed, built_for)
    values (new_id, me, nullif(p ->> 'trainer_id', ''), trim(p ->> 'title'), p ->> 'discipline', (p ->> 'category')::public.class_category,
      st, null, (p ->> 'duration_min')::int, (p ->> 'intensity')::int, grp, p ->> 'suits', p ->> 'suits_note',
      (p ->> 'balance')::public.balance_category, p ->> 'description', p ->> 'image',
      case when st = 'assessment' then null else nullif(p ->> 'clearance', '') end,
      case when st = 'assessment' then nullif(p ->> 'clearance', '') else null end,
      coalesce(p -> 'requirements', '[]'), 'in_review',
      coalesce(array(select jsonb_array_elements_text(p -> 'energy')), '{}'), coalesce(array(select jsonb_array_elements_text(p -> 'sociability')), '{}'),
      st = 'class' and coalesce((p ->> 'drop_off')::boolean, false),
      nullif(p ->> 'min_age_months', '')::int, nullif(p ->> 'max_age_months', '')::int,
      nullif(p ->> 'min_weight_lb', '')::int, nullif(p ->> 'max_weight_lb', '')::int, coalesce((p ->> 'requires_fixed')::boolean, false),
      coalesce(array(select jsonb_array_elements_text(p -> 'built_for'))::public.aptitude[], '{}'));
    return new_id;
  end if;

  select * into c from public.class_types where id = p_id and partner_id = me for update;
  if not found then raise exception 'not_found'; end if;
  update public.class_types set
    title = trim(p ->> 'title'), discipline = p ->> 'discipline', category = (p ->> 'category')::public.class_category,
    session_type = st, duration_min = (p ->> 'duration_min')::int, intensity = (p ->> 'intensity')::int, group_size = grp,
    suits = p ->> 'suits', suits_note = p ->> 'suits_note', description = p ->> 'description', image = coalesce(p ->> 'image', image),
    trainer_id = coalesce(nullif(p ->> 'trainer_id', ''), trainer_id),
    requires = case when st = 'assessment' then null else nullif(p ->> 'clearance', '') end,
    grants = case when st = 'assessment' then nullif(p ->> 'clearance', '') else null end,
    requirements = coalesce(p -> 'requirements', requirements),
    energy = coalesce(array(select jsonb_array_elements_text(p -> 'energy')), energy),
    sociability = coalesce(array(select jsonb_array_elements_text(p -> 'sociability')), sociability),
    drop_off = st = 'class' and coalesce((p ->> 'drop_off')::boolean, drop_off),
    min_age_months = case when p ? 'min_age_months' then nullif(p ->> 'min_age_months', '')::int else min_age_months end,
    max_age_months = case when p ? 'max_age_months' then nullif(p ->> 'max_age_months', '')::int else max_age_months end,
    min_weight_lb = case when p ? 'min_weight_lb' then nullif(p ->> 'min_weight_lb', '')::int else min_weight_lb end,
    max_weight_lb = case when p ? 'max_weight_lb' then nullif(p ->> 'max_weight_lb', '')::int else max_weight_lb end,
    requires_fixed = coalesce((p ->> 'requires_fixed')::boolean, requires_fixed),
    built_for = case when p ? 'built_for' then array(select jsonb_array_elements_text(p -> 'built_for'))::public.aptitude[] else built_for end,
    credit_review = credit_review or (status = 'live' and (c.duration_min <> (p ->> 'duration_min')::int
      or c.intensity <> (p ->> 'intensity')::int or c.group_size <> grp or c.session_type <> st))
  where id = p_id;
  return p_id;
end $function$
;

create function public.record_assessment(p_dog uuid, p_type text, p_partner text, p_assessor text, p_outcome assessment_outcome, p_strengths text[] DEFAULT '{}'::text[], p_working text[] DEFAULT '{}'::text[], p_quote text DEFAULT NULL::text, p_booking uuid DEFAULT NULL::uuid)
 RETURNS assessments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  k public.clearance_types;
  a public.assessments;
  owner uuid;
  dog_name text;
  released int;
begin
  select * into k from public.clearance_types where id = p_type;
  if not found then raise exception 'not_found'; end if;
  select owner_id, name into owner, dog_name from public.dogs where id = p_dog;
  insert into public.assessments (dog_id, booking_id, type, partner_id, assessor, outcome, assessed_on, strengths, working_on, quote)
  values (p_dog, p_booking, p_type, p_partner, p_assessor, p_outcome, current_date, p_strengths, p_working, p_quote)
  returning * into a;

  if p_outcome = 'cleared' then
    insert into public.clearances (dog_id, type, scope, partner_id, assessed_on, expires_on, assessor, strengths, working_on, quote)
    values (p_dog, p_type, k.scope, p_partner, current_date,
            (current_date + make_interval(months => k.expiry_months))::date, p_assessor, p_strengths, p_working, p_quote);
    update public.dog_paths dp set completed_at = now(), next_step = (select count(*) + 1 from public.path_steps ps where ps.path_id = dp.path_id)
    where dp.dog_id = p_dog and dp.completed_at is null
      and dp.path_id in (select id from public.training_paths where grants = p_type);
    insert into public.notifications (member_id, category, kind, title, body, href)
    values (owner, 'clearances', 'clearance_earned',
            dog_name || ' is ' || k.name || ' cleared.',
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
end $function$
;


-- Booking: the clearance a class requires, then (for group classes) the one that clearance also needs. A dog
-- on a training path toward the missing clearance can still book that path's Path classes.
create or replace function public.booking_block(p_dog uuid, p_session uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  s public.sessions;
  c public.class_types;
  on_day date;
  gate text;
  need text;
begin
  select * into s from public.sessions where id = p_session;
  if not found then raise exception 'not_found'; end if;
  select * into c from public.class_types where id = s.class_id;
  on_day := (s.starts_at at time zone 'America/Chicago')::date;

  if s.cancelled_at is not null then return 'cancelled'; end if;
  if s.starts_at <= now() then return 'started'; end if;
  if c.grants is not null and public.has_clearance(p_dog, c.grants, c.partner_id, on_day) then
    return 'already_cleared';
  end if;
  gate := public.class_gate(p_dog, c, on_day);
  if gate is not null then return gate; end if;
  for need in
    select c.requires where c.requires is not null
    union all
    select k.group_also_requires from public.clearance_types k
    where k.id = c.requires and k.group_also_requires is not null and c.session_type = 'class' and c.group_size > 1
  loop
    if not public.has_clearance(p_dog, need, c.partner_id, on_day)
       and not exists (select 1 from public.dog_paths dp
                       join public.training_paths tp on tp.id = dp.path_id and tp.grants = need
                       join public.path_step_classes x on x.path_id = dp.path_id
                       where dp.dog_id = p_dog and dp.completed_at is null and x.class_id = c.id) then
      return 'needs_' || need;
    end if;
  end loop;
  if exists (select 1 from public.vet_record_reviews r where r.dog_id = p_dog and r.status = 'denied') then
    return 'records_denied';
  end if;
  if (select count(*) from public.vaccinations v
      where v.dog_id = p_dog and v.expires_on >= on_day) < 3 then
    return 'vaccines';
  end if;
  return null;
end $$;

revoke execute on function public.has_clearance, public.record_assessment from public, anon, authenticated;
revoke execute on function public.admin_clearances, public.admin_path_classes, public.admin_review_queue,
  public.flag_reassessment, public.my_log, public.my_paths, public.partner_assessments, public.partner_save_class
  from public, anon;
grant execute on function public.admin_clearances, public.admin_path_classes, public.admin_review_queue,
  public.flag_reassessment, public.my_log, public.my_paths, public.partner_assessments, public.partner_save_class
  to authenticated;
