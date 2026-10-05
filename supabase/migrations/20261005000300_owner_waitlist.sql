-- Founding-member signups from the website's owner page, while the app isn't in the stores
-- (docs/COPY_REFRESH_SPEC.md, phase 7). Anyone can submit (the website isn't signed in); nobody can read
-- the rows back through the API. The same email submitting again updates its row instead of adding one.

create table public.owner_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  zip text not null check (zip ~ '^\d{5}$'),
  energy public.energy_level,
  traits text[] not null default '{}',
  plan public.plan_tier,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email)
);
alter table public.owner_waitlist enable row level security; -- no policies: written through the function below

create function public.submit_owner_waitlist(p_email text, p_zip text, p_energy text, p_traits text[], p_plan text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_traits text[];
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then raise exception 'bad_email'; end if;
  if trim(coalesce(p_zip, '')) !~ '^\d{5}$' then raise exception 'bad_zip'; end if;
  if p_energy is not null and p_energy not in ('couch', 'medium', 'high', 'working') then raise exception 'bad_energy'; end if;
  if p_plan is not null and p_plan not in ('starter', 'regular', 'working') then raise exception 'bad_plan'; end if;
  -- Only ids from the trait catalog, at most three (the matcher's limit).
  select coalesce(array_agg(t.id order by t.sort), '{}') into v_traits
  from public.traits t where t.id = any(coalesce(p_traits, '{}'));
  if cardinality(v_traits) > 3 then raise exception 'bad_traits'; end if;
  insert into public.owner_waitlist (email, zip, energy, traits, plan)
  values (v_email, trim(p_zip), p_energy::public.energy_level, v_traits, p_plan::public.plan_tier)
  on conflict (email) do update set zip = excluded.zip, energy = excluded.energy, traits = excluded.traits,
    plan = excluded.plan, updated_at = now();
end $$;
revoke execute on function public.submit_owner_waitlist from public;
grant execute on function public.submit_owner_waitlist to anon, authenticated;
