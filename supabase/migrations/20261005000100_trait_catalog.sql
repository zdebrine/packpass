-- Copy refresh, phase 1 (docs/COPY_REFRESH_SPEC.md).
--
-- Traits get stable ids. dogs.traits held the owner-facing labels ("Pulls on the leash"), copied into the
-- member app, its training-path routing and the website's sample month; renaming one broke the others. The
-- catalog keeps an owner label (in the owner's voice), a plain partner label for trainers, the onboarding
-- group, and the training path a trait starts at sign-up. Existing dogs are backfilled from the old labels;
-- anything that isn't one (free text from older builds or tests) is kept as is, and the apps show it raw.
--
-- Classes also get a drop-off flag: owners stay with their dog except in drop-off classes. Only group
-- classes can be drop-off.

create table public.traits (
  id text primary key,
  label text not null,          -- owner-facing, in the owner's voice
  partner_label text not null,  -- plain wording shown to trainers
  grp text not null check (grp in ('dogs', 'people', 'walks', 'home', 'special')),
  sort int not null,
  path_id text,                 -- training path started at sign-up, if any (foreign key below)
  legacy_label text unique      -- the old label, for the backfill
);
alter table public.traits enable row level security;
create policy traits_read on public.traits for select to anon, authenticated using (true);

insert into public.traits (id, label, partner_label, grp, sort, path_id, legacy_label) values
  ('rough_play',     'Plays too rough',               'Plays too rough',                          'dogs',    10, null,                  'Plays too rough'),
  ('nervous_dogs',   'Nervous around new dogs',       'Nervous with new dogs',                    'dogs',    20, 'calm-around-dogs',    'Nervous with new dogs'),
  ('guards',         'Guards food or toys',           'Resource guards',                          'dogs',    30, null,                  'Guards food or toys'),
  ('shy_people',     'Shy with strangers',            'Nervous with strangers',                   'people',  40, null,                  'Nervous with strangers'),
  ('jumps',          'Greets everyone by jumping',    'Jumps up on people',                       'people',  50, null,                  'Jumps up on people'),
  ('barks_visitors', 'Barks at every doorbell',       'Barks at visitors',                        'people',  60, null,                  'Barks at visitors'),
  ('pulls',          'Pulls like a sled dog',         'Pulls on the leash',                       'walks',   70, 'loose-leash-walking', 'Pulls on the leash'),
  ('leash_reactive', 'Loses it at dogs on walks',     'Leash reactive (lunges or barks at dogs)', 'walks',   80, 'calm-around-dogs',    'Lunges or barks at dogs on walks'),
  ('chases',         'Chases bikes and cars',         'Chases bikes or cars',                     'walks',   90, null,                  'Chases bikes or cars'),
  ('recall',         'Selective hearing at the park', 'Weak recall',                              'walks',  100, null,                  'Slow to come when called'),
  ('settle_public',  'Can''t settle in public',       'Struggles to settle in public',            'walks',  110, null,                  null),
  ('alone',          'Struggles when left alone',     'Separation stress',                        'home',   120, null,                  'Struggles when left alone'),
  ('bored_chewing',  'Bored and chewing at home',     'Chews or digs when alone',                 'home',   130, null,                  'Chews or digs when alone'),
  ('crate',          'Hard to settle in a crate',     'Hard to settle in a crate',                'home',   140, null,                  'Hard to settle in a crate'),
  ('none',           'None of these',                 'None listed',                              'special', 150, null,                 'None of these'),
  ('not_sure',       'Not sure yet',                  'Owner not sure',                           'special', 160, null,                 'Not sure yet');

-- On a fresh database the training paths arrive with catalog.sql after the migrations, so the reference is
-- added NOT VALID: the seed rows above aren't checked now, every later change is.
alter table public.traits add constraint traits_path_id_fkey foreign key (path_id) references public.training_paths (id) not valid;

-- Old labels to ids, keeping order; strings that aren't an old label stay as they are.
create function public.trait_ids(p_traits text[]) returns text[]
language sql stable set search_path = public as $$
  select coalesce(array_agg(coalesce(t.id, u.x) order by u.o), '{}')
  from unnest(p_traits) with ordinality as u(x, o)
  left join public.traits t on t.legacy_label = u.x
$$;
revoke execute on function public.trait_ids from public, anon, authenticated;

update public.dogs set traits = public.trait_ids(traits) where traits <> public.trait_ids(traits);

-- ---- Drop-off classes ----------------------------------------------------------------------------------------

alter table public.class_types add column drop_off boolean not null default false,
  add constraint class_types_drop_off_classes_only check (not drop_off or session_type = 'class');

-- As before (…_partner_dashboard.sql), plus drop_off. Left out of the payload, it keeps its value (false for a
-- new class); a class that becomes a private or an assessment stops being drop-off.
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
      intensity, group_size, suits, suits_note, balance, description, image, requires, grants, requirements, status, energy, sociability, drop_off)
    values (new_id, me, nullif(p ->> 'trainer_id', ''), trim(p ->> 'title'), p ->> 'discipline', (p ->> 'category')::public.class_category,
      st, null, (p ->> 'duration_min')::int, (p ->> 'intensity')::int, grp, p ->> 'suits', p ->> 'suits_note',
      (p ->> 'balance')::public.balance_category, p ->> 'description', p ->> 'image',
      case when st = 'assessment' then null else nullif(p ->> 'clearance', '')::public.clearance_type end,
      case when st = 'assessment' then nullif(p ->> 'clearance', '')::public.clearance_type else null end,
      coalesce(p -> 'requirements', '[]'), 'in_review',
      coalesce(array(select jsonb_array_elements_text(p -> 'energy')), '{}'), coalesce(array(select jsonb_array_elements_text(p -> 'sociability')), '{}'),
      st = 'class' and coalesce((p ->> 'drop_off')::boolean, false));
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
    credit_review = credit_review or (status = 'live' and (c.duration_min <> (p ->> 'duration_min')::int
      or c.intensity <> (p ->> 'intensity')::int or c.group_size <> grp or c.session_type <> st))
  where id = p_id;
  return p_id;
end $$;
