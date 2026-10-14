-- Breed-specific classes, phase 4: tune fit from what dogs book (docs: breed-specific classes plan).
--
-- The member app ranks classes by fit: each part (breed, energy, social, interests, balance, history) is a signal
-- from 0 to 1 times a weight (apps/member/src/lib/fit.ts). The weights live here so PackPass can change them
-- without an app release, from a report of how often dogs book the classes Book showed them (match_impressions).

create table public.fit_weights (
  id boolean primary key default true check (id),
  breed int not null, energy int not null, social int not null, interests int not null, balance int not null, history int not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  constraint fit_weights_total check (breed + energy + social + interests + balance + history = 100),
  constraint fit_weights_range check (least(breed, energy, social, interests, balance, history) >= 0)
);
-- The plan's starting guess, as the app shipped with it.
insert into public.fit_weights (breed, energy, social, interests, balance, history) values (35, 20, 15, 15, 10, 5);
alter table public.fit_weights enable row level security;
create policy "fit_weights: read" on public.fit_weights for select to anon, authenticated using (true);

-- What the app used for an impression, so a report can tell rankings apart after the weights change.
alter table public.match_impressions add column weights jsonb;

-- p: {breed, energy, social, interests, balance, history}, whole numbers from 0 adding up to 100 (else bad_weights).
create function public.admin_set_fit_weights(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_check();
  if (select sum((p ->> k)::int) from unnest(array['breed', 'energy', 'social', 'interests', 'balance', 'history']) k) is distinct from 100 then
    raise exception 'bad_weights';
  end if;
  update public.fit_weights set
    breed = (p ->> 'breed')::int, energy = (p ->> 'energy')::int, social = (p ->> 'social')::int,
    interests = (p ->> 'interests')::int, balance = (p ->> 'balance')::int, history = (p ->> 'history')::int,
    updated_at = now(), updated_by = auth.uid();
exception when check_violation then
  raise exception 'bad_weights';
end $$;

-- How fit predicts booking over the last p_days, from impressions of classes the dog could book right then.
--   kind 'all':  every such impression.
--   kind 'band': by score, in bands of 20.
--   kind 'part': per part, impressions whose signal was strong (0.7 or more, label 'strong') or not ('weak').
-- Each row counts dogs as well as impressions, so a handful of keen members doesn't read as a trend.
create function public.admin_fit_report(p_days int default 28)
returns table (kind text, label text, shown int, booked int, dogs int)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_check();
  return query
  with i as (
    -- One row per dog and session: the same class seen again later the same day isn't a second chance to book it.
    select distinct on (m.dog_id, m.session_id) m.dog_id, m.session_id, m.score, m.score_parts, m.booked
    from public.match_impressions m
    where m.state = 'open' and m.surface = 'list' and m.shown_at > now() - make_interval(days => p_days)
      and m.weights is not null -- logged as signals (phase 3's first rows logged points)
    order by m.dog_id, m.session_id, m.shown_at
  )
  select 'all', 'All', count(*)::int, count(*) filter (where i.booked)::int, count(distinct i.dog_id)::int from i
  union all
  select 'band', b.label, count(i.*)::int, count(*) filter (where i.booked)::int, count(distinct i.dog_id)::int
  from (values (0, '0 to 19'), (20, '20 to 39'), (40, '40 to 59'), (60, '60 to 79'), (80, '80 to 100')) b(lo, label)
  left join i on least(coalesce(i.score, 0), 99) / 20 * 20 = b.lo
  group by b.lo, b.label
  union all
  select 'part', k || ' ' || case when (i.score_parts ->> k)::numeric >= 0.7 then 'strong' else 'weak' end,
         count(*)::int, count(*) filter (where i.booked)::int, count(distinct i.dog_id)::int
  from i, unnest(array['breed', 'energy', 'social', 'interests', 'balance', 'history']) k
  where i.score_parts ? k
  group by k, (i.score_parts ->> k)::numeric >= 0.7;
end $$;

revoke execute on function public.admin_set_fit_weights, public.admin_fit_report from public, anon;
grant execute on function public.admin_set_fit_weights, public.admin_fit_report to authenticated;

-- As before (…_breed_review_overrides.sql), plus the weights the app ranked with. p: [{…, weights}].
create or replace function public.log_impressions(p_dog uuid, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.dogs where id = p_dog and owner_id = auth.uid()) then raise exception 'not_found'; end if;
  insert into public.match_impressions (dog_id, session_id, surface, state, position, score, score_parts, weights)
  select p_dog, (e ->> 'session_id')::uuid, e ->> 'surface', e ->> 'state', (e ->> 'position')::int, (e ->> 'score')::int, e -> 'parts', e -> 'weights'
  from (select e from jsonb_array_elements(p) e limit 100) x
  where exists (select 1 from public.sessions s where s.id = (e ->> 'session_id')::uuid);
end $$;
