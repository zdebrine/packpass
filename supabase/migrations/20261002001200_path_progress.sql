-- Training path progress. A step is done when the dog is checked in to that step's class while it's the
-- step the dog is on (by the member's QR scan or by the partner). A session note counts as being there too.
-- Steps that are assessments (the class grants a clearance) only finish with a pass, which
-- record_assessment already handles by completing the path.

create table public.dog_path_steps (
  dog_id uuid not null references public.dogs (id) on delete cascade,
  path_id text not null references public.training_paths (id),
  position int not null,
  booking_id uuid references public.bookings (id) on delete set null,
  done_at timestamptz not null default now(),
  primary key (dog_id, path_id, position)
);
create index on public.dog_path_steps (booking_id);
create index on public.dog_path_steps (path_id);
alter table public.dog_path_steps enable row level security;
create policy "dog_path_steps: read own" on public.dog_path_steps for select to authenticated using ((select public.owns_dog(dog_id)));

-- Moves each of the dog's paths on by one step when the checked-in class is its current step.
create function public.advance_paths() returns trigger
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
            '/goal/' || dp.path_id);
  end loop;
  return new;
end $$;
revoke execute on function public.advance_paths from public, anon, authenticated;

create trigger bookings_advance_paths after update of status on public.bookings
for each row when (new.status = 'checked_in' and old.status is distinct from 'checked_in')
execute function public.advance_paths();

-- A note from the trainer means the dog was there: a booking still marked "booked" after the start is
-- checked in, which moves its path on.
create function public.note_checks_in() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.bookings b set status = 'checked_in', checked_in_at = coalesce(b.checked_in_at, s.starts_at)
  from public.sessions s
  where b.id = new.booking_id and s.id = b.session_id and b.status = 'booked' and s.starts_at <= now();
  return new;
end $$;
revoke execute on function public.note_checks_in from public, anon, authenticated;
create trigger session_notes_check_in after insert on public.session_notes for each row execute function public.note_checks_in();

-- Every path, with this dog's progress on it (null columns when the dog hasn't started it) and the
-- date each step was done.
create function public.my_paths(p_dog uuid)
returns table (path_id text, title text, lede text, grants public.clearance_type, started_at timestamptz,
               next_step int, completed_at timestamptz, steps jsonb)
language sql stable security definer set search_path = public as $$
  select tp.id, tp.title, tp.lede, tp.grants, dp.started_at, dp.next_step, dp.completed_at,
         (select jsonb_agg(jsonb_build_object('position', ps.position, 'title', ps.title, 'class_id', ps.class_id, 'done_at', st.done_at)
                           order by ps.position)
          from public.path_steps ps
          left join public.dog_path_steps st on st.dog_id = p_dog and st.path_id = ps.path_id and st.position = ps.position
          where ps.path_id = tp.id)
  from public.training_paths tp
  left join public.dog_paths dp on dp.path_id = tp.id and dp.dog_id = p_dog
  where public.owns_dog(p_dog)
  order by dp.started_at is null, dp.completed_at is not null, tp.title
$$;
revoke execute on function public.my_paths from public, anon;
grant execute on function public.my_paths to authenticated;

-- Path steps are pushed too.
create or replace function public.push_kind(k text) returns boolean language sql immutable set search_path = public as $$
  select k in ('hold_expiring', 'holds_released', 'clearance_earned', 'waitlist_booked', 'waitlist_open', 'waitlist_missed',
               'session_cancelled', 'session_note', 'assessment_result', 'path_step')
$$;
