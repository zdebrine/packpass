-- PackPass › Log at home (uploads/LOG_AT_HOME_SPEC.md §9). Owners log walks, park trips, patio visits and
-- training between classes; each counts toward the dog's month at half the weight of a class (Zak, 2026-10-24).
--   skills, drills      the practice catalog, seeded from supabase/practice.sql (generated from the app's
--                       src/data/practice.ts). Everyone can read it.
--   home_activities     one row per dog per logged activity. Written through log_home_activity and friends.
--   dog_focus_skills    what each dog is working on: started from its traits and training paths, later from
--                       trainer notes, assessments and the owner's own picks.
--   dogs.practice_days  the weekly practice goal (days a week), and practice_remind for the off-day nudge.

create type public.home_activity_kind as enum ('walk', 'sniff', 'park', 'patio', 'out', 'train', 'play', 'puzzle', 'hike', 'alone', 'other');
create type public.practice_rating as enum ('tough', 'mixed', 'good');

create table public.skills (
  id text primary key,
  label text not null,
  balance public.balance_category not null,
  -- "A loose leash is what makes {dog} easy to bring to a patio." ({dog} is the dog's name.)
  why text not null,
  -- Trait ids (traits.id) that make this one of a dog's focus skills.
  traits text[] not null default '{}',
  path_id text references public.training_paths (id) on delete set null,
  class_ids text[] not null default '{}',
  -- Tags partners put on session notes for this skill ("Settle", "Gate wait").
  aliases text[] not null default '{}',
  trainer_led boolean not null default false,
  sort int not null default 0
);

create table public.drills (
  id text primary key,
  skill_id text not null references public.skills (id) on delete cascade,
  title text not null,
  minutes int not null check (minutes > 0),
  setting text not null,
  level text not null check (level in ('start', 'next', 'harder')),
  activity public.home_activity_kind not null,
  image text not null,
  goal text not null,
  needs text[] not null default '{}',
  steps text[] not null check (cardinality(steps) between 1 and 8),
  good text not null,
  stop_if text not null,
  sort int not null default 0,
  active boolean not null default true
);
create index drills_skill on public.drills (skill_id, sort);

alter table public.skills enable row level security;
alter table public.drills enable row level security;
create policy "skills: everyone reads" on public.skills for select using (true);
create policy "drills: everyone reads" on public.drills for select using (true);
grant select on public.skills, public.drills to anon, authenticated;

create table public.home_activities (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  dog_id uuid not null references public.dogs (id) on delete cascade,
  kind public.home_activity_kind not null,
  done_at timestamptz not null,
  duration_min int not null check (duration_min between 1 and 600),
  -- Null: Something else, with no balance picked (still an active day).
  balance public.balance_category,
  skills text[] not null default '{}',
  rating public.practice_rating,
  note text check (length(note) <= 280),
  photo_path text,
  drill_id text references public.drills (id) on delete set null,
  reps int check (reps >= 0),
  created_at timestamptz not null default now()
);
create index home_activities_dog on public.home_activities (dog_id, done_at desc);
create index home_activities_member on public.home_activities (member_id, done_at desc);
alter table public.home_activities enable row level security;
create policy "home_activities: read own" on public.home_activities for select using (member_id = (select auth.uid()));
grant select on public.home_activities to authenticated;

create table public.dog_focus_skills (
  dog_id uuid not null references public.dogs (id) on delete cascade,
  skill_id text not null references public.skills (id) on delete cascade,
  source text not null check (source in ('trait', 'path', 'note', 'assessment', 'owner')),
  added_at timestamptz not null default now(),
  -- The owner took it off. A removed skill isn't added back automatically.
  removed_at timestamptz,
  primary key (dog_id, skill_id)
);
alter table public.dog_focus_skills enable row level security;
create policy "dog_focus_skills: owner reads" on public.dog_focus_skills for select using (public.owns_dog(dog_id));
grant select on public.dog_focus_skills to authenticated;

alter table public.dogs
  add column practice_days int not null default 3 check (practice_days between 1 and 7),
  add column practice_remind text check (practice_remind in ('morning', 'after_work', 'evening'));

-- ---- Logging ----------------------------------------------------------------------------------------

-- The balance an activity counts toward unless the owner picks one (src/data/practice.ts ACTIVITIES).
create function public.activity_balance(k public.home_activity_kind) returns public.balance_category
language sql immutable set search_path = public as $$
  select case k when 'walk' then 'physical' when 'play' then 'physical' when 'hike' then 'physical'
                when 'park' then 'social' when 'patio' then 'social' when 'out' then 'social'
                when 'other' then null else 'mental' end::public.balance_category
$$;

-- Checks shared by logging and editing. Raises bad_time, bad_duration, bad_skill or bad_note.
create function public.check_home_activity(p_done_at timestamptz, p_duration int, p_skills text[], p_note text)
returns void language plpgsql stable set search_path = public as $$
begin
  if p_done_at is null or p_done_at > now() + interval '10 minutes' or p_done_at < now() - interval '1 year' then raise exception 'bad_time'; end if;
  if p_duration is null or p_duration not between 1 and 600 then raise exception 'bad_duration'; end if;
  if exists (select 1 from unnest(coalesce(p_skills, '{}')) s where not exists (select 1 from public.skills k where k.id = s)) then raise exception 'bad_skill'; end if;
  if length(p_note) > 280 then raise exception 'bad_note'; end if;
end $$;

-- Logs one activity for each picked dog (the Log activity sheet, §5.6). Returns the new rows' ids.
create function public.log_home_activity(
  p_dogs uuid[], p_kind public.home_activity_kind, p_done_at timestamptz, p_duration int,
  p_skills text[] default '{}', p_rating public.practice_rating default null, p_note text default null,
  p_balance public.balance_category default null, p_drill text default null, p_reps int default null)
returns setof uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  d uuid;
  rid uuid;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if coalesce(cardinality(p_dogs), 0) = 0 then raise exception 'no_dog'; end if;
  if exists (select 1 from unnest(p_dogs) x where not public.owns_dog(x)) then raise exception 'not_found'; end if;
  perform public.check_home_activity(p_done_at, p_duration, p_skills, p_note);
  if p_drill is not null and not exists (select 1 from public.drills where id = p_drill) then p_drill := null; end if;
  foreach d in array (select array_agg(distinct x order by x) from unnest(p_dogs) x) loop
    insert into public.home_activities (member_id, dog_id, kind, done_at, duration_min, balance, skills, rating, note, drill_id, reps)
    values (me, d, p_kind, p_done_at, p_duration, coalesce(p_balance, public.activity_balance(p_kind)),
            coalesce(p_skills, '{}'), p_rating, nullif(trim(p_note), ''), p_drill, p_reps)
    returning id into rid;
    return next rid;
  end loop;
end $$;
revoke execute on function public.log_home_activity from public, anon;
grant execute on function public.log_home_activity to authenticated;

-- The edit sheet (§5.7): every field again, for one row.
create function public.edit_home_activity(
  p_id uuid, p_kind public.home_activity_kind, p_done_at timestamptz, p_duration int,
  p_skills text[] default '{}', p_rating public.practice_rating default null, p_note text default null,
  p_balance public.balance_category default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.check_home_activity(p_done_at, p_duration, p_skills, p_note);
  update public.home_activities
  set kind = p_kind, done_at = p_done_at, duration_min = p_duration, balance = coalesce(p_balance, public.activity_balance(p_kind)),
      skills = coalesce(p_skills, '{}'), rating = p_rating, note = nullif(trim(p_note), '')
  where id = p_id and member_id = auth.uid();
  if not found then raise exception 'not_found'; end if;
end $$;
revoke execute on function public.edit_home_activity from public, anon;
grant execute on function public.edit_home_activity to authenticated;

create function public.delete_home_activity(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.home_activities where id = p_id and member_id = auth.uid();
  if not found then raise exception 'not_found'; end if;
end $$;
revoke execute on function public.delete_home_activity from public, anon;
grant execute on function public.delete_home_activity to authenticated;

-- The weekly goal sheet (§5.9).
create function public.set_practice_goal(p_dog uuid, p_days int, p_remind text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.owns_dog(p_dog) then raise exception 'not_found'; end if;
  if p_days is null or p_days not between 1 and 7 then raise exception 'bad_goal'; end if;
  if p_remind is not null and p_remind not in ('morning', 'after_work', 'evening') then raise exception 'bad_goal'; end if;
  update public.dogs set practice_days = p_days, practice_remind = p_remind where id = p_dog;
end $$;
revoke execute on function public.set_practice_goal from public, anon;
grant execute on function public.set_practice_goal to authenticated;

-- ---- Focus skills -----------------------------------------------------------------------------------

-- Adds the skills a dog's traits and active training paths point to. Skills the owner removed stay removed.
create function public.seed_focus_skills(p_dog uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.dog_focus_skills (dog_id, skill_id, source)
  select d.id, k.id, 'trait' from public.dogs d join public.skills k on k.traits && d.traits where d.id = p_dog
  union all
  select dp.dog_id, k.id, 'path' from public.dog_paths dp join public.skills k on k.path_id = dp.path_id
  where dp.dog_id = p_dog and dp.completed_at is null
  on conflict do nothing
$$;
revoke execute on function public.seed_focus_skills from public, anon, authenticated;

create function public.focus_from_dog() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_focus_skills(new.id);
  return new;
end $$;
create function public.focus_from_path() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_focus_skills(new.dog_id);
  return new;
end $$;
revoke execute on function public.focus_from_dog from public, anon, authenticated;
revoke execute on function public.focus_from_path from public, anon, authenticated;
create trigger dogs_focus_skills after insert or update of traits on public.dogs for each row execute function public.focus_from_dog();
create trigger dog_paths_focus_skills after insert on public.dog_paths for each row execute function public.focus_from_path();
-- Existing dogs are seeded by supabase/practice.sql once the skills are in.
