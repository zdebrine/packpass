-- PackPass member app schema. Mirrors the client types in apps/member/src/data/types.ts
-- and the data model in docs/TECH_SPEC.md §5.

create extension if not exists pgcrypto;

-- ---- Enums ---------------------------------------------------------------------------------

create type public.plan_tier as enum ('starter', 'regular', 'working');
create type public.partner_type as enum ('trainer', 'facility', 'sport_club', 'behavior_specialist', 'outdoor_space');
create type public.class_category as enum ('sport', 'scent', 'play', 'skills');
create type public.session_type as enum ('class', 'private', 'assessment');
create type public.balance_category as enum ('physical', 'mental', 'social');
create type public.clearance_type as enum ('social', 'herding');
create type public.clearance_scope as enum ('network', 'partner');
create type public.booking_status as enum ('booked', 'waitlisted', 'checked_in', 'cancelled', 'no_show');
create type public.ledger_reason as enum ('monthly_grant', 'booking', 'refund', 'purchase', 'adjustment');
create type public.vaccine_type as enum ('rabies', 'dhpp', 'bordetella');
create type public.energy_level as enum ('couch', 'medium', 'high', 'working');
create type public.sociability as enum ('loves_dogs', 'selective', 'prefers_solo');
create type public.assessment_outcome as enum ('cleared', 'not_yet');
create type public.notification_category as enum ('clearances', 'bookings', 'notes');

-- Plan sizes (pivot spec): Starter 6, Regular 10, Working Dog 16 credits a month.
create function public.plan_credits(p public.plan_tier) returns int
language sql immutable as $$
  select case p when 'starter' then 6 when 'regular' then 10 when 'working' then 16 end
$$;

-- ---- Members and dogs ----------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text,
  plan public.plan_tier not null default 'regular',
  credits_balance int not null default 0 check (credits_balance >= 0),
  credits_reset_on date not null default (date_trunc('month', now()) + interval '1 month')::date,
  created_at timestamptz not null default now()
);

create table public.dogs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  photo_path text,
  sex text check (sex in ('female', 'male')),
  breed text,
  mixed boolean not null default false,
  birth_month int check (birth_month between 1 and 12),
  birth_year int,
  weight_lb int check (weight_lb between 2 and 200),
  fixed boolean,
  energy public.energy_level,
  sociability public.sociability,
  interests text[] not null default '{}',
  traits text[] not null default '{}',
  area text,
  member_since int not null default extract(year from now())::int,
  created_at timestamptz not null default now()
);
create index on public.dogs (owner_id);

create table public.vaccinations (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  type public.vaccine_type not null,
  expires_on date not null,
  document_path text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (dog_id, type)
);

-- ---- Catalog (partners, trainers, classes, sessions) ---------------------------------------
-- Readable by anyone signed in; written by partners through the dashboard (service role for now).

create table public.partners (
  id text primary key,
  name text not null,
  short_name text not null,
  type public.partner_type not null,
  street text not null,
  address text not null,
  lat double precision,
  lng double precision,
  rating numeric(2, 1),
  parking text,
  meet_at text
);

create table public.trainers (
  id text primary key,
  partner_id text references public.partners (id),
  name text not null,
  credential text,
  photo_url text,
  rating numeric(2, 1)
);

create table public.class_types (
  id text primary key,
  partner_id text not null references public.partners (id),
  trainer_id text references public.trainers (id),
  title text not null,
  discipline text not null,
  category public.class_category not null,
  session_type public.session_type not null default 'class',
  credits int not null check (credits between 1 and 8),
  duration_min int not null,
  intensity int not null check (intensity between 1 and 5),
  group_size int not null check (group_size >= 1),
  suits text,
  suits_note text,
  balance public.balance_category not null,
  description text,
  image text,
  premium boolean not null default false,
  requires public.clearance_type,
  grants public.clearance_type,
  open_window text,
  requirements jsonb not null default '[]'
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  class_id text not null references public.class_types (id),
  starts_at timestamptz not null,
  capacity int not null check (capacity >= 0),
  spots_left int not null check (spots_left >= 0),
  -- Spots the partner opens to PackPass members (pivot spec). spots_left counts down from this.
  packpass_spots int not null,
  -- 4-digit fallback shown on the partner's check-in screen.
  check_in_code text not null default lpad((floor(random() * 10000))::int::text, 4, '0'),
  check (spots_left <= packpass_spots and packpass_spots <= capacity)
);
create index on public.sessions (starts_at);
create index on public.sessions (class_id, starts_at);

-- ---- Bookings and credits ------------------------------------------------------------------

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  status public.booking_status not null default 'booked',
  credits_charged int not null,
  created_at timestamptz not null default now(),
  checked_in_at timestamptz,
  cancelled_at timestamptz
);
-- One live booking per dog per session.
create unique index bookings_one_live on public.bookings (session_id, dog_id) where status <> 'cancelled';
create index on public.bookings (member_id, status);

create table public.credit_ledger (
  id bigint generated always as identity primary key,
  member_id uuid not null references public.profiles (id) on delete cascade,
  delta int not null,
  reason public.ledger_reason not null,
  booking_id uuid references public.bookings (id),
  created_at timestamptz not null default now()
);
create index on public.credit_ledger (member_id, created_at);

-- ---- Passport: clearances, training paths, assessments ----------------------------------------

create table public.clearances (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  type public.clearance_type not null,
  -- Social travels across the network; Herding stays at the partner that assessed it.
  scope public.clearance_scope not null,
  partner_id text not null references public.partners (id),
  assessed_on date not null,
  expires_on date,
  assessor text,
  strengths text[] not null default '{}',
  working_on text[] not null default '{}',
  quote text,
  -- When the member opened the celebration screen (13). Null = not seen yet.
  seen_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.clearances (dog_id, type);

create table public.training_paths (
  id text primary key,
  title text not null,
  lede text not null,
  grants public.clearance_type
);

create table public.path_steps (
  path_id text not null references public.training_paths (id) on delete cascade,
  position int not null,
  title text not null,
  class_id text not null references public.class_types (id),
  primary key (path_id, position)
);

create table public.dog_paths (
  dog_id uuid not null references public.dogs (id) on delete cascade,
  path_id text not null references public.training_paths (id),
  -- 1-based position of the next step to do; past the last step means complete.
  next_step int not null default 1,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (dog_id, path_id)
);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  booking_id uuid references public.bookings (id),
  type public.clearance_type not null,
  partner_id text not null references public.partners (id),
  assessor text not null,
  outcome public.assessment_outcome not null,
  assessed_on date not null,
  strengths text[] not null default '{}',
  working_on text[] not null default '{}',
  quote text
);

create table public.session_notes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  trainer_id text references public.trainers (id),
  note text not null,
  skills text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  category public.notification_category not null,
  kind text not null,
  title text not null,
  body text not null,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (member_id, created_at desc);

-- ---- New member setup ----------------------------------------------------------------------

-- Every new auth user gets a profile on the Regular plan and this month's credits.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, credits_balance)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''), new.email, public.plan_credits('regular'));
  insert into public.credit_ledger (member_id, delta, reason) values (new.id, public.plan_credits('regular'), 'monthly_grant');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();
