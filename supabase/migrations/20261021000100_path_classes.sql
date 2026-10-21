-- Path classes, and Social only where the class asks for it.
--
-- 1. A Path class is one that counts for a step of a training path (Calm around dogs leads to the Social
--    clearance). Each path step had exactly one class (path_steps.class_id), so a dog that couldn't book that
--    class (a seniors-only Small-group play, say) was stuck on the step. Partners now mark any of their classes
--    as a Path class for a step; the step is done when the dog checks in to any of them, a dog on the path can
--    book them before it has Social, and my_paths lists the ones the dog can actually join.
--
-- 2. booking_block asked every group class for a Social clearance, even when the partner set its clearance to
--    None ("Any dog with current vaccines can book" in the class editor). Now a class needs Social only when
--    `requires` says so. The catalog's group classes were saved with `requires` null and relied on the old
--    rule, so they're set to Social here and keep working as before. Herding group classes still need Social
--    as well as Herding, as they did.

-- ---- Path classes ---------------------------------------------------------------------------------------

create table public.path_step_classes (
  path_id text not null,
  position int not null,
  class_id text not null references public.class_types (id) on delete cascade,
  primary key (path_id, position, class_id),
  foreign key (path_id, position) references public.path_steps (path_id, position) on delete cascade
);
create index on public.path_step_classes (class_id);
alter table public.path_step_classes enable row level security;
create policy "path_step_classes: read" on public.path_step_classes for select to anon, authenticated using (true);

-- Every step's own class is a Path class for it to start with.
insert into public.path_step_classes (path_id, position, class_id)
select path_id, position, class_id from public.path_steps
on conflict do nothing;

-- The partner marks one of its classes as a Path class for the given steps ([{path_id, position}]), or none
-- with an empty list. Assessments can't be Path classes (passing one finishes the path on its own), and
-- neither can a path's assessment step.
create function public.partner_set_path_steps(p_class text, p_steps jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  me text := public.staff_partner();
  c public.class_types;
begin
  select * into c from public.class_types where id = p_class and partner_id = me;
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
revoke execute on function public.partner_set_path_steps from public, anon;
grant execute on function public.partner_set_path_steps to authenticated;

-- A class a dog on an unfinished path can book before it has Social: any Path class on that path.
create or replace function public.on_active_path(p_dog uuid, p_class text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.dog_paths dp
    join public.path_step_classes x on x.path_id = dp.path_id
    where dp.dog_id = p_dog and dp.completed_at is null and x.class_id = p_class
  )
$$;

-- As before (…_multi_dog.sql), but checking in to any Path class for the step the dog is on finishes it.
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
    where d.dog_id = new.dog_id and d.completed_at is null
      and exists (select 1 from public.path_step_classes x where x.path_id = d.path_id and x.position = d.next_step and x.class_id = cls)
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

-- As before (…_path_progress.sql), plus each step's `options`: the live Path classes for it that the dog
-- passes the class's own gates for (age, size, breed, spayed or neutered) today, the step's own class first.
-- `class_id` is the first of them, or the step's own class when none fits.
create or replace function public.my_paths(p_dog uuid)
returns table (path_id text, title text, lede text, grants public.clearance_type, started_at timestamptz,
               next_step int, completed_at timestamptz, steps jsonb)
language sql stable security definer set search_path = public as $$
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
$$;

-- ---- Social only where the class asks for it ------------------------------------------------------------

update public.class_types set requires = 'social'
where requires is null and session_type = 'class' and group_size > 1
  and id in ('herding-fundamentals', 'agility-drop-in', 'lure-sprint', 'fitness', 'scent-work', 'open-field', 'free-roam',
             'puppy-social', 'senior-strength', 'small-group-play', 'focus-recall');

-- As before (…_already_cleared.sql), but Social is checked only for classes that require it (and Herding
-- group classes, as before). A dog on a path can still book that path's Path classes without it.
create or replace function public.booking_block(p_dog uuid, p_session uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  s public.sessions;
  c public.class_types;
  on_day date;
  gate text;
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
  if c.requires = 'herding' and not public.has_clearance(p_dog, 'herding', c.partner_id, on_day) then
    return 'needs_herding';
  end if;
  if (c.requires = 'social' or (c.requires = 'herding' and c.session_type = 'class' and c.group_size > 1))
     and not public.has_clearance(p_dog, 'social', c.partner_id, on_day)
     and not public.on_active_path(p_dog, c.id) then
    return 'needs_social';
  end if;
  if exists (select 1 from public.vet_record_reviews r where r.dog_id = p_dog and r.status = 'denied') then
    return 'records_denied';
  end if;
  if (select count(*) from public.vaccinations v
      where v.dog_id = p_dog and v.expires_on >= on_day) < 3 then
    return 'vaccines';
  end if;
  return null;
end $$;
