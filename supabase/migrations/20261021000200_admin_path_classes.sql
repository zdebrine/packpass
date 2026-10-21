-- PackPass, not partners, decides which classes are Path classes (…_path_classes.sql). Partners create a class;
-- PackPass marks it for a training-path step when it reviews the class (PackPass › Review), or later on
-- PackPass › Paths.

drop function public.partner_set_path_steps(text, jsonb);

-- Marks a class as a Path class for the given steps ([{path_id, position}]), or none with an empty list.
-- Assessments can't be Path classes (passing one finishes the path on its own), and neither can a path's
-- assessment step.
create function public.admin_set_path_steps(p_class text, p_steps jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  c public.class_types;
begin
  perform public.admin_check();
  select * into c from public.class_types where id = p_class;
  if not found then raise exception 'not_found'; end if;
  delete from public.path_step_classes where class_id = p_class;
  if c.session_type = 'assessment' then return; end if;
  insert into public.path_step_classes (path_id, position, class_id)
  select ps.path_id, ps.position, p_class
  from jsonb_array_elements(coalesce(p_steps, '[]')) x
  join public.path_steps ps on ps.path_id = x ->> 'path_id' and ps.position = (x ->> 'position')::int
  join public.class_types k on k.id = ps.class_id
  where k.grants is null
  on conflict do nothing;
end $$;

-- Every class that could be a Path class (any partner, any status; not assessments), with the steps it counts
-- for, for PackPass › Paths and the review queue.
create function public.admin_path_classes()
returns table (id text, title text, partner_name text, status text, session_type public.session_type, group_size int,
               min_age_months int, max_age_months int, requires public.clearance_type, steps jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_check();
  return query
  select c.id, c.title, p.name, c.status, c.session_type, c.group_size, c.min_age_months, c.max_age_months, c.requires,
         coalesce((select jsonb_agg(jsonb_build_object('path_id', x.path_id, 'position', x.position) order by x.path_id, x.position)
                   from public.path_step_classes x where x.class_id = c.id), '[]')
  from public.class_types c join public.partners p on p.id = c.partner_id
  where c.session_type <> 'assessment'
  order by p.name, c.title;
end $$;

revoke execute on function public.admin_set_path_steps, public.admin_path_classes from public, anon;
grant execute on function public.admin_set_path_steps, public.admin_path_classes to authenticated;
