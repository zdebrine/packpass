-- Breed-specific classes, phase 3 (docs: breed-specific classes plan).
--
-- 1. "Only these breeds": a partner can ask for a class to be open only to dogs whose breeds share one of its
--    Built for aptitudes, with a reason (a sanctioned event, insurance…). PackPass reviews every request; until
--    it's approved the class stays open to all breeds. Changing Built for or the reason sends it back to review.
-- 2. Assessed fit: after meeting a dog, a partner can let it into their classes past the size and breed gates.
--    Age and spayed-or-neutered still apply. One override per dog per partner.
-- 3. Impressions: which classes the app showed each dog, with the fit score it had, and whether the dog booked
--    the session, so the fit weights can be tuned from what members actually book.

-- ---- 1. Only these breeds ----------------------------------------------------------------------------------

alter table public.class_types
  add column breed_only boolean not null default false,
  add column breed_only_reason text,
  add column breed_only_status text check (breed_only_status in ('pending', 'approved', 'rejected')),
  add constraint class_types_breed_only check (not breed_only or (cardinality(built_for) > 0 and breed_only_status is not null));

-- Keeps the review status honest whoever writes the row: turning it on, or changing what it is built for or
-- why, asks PackPass again; turning it off clears it.
create function public.class_breed_only_review() returns trigger
language plpgsql set search_path = public as $$
begin
  if not new.breed_only then
    new.breed_only_status := null; new.breed_only_reason := null;
    return new;
  end if;
  if cardinality(new.built_for) = 0 then raise exception 'breed_only_needs_built_for'; end if;
  if length(trim(coalesce(new.breed_only_reason, ''))) < 3 then raise exception 'breed_only_reason'; end if;
  if tg_op = 'INSERT' or not old.breed_only or old.built_for is distinct from new.built_for
     or old.breed_only_reason is distinct from new.breed_only_reason then
    new.breed_only_status := 'pending';
  end if;
  return new;
end $$;
create trigger class_breed_only_review before insert or update of breed_only, built_for, breed_only_reason on public.class_types
  for each row execute function public.class_breed_only_review();

-- The class editor's switch. Off needs no review. The class itself stays bookable by every dog until approved.
create function public.partner_set_breed_only(p_class text, p_on boolean, p_reason text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  me text := public.staff_partner();
  st text;
begin
  update public.class_types set breed_only = p_on, breed_only_reason = case when p_on then trim(p_reason) end
  where id = p_class and partner_id = me
  returning breed_only_status into st;
  if not found then raise exception 'not_found'; end if;
  return st;
end $$;

-- ---- 2. Assessed fit -----------------------------------------------------------------------------------------

create table public.dog_fit_overrides (
  dog_id uuid not null references public.dogs (id) on delete cascade,
  partner_id text not null references public.partners (id) on delete cascade,
  assessor text not null,
  note text,
  created_at timestamptz not null default now(),
  primary key (dog_id, partner_id)
);
alter table public.dog_fit_overrides enable row level security;
create policy "dog_fit_overrides: read own dogs" on public.dog_fit_overrides for select to authenticated
  using (exists (select 1 from public.dogs d where d.id = dog_id and d.owner_id = (select auth.uid())));

-- Turns a dog's Assessed fit at my partner on or off. Only for dogs that have booked one of our classes.
create function public.partner_set_fit_override(p_dog uuid, p_on boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  me text := public.staff_partner();
  who text;
begin
  if not exists (select 1 from public.bookings b join public.sessions s on s.id = b.session_id
                 join public.class_types c on c.id = s.class_id where b.dog_id = p_dog and c.partner_id = me) then
    raise exception 'not_found';
  end if;
  if not p_on then
    delete from public.dog_fit_overrides where dog_id = p_dog and partner_id = me;
    return;
  end if;
  select coalesce(t.name, pr.name) into who from public.partner_staff ps
  left join public.trainers t on t.id = ps.trainer_id left join public.profiles pr on pr.id = ps.user_id
  where ps.user_id = auth.uid();
  insert into public.dog_fit_overrides (dog_id, partner_id, assessor, note)
  values (p_dog, me, coalesce(nullif(who, ''), 'PackPass partner'), nullif(trim(coalesce(p_note, '')), ''))
  on conflict (dog_id, partner_id) do update set assessor = excluded.assessor, note = excluded.note, created_at = now();
end $$;

-- The dogs with an Assessed fit at my partner.
create function public.partner_fit_overrides()
returns table (dog_id uuid, assessor text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select o.dog_id, o.assessor, o.created_at from public.dog_fit_overrides o where o.partner_id = public.staff_partner()
$$;

-- As before (…_class_fit_gates.sql), plus the approved breed gate, and an Assessed fit at the class's partner
-- lifts the size and breed gates.
create or replace function public.class_gate(p_dog uuid, c public.class_types, on_day date) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  d public.dogs;
  age int;
  assessed boolean;
begin
  select * into d from public.dogs where id = p_dog;
  if not found then raise exception 'not_found'; end if;
  age := public.dog_age_months(d, on_day);
  assessed := exists (select 1 from public.dog_fit_overrides o where o.dog_id = p_dog and o.partner_id = c.partner_id);
  if c.min_age_months is not null and age is not null and age < c.min_age_months then return 'too_young'; end if;
  if c.max_age_months is not null and age is not null and age > c.max_age_months then return 'too_old'; end if;
  if not assessed then
    if c.min_weight_lb is not null and d.weight_lb is not null and d.weight_lb < c.min_weight_lb then return 'too_small'; end if;
    if c.max_weight_lb is not null and d.weight_lb is not null and d.weight_lb > c.max_weight_lb then return 'too_large'; end if;
    if c.breed_only and c.breed_only_status = 'approved' and cardinality(c.built_for) > 0
       and not (public.dog_aptitudes(d.breed_ids) && c.built_for) then
      return 'breed_only';
    end if;
  end if;
  if c.requires_fixed and d.fixed is not true then return 'needs_fixed'; end if;
  return null;
end $$;

-- ---- PackPass review -----------------------------------------------------------------------------------------

drop function public.admin_review_queue();
-- As before (…_admin.sql), plus Built for and any "Only these breeds" request, which also brings a class here.
create function public.admin_review_queue()
returns table (id text, partner_id text, partner_name text, trainer_name text, title text, discipline text,
               session_type public.session_type, duration_min int, intensity int, group_size int, credits int,
               premium boolean, status text, credit_review boolean, description text, image text,
               energy text[], sociability text[], requires public.clearance_type, grants public.clearance_type,
               built_for public.aptitude[], breed_only_reason text, breed_only_status text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_check();
  return query
  select c.id, c.partner_id, p.name, t.name, c.title, c.discipline, c.session_type, c.duration_min, c.intensity, c.group_size,
         c.credits, c.premium, c.status, c.credit_review, c.description, c.image, c.energy, c.sociability, c.requires, c.grants,
         c.built_for, c.breed_only_reason, c.breed_only_status
  from public.class_types c join public.partners p on p.id = c.partner_id left join public.trainers t on t.id = c.trainer_id
  where c.status = 'in_review' or c.credit_review or c.breed_only_status = 'pending'
  order by c.status = 'in_review' desc, p.name, c.title;
end $$;

-- Approves or turns down a class's "Only these breeds" request.
create function public.admin_set_breed_only(p_class text, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_check();
  update public.class_types set breed_only_status = case when p_approve then 'approved' else 'rejected' end
  where id = p_class and breed_only;
  if not found then raise exception 'not_found'; end if;
end $$;

-- ---- 3. Impressions ------------------------------------------------------------------------------------------

create table public.match_impressions (
  id bigint generated always as identity primary key,
  dog_id uuid not null references public.dogs (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  surface text not null check (surface in ('list', 'map', 'detail')),
  -- Open: bookable now. Unlock: needs a clearance or vaccines first. No: a gate says it isn't for this dog.
  state text not null check (state in ('open', 'unlock', 'no')),
  position int,
  score int,
  score_parts jsonb,
  shown_at timestamptz not null default now(),
  booked boolean not null default false
);
create index match_impressions_dog_session on public.match_impressions (dog_id, session_id);
-- No policies: only log_impressions writes and only PackPass reads (SQL editor).
alter table public.match_impressions enable row level security;

-- p: [{session_id, surface, state, position, score, parts}], up to 100 at a time.
create function public.log_impressions(p_dog uuid, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.dogs where id = p_dog and owner_id = auth.uid()) then raise exception 'not_found'; end if;
  insert into public.match_impressions (dog_id, session_id, surface, state, position, score, score_parts)
  select p_dog, (e ->> 'session_id')::uuid, e ->> 'surface', e ->> 'state', (e ->> 'position')::int, (e ->> 'score')::int, e -> 'parts'
  from (select e from jsonb_array_elements(p) e limit 100) x
  where exists (select 1 from public.sessions s where s.id = (e ->> 'session_id')::uuid);
end $$;

create function public.mark_impression_booked() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.match_impressions set booked = true where dog_id = new.dog_id and session_id = new.session_id and not booked;
  return new;
end $$;
create trigger bookings_mark_impression after insert on public.bookings for each row execute function public.mark_impression_booked();

revoke execute on function public.partner_set_breed_only, public.partner_set_fit_override, public.partner_fit_overrides,
  public.admin_review_queue, public.admin_set_breed_only, public.log_impressions from public, anon;
grant execute on function public.partner_set_breed_only, public.partner_set_fit_override, public.partner_fit_overrides,
  public.admin_review_queue, public.admin_set_breed_only, public.log_impressions to authenticated;
revoke execute on function public.class_gate from public, anon, authenticated;
