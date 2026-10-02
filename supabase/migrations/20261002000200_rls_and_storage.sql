-- Row level security. Members see only their own rows. Anything that moves credits or spots
-- (bookings, check-in, clearances) goes through the security-definer functions in the next
-- migration, so those tables have read policies only.

alter table public.profiles enable row level security;
alter table public.dogs enable row level security;
alter table public.vaccinations enable row level security;
alter table public.partners enable row level security;
alter table public.trainers enable row level security;
alter table public.class_types enable row level security;
alter table public.sessions enable row level security;
alter table public.bookings enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.clearances enable row level security;
alter table public.training_paths enable row level security;
alter table public.path_steps enable row level security;
alter table public.dog_paths enable row level security;
alter table public.assessments enable row level security;
alter table public.session_notes enable row level security;
alter table public.notifications enable row level security;

-- Helper: does the signed-in member own this dog?
create function public.owns_dog(d uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.dogs where id = d and owner_id = auth.uid())
$$;

-- Profiles: read your own; update only your name (plan and credits change server-side).
create policy "profiles: read own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles: update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (name) on public.profiles to authenticated;

-- Dogs and vaccinations: full control of your own.
create policy "dogs: read own" on public.dogs for select to authenticated using (owner_id = auth.uid());
create policy "dogs: insert own" on public.dogs for insert to authenticated with check (owner_id = auth.uid());
create policy "dogs: update own" on public.dogs for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "dogs: delete own" on public.dogs for delete to authenticated using (owner_id = auth.uid());

create policy "vaccinations: read own" on public.vaccinations for select to authenticated using (public.owns_dog(dog_id));
create policy "vaccinations: insert own" on public.vaccinations for insert to authenticated with check (public.owns_dog(dog_id) and verified = false);
create policy "vaccinations: update own" on public.vaccinations for update to authenticated using (public.owns_dog(dog_id)) with check (public.owns_dog(dog_id) and verified = false);
create policy "vaccinations: delete own" on public.vaccinations for delete to authenticated using (public.owns_dog(dog_id));

-- Catalog: readable by everyone (the website shows it too). No client writes.
create policy "partners: read" on public.partners for select to anon, authenticated using (true);
create policy "trainers: read" on public.trainers for select to anon, authenticated using (true);
create policy "class_types: read" on public.class_types for select to anon, authenticated using (true);
create policy "training_paths: read" on public.training_paths for select to anon, authenticated using (true);
create policy "path_steps: read" on public.path_steps for select to anon, authenticated using (true);
create policy "sessions: read" on public.sessions for select to anon, authenticated using (true);
-- The check-in code is what proves a member is at the door, so clients never read it.
revoke select on public.sessions from anon, authenticated;
grant select (id, class_id, starts_at, capacity, spots_left, packpass_spots) on public.sessions to anon, authenticated;

-- Member history: read only.
create policy "bookings: read own" on public.bookings for select to authenticated using (member_id = auth.uid());
create policy "ledger: read own" on public.credit_ledger for select to authenticated using (member_id = auth.uid());
create policy "clearances: read own" on public.clearances for select to authenticated using (public.owns_dog(dog_id));
create policy "dog_paths: read own" on public.dog_paths for select to authenticated using (public.owns_dog(dog_id));
create policy "assessments: read own" on public.assessments for select to authenticated using (public.owns_dog(dog_id));
create policy "session_notes: read own" on public.session_notes for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and b.member_id = auth.uid()));
create policy "notifications: read own" on public.notifications for select to authenticated using (member_id = auth.uid());

-- ---- Storage -------------------------------------------------------------------------------
-- Files live under "<user id>/…", so a member can only touch their own folder.

insert into storage.buckets (id, name, public) values ('dog-photos', 'dog-photos', false), ('vaccine-docs', 'vaccine-docs', false)
on conflict (id) do nothing;

create policy "dog files: read own" on storage.objects for select to authenticated
  using (bucket_id in ('dog-photos', 'vaccine-docs') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "dog files: upload own" on storage.objects for insert to authenticated
  with check (bucket_id in ('dog-photos', 'vaccine-docs') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "dog files: update own" on storage.objects for update to authenticated
  using (bucket_id in ('dog-photos', 'vaccine-docs') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "dog files: delete own" on storage.objects for delete to authenticated
  using (bucket_id in ('dog-photos', 'vaccine-docs') and (storage.foldername(name))[1] = auth.uid()::text);
