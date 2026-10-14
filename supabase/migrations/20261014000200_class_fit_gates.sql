-- Breed-specific classes, phase 1: who a class is for (docs: breed-specific classes plan).
--
-- Partners set an age range, a size range and a spayed-or-neutered rule on a class. These are gates: a dog
-- outside them can't book, and the member app hides the class behind "Hiding N classes Juno can't join".
-- Breed is never a gate here; it only ranks classes, which comes in phase 2.
--
--   booking_block codes, checked before clearances and vaccines (nothing the owner can fix by booking an
--   assessment): too_young · too_old · too_small · too_large · needs_fixed
--
-- A dog without a birthday or weight on file passes the age or size gate (older builds didn't ask); a dog
-- with `fixed` unknown fails needs_fixed until the owner says so.

-- ---- Dogs: canonical breeds --------------------------------------------------------------------

alter table public.dogs
  add column breed_ids text[] not null default '{}' check (cardinality(breed_ids) <= 3);

-- Matches a typed breed name ("Border Collie", "Lab") to a breed id, or null.
create function public.breed_id_named(p_name text) returns text
language sql stable set search_path = public as $$
  select b.id from public.breeds b
  where lower(trim(p_name)) = lower(b.name) or lower(trim(p_name)) = any (select lower(a) from unnest(b.aliases) a)
  order by lower(trim(p_name)) = lower(b.name) desc
  limit 1
$$;

-- Keeps breed_ids valid, fills them from the typed breed for builds that only send `breed`, and keeps `breed`
-- (the display name rosters show) in step with the ids.
create function public.dogs_breeds() returns trigger
language plpgsql set search_path = public as $$
declare
  names text[];
begin
  if exists (select 1 from unnest(new.breed_ids) x where not exists (select 1 from public.breeds b where b.id = x)) then
    raise exception 'bad_breed';
  end if;
  if cardinality(new.breed_ids) = 0 and new.breed is not null and not new.mixed then
    new.breed_ids := coalesce(array_remove(array[public.breed_id_named(new.breed)], null), '{}');
  end if;
  if cardinality(new.breed_ids) > 0 then
    select array_agg(b.name order by x.o) into names
    from unnest(new.breed_ids) with ordinality as x(id, o) join public.breeds b on b.id = x.id;
    new.breed := case when new.mixed then array_to_string(names, ' and ') || ' mix' else names[1] end;
  end if;
  return new;
end $$;
create trigger dogs_breeds before insert or update of breed, breed_ids, mixed on public.dogs
  for each row execute function public.dogs_breeds();

update public.dogs set breed_ids = breed_ids where breed is not null; -- runs the trigger: backfill from `breed`

-- ---- Classes: who it's for -----------------------------------------------------------------------

alter table public.class_types
  add column min_age_months int check (min_age_months between 0 and 240),
  add column max_age_months int check (max_age_months between 1 and 240),
  add column min_weight_lb int check (min_weight_lb between 1 and 200),
  add column max_weight_lb int check (max_weight_lb between 1 and 200),
  add column requires_fixed boolean not null default false,
  add constraint class_types_age_range check (min_age_months is null or max_age_months is null or min_age_months < max_age_months),
  add constraint class_types_weight_range check (min_weight_lb is null or max_weight_lb is null or min_weight_lb < max_weight_lb);

-- Classes saved before this carried their age floor as text only ("12 months or older").
update public.class_types c set min_age_months = case
    when exists (select 1 from jsonb_array_elements(c.requirements) r where r ->> 'text' ilike '12 months%') then 12
    when exists (select 1 from jsonb_array_elements(c.requirements) r where r ->> 'text' ilike '6 months%') then 6
  end
where min_age_months is null;

-- The dog's age in months on a given day, counted from its birth month and year (June when the month is
-- unknown), the way the app's onboarding shows it. Null without a birth year.
create function public.dog_age_months(d public.dogs, on_day date) returns int
language sql immutable as $$
  select case when d.birth_year is null then null else
    (extract(year from on_day)::int - d.birth_year) * 12 + extract(month from on_day)::int - coalesce(d.birth_month, 6)
  end
$$;

-- The first of the class's own gates the dog fails, or null.
create function public.class_gate(p_dog uuid, c public.class_types, on_day date) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  d public.dogs;
  age int;
begin
  select * into d from public.dogs where id = p_dog;
  if not found then raise exception 'not_found'; end if;
  age := public.dog_age_months(d, on_day);
  if c.min_age_months is not null and age is not null and age < c.min_age_months then return 'too_young'; end if;
  if c.max_age_months is not null and age is not null and age > c.max_age_months then return 'too_old'; end if;
  if c.min_weight_lb is not null and d.weight_lb is not null and d.weight_lb < c.min_weight_lb then return 'too_small'; end if;
  if c.max_weight_lb is not null and d.weight_lb is not null and d.weight_lb > c.max_weight_lb then return 'too_large'; end if;
  if c.requires_fixed and d.fixed is not true then return 'needs_fixed'; end if;
  return null;
end $$;
revoke execute on function public.class_gate from public, anon, authenticated;

-- As before (…_denied_records_block_booking.sql), plus the class's own gates right after `started`.
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
  gate := public.class_gate(p_dog, c, on_day);
  if gate is not null then return gate; end if;
  if c.requires = 'herding' and not public.has_clearance(p_dog, 'herding', c.partner_id, on_day) then
    return 'needs_herding';
  end if;
  if c.session_type = 'class' and c.group_size > 1
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

-- As before (…_trait_catalog.sql), plus the gates. Left out of the payload, a gate keeps its value (none for a
-- new class); an empty string or null in the payload clears it. Gates don't change the credit cost.
create or replace function public.partner_save_class(p_id text, p jsonb)
returns text language plpgsql security definer set search_path = public as $$
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
      min_age_months, max_age_months, min_weight_lb, max_weight_lb, requires_fixed)
    values (new_id, me, nullif(p ->> 'trainer_id', ''), trim(p ->> 'title'), p ->> 'discipline', (p ->> 'category')::public.class_category,
      st, null, (p ->> 'duration_min')::int, (p ->> 'intensity')::int, grp, p ->> 'suits', p ->> 'suits_note',
      (p ->> 'balance')::public.balance_category, p ->> 'description', p ->> 'image',
      case when st = 'assessment' then null else nullif(p ->> 'clearance', '')::public.clearance_type end,
      case when st = 'assessment' then nullif(p ->> 'clearance', '')::public.clearance_type else null end,
      coalesce(p -> 'requirements', '[]'), 'in_review',
      coalesce(array(select jsonb_array_elements_text(p -> 'energy')), '{}'), coalesce(array(select jsonb_array_elements_text(p -> 'sociability')), '{}'),
      st = 'class' and coalesce((p ->> 'drop_off')::boolean, false),
      nullif(p ->> 'min_age_months', '')::int, nullif(p ->> 'max_age_months', '')::int,
      nullif(p ->> 'min_weight_lb', '')::int, nullif(p ->> 'max_weight_lb', '')::int, coalesce((p ->> 'requires_fixed')::boolean, false));
    return new_id;
  end if;

  select * into c from public.class_types where id = p_id and partner_id = me for update;
  if not found then raise exception 'not_found'; end if;
  update public.class_types set
    title = trim(p ->> 'title'), discipline = p ->> 'discipline', category = (p ->> 'category')::public.class_category,
    session_type = st, duration_min = (p ->> 'duration_min')::int, intensity = (p ->> 'intensity')::int, group_size = grp,
    suits = p ->> 'suits', suits_note = p ->> 'suits_note', description = p ->> 'description', image = coalesce(p ->> 'image', image),
    trainer_id = coalesce(nullif(p ->> 'trainer_id', ''), trainer_id),
    requires = case when st = 'assessment' then null else nullif(p ->> 'clearance', '')::public.clearance_type end,
    grants = case when st = 'assessment' then nullif(p ->> 'clearance', '')::public.clearance_type else null end,
    requirements = coalesce(p -> 'requirements', requirements),
    energy = coalesce(array(select jsonb_array_elements_text(p -> 'energy')), energy),
    sociability = coalesce(array(select jsonb_array_elements_text(p -> 'sociability')), sociability),
    drop_off = st = 'class' and coalesce((p ->> 'drop_off')::boolean, drop_off),
    min_age_months = case when p ? 'min_age_months' then nullif(p ->> 'min_age_months', '')::int else min_age_months end,
    max_age_months = case when p ? 'max_age_months' then nullif(p ->> 'max_age_months', '')::int else max_age_months end,
    min_weight_lb = case when p ? 'min_weight_lb' then nullif(p ->> 'min_weight_lb', '')::int else min_weight_lb end,
    max_weight_lb = case when p ? 'max_weight_lb' then nullif(p ->> 'max_weight_lb', '')::int else max_weight_lb end,
    requires_fixed = coalesce((p ->> 'requires_fixed')::boolean, requires_fixed),
    credit_review = credit_review or (status = 'live' and (c.duration_min <> (p ->> 'duration_min')::int
      or c.intensity <> (p ->> 'intensity')::int or c.group_size <> grp or c.session_type <> st))
  where id = p_id;
  return p_id;
end $$;
