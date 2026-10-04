-- Partner applications (project/Pack Partner Onboarding.dc.html): a trainer, gym or club creates an account on
-- the dashboard, fills in their business, services and credentials, and submits. PackPass reviews it on
-- PackPass › Applications; approving creates the partner and makes the applicant its owner.
-- Bank and tax details aren't collected here: Stripe Connect asks for them when payouts open, so PackPass
-- never stores a tax ID.

create table public.partner_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,  -- one application per account
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'declined')),
  contact_name text,
  phone text,
  partner_type public.partner_type,
  business_name text,
  address text,
  website text,
  wheres text[] not null default '{}',     -- at their facility, outdoors, at members' homes
  services text[] not null default '{}',
  formats text[] not null default '{}',
  group_size text,
  legal_name text,
  decline_reason text,
  partner_id text references public.partners (id) on delete set null,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null
);
alter table public.partner_applications enable row level security;
create policy "partner_applications: read own" on public.partner_applications for select to authenticated using (user_id = (select auth.uid()));

create table public.partner_application_docs (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.partner_applications (id) on delete cascade,
  kind text not null check (kind in ('license', 'insurance', 'certs', 'firstaid', 'photos')),
  path text not null unique,            -- partner-docs/<user id>/…
  file_name text not null,
  size_bytes int,
  created_at timestamptz not null default now()
);
create index on public.partner_application_docs (application_id);
alter table public.partner_application_docs enable row level security;
create policy "partner_application_docs: read own" on public.partner_application_docs for select to authenticated
  using (exists (select 1 from public.partner_applications a where a.id = application_id and a.user_id = (select auth.uid())));

-- Documents: the applicant's own folder; PackPass admins can read them all.
insert into storage.buckets (id, name, public) values ('partner-docs', 'partner-docs', false) on conflict (id) do nothing;
create policy "partner docs: read own or admin" on storage.objects for select to authenticated
  using (bucket_id = 'partner-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_packpass_admin()));
create policy "partner docs: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'partner-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "partner docs: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'partner-docs' and (storage.foldername(name))[1] = auth.uid()::text);

-- The caller's application, for changing: created as a draft if there isn't one. Raises 'already_partner' for staff
-- and 'submitted' once it's in review (nothing changes until PackPass decides).
create function public.my_open_application() returns public.partner_applications
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  a public.partner_applications;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if exists (select 1 from public.partner_staff where user_id = me) then raise exception 'already_partner'; end if;
  select * into a from public.partner_applications where user_id = me for update;
  if not found then
    insert into public.partner_applications (user_id, contact_name)
    values (me, (select nullif(name, '') from public.profiles where id = me)) returning * into a;
  end if;
  if a.status = 'submitted' then raise exception 'submitted'; end if;
  if a.status = 'approved' then raise exception 'already_partner'; end if;
  -- Any change to a declined application makes it a draft again (the reason stays until it's resubmitted).
  if a.status = 'declined' then update public.partner_applications set status = 'draft' where id = a.id returning * into a; end if;
  return a;
end $$;
revoke execute on function public.my_open_application from public, anon, authenticated;

-- Saves the fields given (any subset).
create function public.save_application(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare a public.partner_applications := public.my_open_application();
begin
  update public.partner_applications set
    contact_name = case when p ? 'contact_name' then nullif(trim(p ->> 'contact_name'), '') else contact_name end,
    phone = case when p ? 'phone' then nullif(trim(p ->> 'phone'), '') else phone end,
    partner_type = case when p ? 'partner_type' then nullif(p ->> 'partner_type', '')::public.partner_type else partner_type end,
    business_name = case when p ? 'business_name' then nullif(trim(p ->> 'business_name'), '') else business_name end,
    address = case when p ? 'address' then nullif(trim(p ->> 'address'), '') else address end,
    website = case when p ? 'website' then nullif(trim(p ->> 'website'), '') else website end,
    wheres = case when p ? 'wheres' then array(select jsonb_array_elements_text(p -> 'wheres')) else wheres end,
    services = case when p ? 'services' then array(select jsonb_array_elements_text(p -> 'services')) else services end,
    formats = case when p ? 'formats' then array(select jsonb_array_elements_text(p -> 'formats')) else formats end,
    group_size = case when p ? 'group_size' then nullif(p ->> 'group_size', '') else group_size end,
    legal_name = case when p ? 'legal_name' then nullif(trim(p ->> 'legal_name'), '') else legal_name end
  where id = a.id;
  return a.id;
end $$;

-- Records a file the app uploaded to partner-docs/<user id>/….
create function public.add_application_doc(p_kind text, p_path text, p_name text, p_size int)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  a public.partner_applications := public.my_open_application();
  did uuid;
begin
  if split_part(p_path, '/', 1) <> auth.uid()::text then raise exception 'not_found'; end if;
  insert into public.partner_application_docs (application_id, kind, path, file_name, size_bytes)
  values (a.id, p_kind, p_path, p_name, p_size) returning id into did;
  return did;
end $$;

-- Forgets a file; returns its path so the app can delete it from Storage.
create function public.remove_application_doc(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  a public.partner_applications := public.my_open_application();
  p text;
begin
  delete from public.partner_application_docs where id = p_id and application_id = a.id returning path into p;
  if p is null then raise exception 'not_found'; end if;
  return p;
end $$;

-- Sends the application for review. Raises 'incomplete' (a required field is missing) or 'missing_docs'.
-- Required: business license and insurance; trainer certifications, except for outdoor spaces, which need
-- photos of the site instead.
create function public.submit_application()
returns void language plpgsql security definer set search_path = public as $$
declare
  a public.partner_applications := public.my_open_application();
  needed text[];
begin
  if a.contact_name is null or a.partner_type is null or a.business_name is null or a.address is null
     or cardinality(a.services) = 0 or a.legal_name is null then
    raise exception 'incomplete';
  end if;
  needed := array['license', 'insurance'] || case when a.partner_type = 'outdoor_space' then array['photos'] else array['certs'] end;
  if exists (select 1 from unnest(needed) k where not exists (select 1 from public.partner_application_docs d where d.application_id = a.id and d.kind = k)) then
    raise exception 'missing_docs';
  end if;
  update public.partner_applications set status = 'submitted', submitted_at = now(), decline_reason = null where id = a.id;
end $$;

revoke execute on function public.save_application, public.add_application_doc, public.remove_application_doc, public.submit_application from public, anon;
grant execute on function public.save_application, public.add_application_doc, public.remove_application_doc, public.submit_application to authenticated;

-- ---- PackPass › Applications ------------------------------------------------------------------------------

-- Applications waiting for a decision, then the last 30 days of decisions.
create function public.admin_applications()
returns table (id uuid, status text, email text, contact_name text, phone text, partner_type public.partner_type, business_name text,
               address text, website text, wheres text[], services text[], formats text[], group_size text, legal_name text,
               decline_reason text, partner_id text, submitted_at timestamptz, decided_at timestamptz, docs jsonb)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  perform public.admin_check();
  return query
  select a.id, a.status, u.email::text, a.contact_name, a.phone, a.partner_type, a.business_name, a.address, a.website, a.wheres,
         a.services, a.formats, a.group_size, a.legal_name, a.decline_reason, a.partner_id, a.submitted_at, a.decided_at,
         coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'kind', d.kind, 'path', d.path, 'file_name', d.file_name, 'size_bytes', d.size_bytes) order by d.created_at)
                   from public.partner_application_docs d where d.application_id = a.id), '[]')
  from public.partner_applications a join auth.users u on u.id = a.user_id
  where a.status = 'submitted' or (a.status in ('approved', 'declined') and a.decided_at > now() - interval '30 days')
  order by a.status <> 'submitted', a.submitted_at;
end $$;

-- Approve: creates the partner (map location to add on PackPass › Partners), makes the applicant its owner
-- and, for an independent trainer, gives them a trainer profile. Returns the partner id.
-- Decline: needs a reason, which the applicant sees; they can edit and send it again.
create function public.admin_decide_application(p_id uuid, p_approve boolean, p_reason text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  a public.partner_applications;
  pid text;
  tid text;
begin
  perform public.admin_check();
  select * into a from public.partner_applications where id = p_id for update;
  if not found or a.status <> 'submitted' then raise exception 'not_found'; end if;
  if not p_approve then
    if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'needs_reason'; end if;
    update public.partner_applications set status = 'declined', decline_reason = trim(p_reason), decided_at = now(), decided_by = auth.uid() where id = p_id;
    return null;
  end if;
  if exists (select 1 from public.partner_staff where user_id = a.user_id) then raise exception 'staff_elsewhere'; end if;
  pid := public.admin_save_partner(null, jsonb_build_object(
    'name', a.business_name, 'type', a.partner_type, 'address', a.address,
    'street', nullif(regexp_replace(split_part(a.address, ',', 1), '^\s*\d+[A-Za-z]?\s+', ''), '')));
  if a.partner_type = 'trainer' then
    tid := trim(both '-' from regexp_replace(lower(split_part(a.contact_name, ' ', 1)), '[^a-z0-9]+', '-', 'g'));
    if tid = '' or exists (select 1 from public.trainers where id = tid) then tid := tid || '-' || pid; end if;
    insert into public.trainers (id, partner_id, name) values (tid, pid, a.contact_name);
  end if;
  insert into public.partner_staff (user_id, partner_id, role, trainer_id) values (a.user_id, pid, 'owner', tid);
  update public.partner_applications set status = 'approved', partner_id = pid, decided_at = now(), decided_by = auth.uid() where id = p_id;
  return pid;
end $$;

revoke execute on function public.admin_applications, public.admin_decide_application from public, anon;
grant execute on function public.admin_applications, public.admin_decide_application to authenticated;
