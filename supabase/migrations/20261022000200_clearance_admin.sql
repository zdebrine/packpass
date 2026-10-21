-- PackPass manages clearances (PackPass › Clearances): creates them, writes the rubric a trainer scores, sets
-- the training paths that lead to them, and decides in Review which clearance a class requires or grants.

-- ---- Rubric --------------------------------------------------------------------------------------------
-- What a trainer checks during the assessment. A dog clears when every required item passes.
create table public.clearance_criteria (
  clearance_id text not null references public.clearance_types (id) on delete cascade,
  position int not null check (position > 0),
  label text not null check (length(trim(label)) > 0),
  required boolean not null default true,
  primary key (clearance_id, position)
);
alter table public.clearance_criteria enable row level security;
create policy "clearance_criteria: read" on public.clearance_criteria for select to authenticated using (true);

-- A retired clearance can't be granted any more; dogs that hold it keep it until it expires.
create function public.clearances_type_active() returns trigger language plpgsql set search_path = public as $$
begin
  if (select status from public.clearance_types where id = new.type) = 'retired' then
    raise exception 'clearance_retired';
  end if;
  return new;
end $$;
create trigger clearances_type_active before insert on public.clearances
  for each row execute function public.clearances_type_active();
revoke execute on function public.clearances_type_active from public, anon, authenticated;

-- ---- Clearances ----------------------------------------------------------------------------------------
-- Every clearance, drafts too, with its rubric, paths and how much uses it.
create function public.admin_clearance_types()
returns table (id text, name text, description text, scope public.clearance_scope, expiry_months int,
               group_also_requires text, status text, criteria jsonb, paths jsonb, requiring_classes int,
               granting_classes int, dogs_cleared int)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_check();
  return query
  select k.id, k.name, k.description, k.scope, k.expiry_months, k.group_also_requires, k.status,
         coalesce((select jsonb_agg(jsonb_build_object('label', c.label, 'required', c.required) order by c.position)
                   from public.clearance_criteria c where c.clearance_id = k.id), '[]'),
         coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title) order by p.title)
                   from public.training_paths p where p.grants = k.id), '[]'),
         (select count(*)::int from public.class_types c where c.requires = k.id),
         (select count(*)::int from public.class_types c where c.grants = k.id),
         (select count(distinct x.dog_id)::int from public.clearances x
          where x.type = k.id and (x.expires_on is null or x.expires_on >= current_date))
  from public.clearance_types k
  order by k.position, k.name;
end $$;

-- Creates (no id) or edits a clearance, rubric included. Returns its id. Scope is fixed once a dog holds it,
-- since each granted clearance keeps the scope it was granted with.
create function public.admin_save_clearance(p jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  k public.clearance_types;
  cid text := nullif(p ->> 'id', '');
  nm text := nullif(trim(coalesce(p ->> 'name', '')), '');
  also text := nullif(p ->> 'group_also_requires', '');
begin
  perform public.admin_check();
  if nm is null then raise exception 'name_required'; end if;
  if cid is null then
    cid := trim(both '-' from regexp_replace(lower(nm), '[^a-z0-9]+', '-', 'g'));
    if cid !~ '^[a-z]' then cid := 'c-' || cid; end if;
    if exists (select 1 from public.clearance_types where id = cid) then raise exception 'name_taken'; end if;
    insert into public.clearance_types (id, name, scope, status, position)
    values (cid, nm, coalesce(p ->> 'scope', 'network')::public.clearance_scope, 'draft',
            (select coalesce(max(position), 0) + 1 from public.clearance_types));
  end if;
  select * into k from public.clearance_types where id = cid for update;
  if not found then raise exception 'not_found'; end if;
  if p ? 'scope' and (p ->> 'scope')::public.clearance_scope <> k.scope
     and exists (select 1 from public.clearances where type = cid) then
    raise exception 'scope_locked';
  end if;
  if also = cid then raise exception 'invalid_group_requirement'; end if;
  update public.clearance_types set
    name = nm,
    description = coalesce(p ->> 'description', description),
    scope = coalesce((p ->> 'scope')::public.clearance_scope, scope),
    expiry_months = coalesce((p ->> 'expiry_months')::int, expiry_months),
    group_also_requires = case when p ? 'group_also_requires' then also else group_also_requires end,
    status = coalesce(p ->> 'status', status)
  where id = cid;
  if p ? 'criteria' then
    delete from public.clearance_criteria where clearance_id = cid;
    insert into public.clearance_criteria (clearance_id, position, label, required)
    select cid, row_number() over (order by o), trim(x ->> 'label'), coalesce((x ->> 'required')::boolean, true)
    from jsonb_array_elements(p -> 'criteria') with ordinality as t(x, o)
    where length(trim(coalesce(x ->> 'label', ''))) > 0;
  end if;
  return cid;
end $$;

-- PackPass sets what a class requires (any session but an assessment) or grants (assessments only).
create function public.admin_set_class_clearance(p_class text, p_requires text, p_grants text)
returns void language plpgsql security definer set search_path = public as $$
declare
  c public.class_types;
begin
  perform public.admin_check();
  select * into c from public.class_types where id = p_class for update;
  if not found then raise exception 'not_found'; end if;
  update public.class_types set
    requires = case when c.session_type = 'assessment' then null else nullif(p_requires, '') end,
    grants = case when c.session_type = 'assessment' then nullif(p_grants, '') else null end
  where id = p_class;
end $$;

-- ---- Training paths ------------------------------------------------------------------------------------
-- Creates (no id) or edits a path toward a clearance. Steps ([{title, class_id}]) can be replaced only until a
-- dog starts the path, since progress is kept by step; after that only the wording changes. Each step's own
-- class starts as a Path class for it.
create function public.admin_save_path(p jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  pid text := nullif(p ->> 'id', '');
  ttl text := nullif(trim(coalesce(p ->> 'title', '')), '');
  steps jsonb := p -> 'steps';
  started boolean;
  same boolean;
begin
  perform public.admin_check();
  if ttl is null then raise exception 'title_required'; end if;
  if pid is null then
    pid := trim(both '-' from regexp_replace(lower(ttl), '[^a-z0-9]+', '-', 'g'));
    if exists (select 1 from public.training_paths where id = pid) then raise exception 'name_taken'; end if;
    insert into public.training_paths (id, title, lede) values (pid, ttl, '');
  elsif not exists (select 1 from public.training_paths where id = pid) then
    raise exception 'not_found';
  end if;
  update public.training_paths set title = ttl, lede = coalesce(p ->> 'lede', lede),
    grants = case when p ? 'grants' then nullif(p ->> 'grants', '') else grants end
  where id = pid;

  if steps is null then return pid; end if;
  if jsonb_array_length(steps) = 0 then raise exception 'steps_required'; end if;
  if exists (select 1 from jsonb_array_elements(steps) x where length(trim(coalesce(x ->> 'title', ''))) = 0) then
    raise exception 'step_title_required';
  end if;
  if exists (select 1 from jsonb_array_elements(steps) x where not exists (select 1 from public.class_types c where c.id = x ->> 'class_id')) then
    raise exception 'step_class_required';
  end if;
  started := exists (select 1 from public.dog_paths where path_id = pid);
  same := (select coalesce(jsonb_agg(ps.class_id order by ps.position), '[]') from public.path_steps ps where ps.path_id = pid)
          = (select jsonb_agg(x ->> 'class_id' order by o) from jsonb_array_elements(steps) with ordinality t(x, o));
  if same then
    update public.path_steps ps set title = trim(x ->> 'title')
    from jsonb_array_elements(steps) with ordinality t(x, o)
    where ps.path_id = pid and ps.position = o;
  elsif started then
    raise exception 'path_in_use';
  else
    delete from public.path_steps where path_id = pid;
    insert into public.path_steps (path_id, position, title, class_id)
    select pid, o, trim(x ->> 'title'), x ->> 'class_id' from jsonb_array_elements(steps) with ordinality t(x, o);
    insert into public.path_step_classes (path_id, position, class_id)
    select path_id, position, class_id from public.path_steps where path_id = pid;
  end if;
  return pid;
end $$;

-- Every training path with its steps, for PackPass › Clearances.
create function public.admin_training_paths()
returns table (id text, title text, lede text, grants text, started int, steps jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_check();
  return query
  select p.id, p.title, p.lede, p.grants, (select count(*)::int from public.dog_paths d where d.path_id = p.id),
         coalesce((select jsonb_agg(jsonb_build_object('title', s.title, 'class_id', s.class_id) order by s.position)
                   from public.path_steps s where s.path_id = p.id), '[]')
  from public.training_paths p
  order by p.title;
end $$;

-- Every class, any partner or status, for picking a path step's class.
create function public.admin_class_options()
returns table (id text, title text, partner_name text, session_type public.session_type, grants text, status text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_check();
  return query
  select c.id, c.title, p.name, c.session_type, c.grants, c.status
  from public.class_types c join public.partners p on p.id = c.partner_id
  order by p.name, c.title;
end $$;

revoke execute on function public.admin_clearance_types, public.admin_save_clearance, public.admin_set_class_clearance,
  public.admin_save_path, public.admin_training_paths, public.admin_class_options from public, anon;
grant execute on function public.admin_clearance_types, public.admin_save_clearance, public.admin_set_class_clearance,
  public.admin_save_path, public.admin_training_paths, public.admin_class_options to authenticated;
