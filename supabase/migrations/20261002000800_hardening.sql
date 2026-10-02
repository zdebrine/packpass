-- Hardening from the Supabase advisors on the first hosted deploy.

-- ---- Security ----------------------------------------------------------------------------------
-- Internal functions aren't part of the API. Trigger functions only need EXECUTE when the trigger is
-- created; the helpers run inside other security-definer functions. owns_dog stays callable by
-- signed-in members because their row level security policies use it.
revoke execute on function public.handle_new_user, public.notify_booking, public.sessions_spot_opened,
  public.has_clearance, public.on_active_path from public, anon, authenticated;
revoke execute on function public.owns_dog from public, anon;
alter function public.plan_credits(public.plan_tier) set search_path = public;

-- ---- Performance -------------------------------------------------------------------------------
-- Evaluate auth.uid() once per statement instead of once per row.
alter policy "profiles: read own" on public.profiles using (id = (select auth.uid()));
alter policy "profiles: update own" on public.profiles using (id = (select auth.uid())) with check (id = (select auth.uid()));
alter policy "dogs: read own" on public.dogs using (owner_id = (select auth.uid()));
alter policy "dogs: insert own" on public.dogs with check (owner_id = (select auth.uid()));
alter policy "dogs: update own" on public.dogs using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
alter policy "dogs: delete own" on public.dogs using (owner_id = (select auth.uid()));
alter policy "bookings: read own" on public.bookings using (member_id = (select auth.uid()));
alter policy "ledger: read own" on public.credit_ledger using (member_id = (select auth.uid()));
alter policy "session_notes: read own" on public.session_notes
  using (exists (select 1 from public.bookings b where b.id = booking_id and b.member_id = (select auth.uid())));
alter policy "notifications: read own" on public.notifications using (member_id = (select auth.uid()));
alter policy "held_spots: read own" on public.held_spots using (member_id = (select auth.uid()));
alter policy "push_tokens: read own" on public.push_tokens using (member_id = (select auth.uid()));
alter policy "push_tokens: delete own" on public.push_tokens using (member_id = (select auth.uid()));
alter policy "waitlist: read own" on public.waitlist using (member_id = (select auth.uid()));

-- Indexes for foreign keys (joins, and deletes cascading from dogs and members).
create index on public.assessments (dog_id);
create index on public.assessments (booking_id);
create index on public.assessments (partner_id);
create index on public.bookings (dog_id);
create index on public.class_types (partner_id);
create index on public.class_types (trainer_id);
create index on public.clearances (partner_id);
create index on public.credit_ledger (booking_id);
create index on public.dog_paths (path_id);
create index on public.held_spots (dog_id);
create index on public.path_steps (class_id);
create index on public.session_notes (booking_id);
create index on public.session_notes (trainer_id);
create index on public.trainers (partner_id);
create index on public.waitlist (booking_id);
create index on public.waitlist (dog_id);
create index on public.waitlist (member_id);
