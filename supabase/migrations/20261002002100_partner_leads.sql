-- Leads from the website's partner page: the earnings calculator asks who's looking before it opens. Anyone
-- can submit (the website isn't signed in); nobody can read them back except PackPass admins, on
-- PackPass › Applications. The same email submitting again the same day updates its row instead of adding one.

create table public.partner_leads (
  id uuid primary key default gen_random_uuid(),
  business_type text not null check (business_type in ('Trainer', 'Sport club', 'Behavior specialist', 'Outdoor space')),
  name text not null check (length(name) between 2 and 120),
  business_name text not null check (length(business_name) between 2 and 160),
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  zip text not null check (zip ~ '^\d{5}$'),
  created_at timestamptz not null default now(),
  created_on date not null default current_date
);
create unique index on public.partner_leads (lower(email), created_on);
alter table public.partner_leads enable row level security; -- no policies: written and read through the functions below

create function public.submit_partner_lead(p_type text, p_name text, p_business text, p_email text, p_zip text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_type not in ('Trainer', 'Sport club', 'Behavior specialist', 'Outdoor space') then raise exception 'bad_type'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 or length(trim(coalesce(p_business, ''))) < 2 then raise exception 'bad_name'; end if;
  if trim(coalesce(p_email, '')) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad_email'; end if;
  if trim(coalesce(p_zip, '')) !~ '^\d{5}$' then raise exception 'bad_zip'; end if;
  insert into public.partner_leads (business_type, name, business_name, email, zip)
  values (p_type, left(trim(p_name), 120), left(trim(p_business), 160), lower(trim(p_email)), trim(p_zip))
  on conflict (lower(email), created_on) do update set business_type = excluded.business_type, name = excluded.name,
    business_name = excluded.business_name, zip = excluded.zip, created_at = now();
end $$;
revoke execute on function public.submit_partner_lead from public;
grant execute on function public.submit_partner_lead to anon, authenticated;

-- The last 90 days of leads, newest first, with whether that email has since applied.
create function public.admin_partner_leads()
returns table (id uuid, business_type text, name text, business_name text, email text, zip text, created_at timestamptz, applied boolean)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  perform public.admin_check();
  return query
  select l.id, l.business_type, l.name, l.business_name, l.email, l.zip, l.created_at,
         exists (select 1 from public.partner_applications a join auth.users u on u.id = a.user_id
                 where lower(u.email) = l.email and a.status <> 'draft')
  from public.partner_leads l where l.created_at > now() - interval '90 days' order by l.created_at desc;
end $$;
revoke execute on function public.admin_partner_leads from public, anon;
grant execute on function public.admin_partner_leads to authenticated;
