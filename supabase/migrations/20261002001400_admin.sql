-- PackPass admin (the Admin pages in apps/partner): review classes and set their credit cost, add
-- partners and trainers, and link staff accounts. Admins are PackPass people, listed here by account;
-- every admin_* function checks the list. Add one from the SQL editor:
--   insert into public.packpass_admins (user_id) select id from auth.users where email = '…';

create table public.packpass_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.packpass_admins enable row level security;
create policy "packpass_admins: read own" on public.packpass_admins for select to authenticated using (user_id = (select auth.uid()));

create function public.is_packpass_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.packpass_admins where user_id = auth.uid())
$$;
revoke execute on function public.is_packpass_admin from public, anon;
grant execute on function public.is_packpass_admin to authenticated;

create function public.admin_check() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_packpass_admin() then raise exception 'not_admin'; end if;
end $$;
revoke execute on function public.admin_check from public, anon, authenticated;

-- ---- Class review --------------------------------------------------------------------------------------

-- New classes (in review) and live classes whose pricing changed (credit review), oldest first.
create function public.admin_review_queue()
returns table (id text, partner_id text, partner_name text, trainer_name text, title text, discipline text,
               session_type public.session_type, duration_min int, intensity int, group_size int, credits int,
               premium boolean, status text, credit_review boolean, description text, image text,
               energy text[], sociability text[], requires public.clearance_type, grants public.clearance_type)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_check();
  return query
  select c.id, c.partner_id, p.name, t.name, c.title, c.discipline, c.session_type, c.duration_min, c.intensity, c.group_size,
         c.credits, c.premium, c.status, c.credit_review, c.description, c.image, c.energy, c.sociability, c.requires, c.grants
  from public.class_types c join public.partners p on p.id = c.partner_id left join public.trainers t on t.id = c.trainer_id
  where c.status = 'in_review' or c.credit_review
  order by c.status = 'in_review' desc, p.name, c.title;
end $$;

-- Sets the credit cost (and premium), and puts the class live, back in review, or pauses it.
create function public.admin_set_class(p_class text, p_credits int, p_premium boolean, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_check();
  if p_status not in ('live', 'paused', 'in_review') then raise exception 'bad_status'; end if;
  if p_status = 'live' and (p_credits is null or p_credits < 1 or p_credits > 20) then raise exception 'bad_credits'; end if;
  update public.class_types
  set credits = coalesce(p_credits, credits), premium = coalesce(p_premium, premium), status = p_status,
      credit_review = case when p_status = 'live' then false else credit_review end
  where id = p_class;
  if not found then raise exception 'not_found'; end if;
  -- A class going live gets its timetable sessions straight away rather than at the next nightly run.
  if p_status = 'live' then perform public.extend_schedule(); end if;
end $$;

-- ---- Partners, trainers and staff --------------------------------------------------------------------------

create function public.admin_partners()
returns table (id text, name text, short_name text, type public.partner_type, street text, address text, lat double precision,
               lng double precision, parking text, meet_at text, payout_rate_cents int, payout_status text,
               staff int, trainers int, live_classes int, in_review int)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_check();
  return query
  select p.id, p.name, p.short_name, p.type, p.street, p.address, p.lat, p.lng, p.parking, p.meet_at, p.payout_rate_cents, p.payout_status,
         (select count(*) from public.partner_staff s where s.partner_id = p.id)::int,
         (select count(*) from public.trainers t where t.partner_id = p.id)::int,
         (select count(*) from public.class_types c where c.partner_id = p.id and c.status = 'live')::int,
         (select count(*) from public.class_types c where c.partner_id = p.id and (c.status = 'in_review' or c.credit_review))::int
  from public.partners p order by p.name;
end $$;

-- Adds a partner (p_id null: the id is made from the name) or edits one.
create function public.admin_save_partner(p_id text, p jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare pid text := p_id;
begin
  perform public.admin_check();
  if length(trim(coalesce(p ->> 'name', ''))) < 2 then raise exception 'bad_name'; end if;
  if length(trim(coalesce(p ->> 'address', ''))) < 3 then raise exception 'bad_address'; end if;
  if pid is null then
    pid := trim(both '-' from regexp_replace(lower(p ->> 'name'), '[^a-z0-9]+', '-', 'g'));
    if exists (select 1 from public.partners where id = pid) then pid := pid || '-' || substr(md5(random()::text), 1, 4); end if;
    insert into public.partners (id, name, short_name, type, street, address, lat, lng, parking, meet_at, payout_rate_cents)
    values (pid, trim(p ->> 'name'), coalesce(nullif(trim(p ->> 'short_name'), ''), trim(p ->> 'name')),
            coalesce(nullif(p ->> 'type', ''), 'facility')::public.partner_type, coalesce(nullif(trim(p ->> 'street'), ''), trim(p ->> 'address')),
            trim(p ->> 'address'), (p ->> 'lat')::double precision, (p ->> 'lng')::double precision,
            nullif(trim(p ->> 'parking'), ''), nullif(trim(p ->> 'meet_at'), ''), coalesce((p ->> 'payout_rate_cents')::int, 950));
    return pid;
  end if;
  update public.partners set
    name = trim(p ->> 'name'), short_name = coalesce(nullif(trim(p ->> 'short_name'), ''), short_name),
    type = coalesce(nullif(p ->> 'type', ''), type::text)::public.partner_type, street = coalesce(nullif(trim(p ->> 'street'), ''), street),
    address = trim(p ->> 'address'), lat = coalesce((p ->> 'lat')::double precision, lat), lng = coalesce((p ->> 'lng')::double precision, lng),
    parking = nullif(trim(coalesce(p ->> 'parking', parking)), ''), meet_at = nullif(trim(coalesce(p ->> 'meet_at', meet_at)), ''),
    payout_rate_cents = coalesce((p ->> 'payout_rate_cents')::int, payout_rate_cents)
  where id = pid;
  if not found then raise exception 'not_found'; end if;
  return pid;
end $$;

create function public.admin_trainers()
returns table (id text, partner_id text, name text, credential text, specialties text[], classes int)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_check();
  return query
  select t.id, t.partner_id, t.name, t.credential, t.specialties, (select count(*) from public.class_types c where c.trainer_id = t.id)::int
  from public.trainers t order by t.partner_id, t.name;
end $$;

-- Adds a trainer to a partner (p_id null) or edits their name and credential.
create function public.admin_save_trainer(p_id text, p_partner text, p_name text, p_credential text)
returns text language plpgsql security definer set search_path = public as $$
declare tid text := p_id;
begin
  perform public.admin_check();
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'bad_name'; end if;
  if tid is null then
    if not exists (select 1 from public.partners where id = p_partner) then raise exception 'not_found'; end if;
    tid := trim(both '-' from regexp_replace(lower(split_part(trim(p_name), ' ', 1)), '[^a-z0-9]+', '-', 'g'));
    if exists (select 1 from public.trainers where id = tid) then tid := tid || '-' || p_partner; end if;
    if exists (select 1 from public.trainers where id = tid) then tid := tid || '-' || substr(md5(random()::text), 1, 4); end if;
    insert into public.trainers (id, partner_id, name, credential) values (tid, p_partner, trim(p_name), nullif(trim(coalesce(p_credential, '')), ''));
    return tid;
  end if;
  update public.trainers set name = trim(p_name), credential = nullif(trim(coalesce(p_credential, '')), '') where id = tid;
  if not found then raise exception 'not_found'; end if;
  return tid;
end $$;

create function public.admin_staff()
returns table (user_id uuid, email text, name text, partner_id text, partner_name text, role text, trainer_id text, trainer_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_check();
  return query
  select s.user_id, u.email::text, pr.name, s.partner_id, p.name, s.role, s.trainer_id, t.name
  from public.partner_staff s join auth.users u on u.id = s.user_id join public.partners p on p.id = s.partner_id
  left join public.profiles pr on pr.id = s.user_id left join public.trainers t on t.id = s.trainer_id
  order by p.name, s.role, u.email;
end $$;

-- Links an existing account (by email) to a partner as owner or trainer. The account has to exist:
-- the person signs up in the app first, or is invited from Supabase › Authentication.
create function public.admin_link_staff(p_email text, p_partner text, p_role text, p_trainer text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_check();
  if p_role not in ('owner', 'trainer') then raise exception 'bad_role'; end if;
  if not exists (select 1 from public.partners where id = p_partner) then raise exception 'not_found'; end if;
  if p_trainer is not null and not exists (select 1 from public.trainers where id = p_trainer and partner_id = p_partner) then raise exception 'bad_trainer'; end if;
  perform public.link_partner_staff(trim(p_email), p_partner, p_role, p_trainer);
end $$;

revoke execute on function public.admin_review_queue, public.admin_set_class, public.admin_partners, public.admin_save_partner,
  public.admin_trainers, public.admin_save_trainer, public.admin_staff, public.admin_link_staff from public, anon;
grant execute on function public.admin_review_queue, public.admin_set_class, public.admin_partners, public.admin_save_partner,
  public.admin_trainers, public.admin_save_trainer, public.admin_staff, public.admin_link_staff to authenticated;
