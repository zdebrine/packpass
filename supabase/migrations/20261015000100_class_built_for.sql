-- Breed-specific classes, phase 2: who a class is built for (docs: breed-specific classes plan).
--
-- Partners tag a class with up to three breed aptitudes (herding, sighthound…). It never gates booking: dogs
-- whose breeds share an aptitude see the class first with a "Built for" tag (apps/member/src/lib/fit.ts), and
-- every other dog can still book it.

alter table public.class_types
  add column built_for public.aptitude[] not null default '{}' check (cardinality(built_for) <= 3);

-- The aptitudes of a dog's breeds.
create function public.dog_aptitudes(p_breed_ids text[]) returns public.aptitude[]
language sql stable set search_path = public as $$
  select coalesce(array_agg(distinct a), '{}') from public.breeds b, unnest(b.aptitudes) a where b.id = any (p_breed_ids)
$$;

-- The class editor's member preview: how many PackPass dogs could book a class with these gates today, and how
-- many of them are Built for matches. Counts only. Takes the same payload as partner_save_class.
create function public.partner_class_reach(p jsonb)
returns table (can_book int, built_for int)
language plpgsql stable security definer set search_path = public as $$
declare
  c public.class_types;
  tags public.aptitude[] := coalesce(array(select jsonb_array_elements_text(p -> 'built_for'))::public.aptitude[], '{}');
begin
  perform public.staff_partner();
  c.min_age_months := nullif(p ->> 'min_age_months', '')::int;
  c.max_age_months := nullif(p ->> 'max_age_months', '')::int;
  c.min_weight_lb := nullif(p ->> 'min_weight_lb', '')::int;
  c.max_weight_lb := nullif(p ->> 'max_weight_lb', '')::int;
  c.requires_fixed := coalesce((p ->> 'requires_fixed')::boolean, false);
  return query
    select count(*)::int, (count(*) filter (where public.dog_aptitudes(d.breed_ids) && tags))::int
    from public.dogs d
    where public.class_gate(d.id, c, current_date) is null;
end $$;
revoke execute on function public.partner_class_reach from public, anon;
grant execute on function public.partner_class_reach to authenticated;

-- As before (…_class_fit_gates.sql), plus built_for. Left out of the payload, it keeps its value. It doesn't
-- change the credit cost.
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
      min_age_months, max_age_months, min_weight_lb, max_weight_lb, requires_fixed, built_for)
    values (new_id, me, nullif(p ->> 'trainer_id', ''), trim(p ->> 'title'), p ->> 'discipline', (p ->> 'category')::public.class_category,
      st, null, (p ->> 'duration_min')::int, (p ->> 'intensity')::int, grp, p ->> 'suits', p ->> 'suits_note',
      (p ->> 'balance')::public.balance_category, p ->> 'description', p ->> 'image',
      case when st = 'assessment' then null else nullif(p ->> 'clearance', '')::public.clearance_type end,
      case when st = 'assessment' then nullif(p ->> 'clearance', '')::public.clearance_type else null end,
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
    built_for = case when p ? 'built_for' then array(select jsonb_array_elements_text(p -> 'built_for'))::public.aptitude[] else built_for end,
    credit_review = credit_review or (status = 'live' and (c.duration_min <> (p ->> 'duration_min')::int
      or c.intensity <> (p ->> 'intensity')::int or c.group_size <> grp or c.session_type <> st))
  where id = p_id;
  return p_id;
end $$;
