-- Booking rules, credits, check-in and row level security. Run with tests/run-local.sh.
-- Each check raises on failure, so psql (ON_ERROR_STOP) exits non-zero at the first broken rule.
\set ON_ERROR_STOP 1

create schema t;
grant usage on schema t to authenticated;

-- Runs `q` and fails unless it raises an error whose message contains `want`.
create function t.expect_error(q text, want text) returns void language plpgsql as $$
declare got text;
begin
  begin
    execute q;
  exception when others then
    got := sqlerrm;
  end;
  if got is null then raise exception 'FAILED: expected error "%" but it succeeded: %', want, q; end if;
  if got not like '%' || want || '%' then raise exception 'FAILED: expected error "%" but got "%" from: %', want, got, q; end if;
  raise notice 'ok: rejected with %', want;
end $$;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
grant execute on all functions in schema t to authenticated;

-- First future session of a class (a day out, so nothing has started yet).
create function t.next_session(cls text) returns uuid language sql as $$
  select id from public.sessions where class_id = cls and starts_at > now() + interval '1 day' order by starts_at limit 1
$$;

-- ---- Sign-up ---------------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alex@kim.co', '{"name":"Alex Kim"}'),
  ('00000000-0000-0000-0000-00000000000b', 'sam@example.com', '{"name":"Someone Else"}');

select t.ok((select credits_balance from profiles where email = 'alex@kim.co') = 10, 'new member starts on Regular with 10 credits');
select t.ok((select count(*) from credit_ledger where reason = 'monthly_grant') = 2, 'sign-up writes a monthly grant to the ledger');

select public.seed_demo_member('00000000-0000-0000-0000-00000000000a');
select public.seed_demo_member('00000000-0000-0000-0000-00000000000b');

create table t.ids as
select (select id from dogs where owner_id = '00000000-0000-0000-0000-00000000000a' and name = 'Juno') as juno,
       (select id from dogs where owner_id = '00000000-0000-0000-0000-00000000000b' and name = 'Juno') as other_juno;
grant select on t.ids to authenticated;

-- ---- Row level security ----------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

select t.ok((select count(*) from dogs) = 2, 'a member sees only their own dogs');
select t.ok(not exists (select 1 from dogs where id = (select other_juno from t.ids)), 'another member''s dog is invisible');
select t.ok((select count(*) from bookings) = 1, 'a member sees only their own bookings');
select t.ok((select count(*) from partners) = 5 and (select count(*) from sessions) > 300, 'the catalog is readable');
select t.expect_error($$select check_in_code from sessions limit 1$$, 'permission denied');
select t.expect_error($$update profiles set credits_balance = 99$$, 'permission denied');
select t.expect_error($$insert into bookings (session_id, dog_id, member_id, credits_charged)
  values (t.next_session('agility-drop-in'), (select juno from t.ids), auth.uid(), 0)$$, 'row-level security');
update profiles set name = 'Alex K.';
select t.ok((select name from profiles) = 'Alex K.', 'a member can rename themselves');
select t.expect_error($$select public.book_session(t.next_session('small-group-play'), (select other_juno from t.ids))$$, 'not_your_dog');

-- ---- Eligibility -----------------------------------------------------------------------------
select t.expect_error($$select public.book_session(t.next_session('agility-drop-in'), (select juno from t.ids))$$, 'needs_social');
select t.expect_error($$select public.book_session(t.next_session('herding-fundamentals'), (select juno from t.ids))$$, 'needs_social');
select t.expect_error($$select public.book_session(t.next_session('herding-livestock'), (select juno from t.ids))$$, 'needs_herding');
select t.ok(public.booking_block((select juno from t.ids), t.next_session('sniff-space')) is null, 'sniff spaces (your dogs only) don''t need Social');

-- Small-group play is step 3 of Calm around dogs, so it's open while Juno is on the path.
select public.book_session(t.next_session('small-group-play'), (select juno from t.ids));
select t.ok((select credits_balance from profiles) = 6, 'booking a 1-credit path session leaves 6 of 7');
select t.ok((select delta from credit_ledger where reason = 'booking' order by id desc limit 1) = -1, 'the ledger records the booking');
select t.ok(exists (select 1 from notifications where kind = 'booked' and title = 'Booked. Small-group play'), 'booking notifies the member');
select t.expect_error($$select public.book_session(t.next_session('small-group-play'), (select juno from t.ids))$$, 'already_booked');

-- Bordetella expires in 15 days; sessions after that are blocked.
select t.expect_error($$select public.book_session(
  (select id from sessions where class_id = 'calm-private' and starts_at > now() + interval '20 days' order by starts_at limit 1),
  (select juno from t.ids))$$, 'vaccines');

-- ---- Spots and credits -----------------------------------------------------------------------
reset role;
update sessions set spots_left = 0 where id = t.next_session('loose-leash');
update profiles set credits_balance = 2 where email = 'alex@kim.co';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select t.expect_error($$select public.book_session(t.next_session('loose-leash'), (select juno from t.ids))$$, 'full');
select t.expect_error($$select public.book_session(t.next_session('calm-private'), (select juno from t.ids))$$, 'credits');

-- ---- Book these (01j): each session succeeds or fails on its own ----------------------------
reset role;
update profiles set credits_balance = 7 where email = 'alex@kim.co';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
create temp table plan_result as
select * from public.book_sessions((select juno from t.ids), array[
  t.next_session('sniff-space'), t.next_session('agility-drop-in'), t.next_session('calm-private')]);
select t.ok((select count(*) from plan_result where error is null) = 2, 'two of three plan sessions book');
select t.ok((select error from plan_result where error is not null) = 'needs_social', 'the group class is skipped with its reason');
select t.ok((select credits_balance from profiles) = 3, 'only the booked plan sessions are charged (7 - 1 - 3)');

-- ---- Cancelling ------------------------------------------------------------------------------
select public.cancel_booking((select b.id from bookings b join sessions s on s.id = b.session_id where s.class_id = 'sniff-space'));
select t.ok((select credits_balance from profiles) = 4, 'cancelling more than 12 hours out refunds the credit');
reset role;
update sessions set starts_at = now() + interval '2 hours'
where id = (select session_id from bookings b join sessions s on s.id = b.session_id where s.class_id = 'calm-private' and b.status = 'booked');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.cancel_booking((select b.id from bookings b join sessions s on s.id = b.session_id where s.class_id = 'calm-private' and b.status = 'booked'));
select t.ok((select credits_balance from profiles) = 4, 'cancelling inside 12 hours keeps the credits');

-- ---- Check-in --------------------------------------------------------------------------------
reset role;
create table t.hf as
select b.id as booking, s.id as session, s.check_in_code as code from bookings b join sessions s on s.id = b.session_id
where b.member_id = '00000000-0000-0000-0000-00000000000a' and s.class_id = 'herding-fundamentals';
grant select on t.hf to authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select t.expect_error($$select public.check_in((select booking from t.hf), (select code from t.hf))$$, 'too_early');
select t.expect_error($$select public.check_in((select booking from t.hf), '0000x')$$, 'wrong_code');
reset role;
update sessions set starts_at = now() + interval '6 minutes' where id = (select session from t.hf);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.check_in((select booking from t.hf), 'packpass:checkin:' || (select session from t.hf) || ':' || (select code from t.hf));
select t.ok((select status from bookings where id = (select booking from t.hf)) = 'checked_in', 'scanning the partner''s QR checks in 6 minutes before');

-- ---- Passing the Social re-check lifts the gate -----------------------------------------------
reset role;
select public.record_assessment((select juno from t.ids), 'social', 'eastside', 'Sam Reyes', 'cleared',
  '{"Calm in group play"}', '{"Fixates for the first few minutes"}', 'Juno read the group well.');
select t.ok((select completed_at is not null from dog_paths where dog_id = (select juno from t.ids) and path_id = 'calm-around-dogs'), 'the path that grants Social completes');
select t.ok(exists (select 1 from notifications where kind = 'clearance_earned' and title = 'Juno is Social cleared.'), 'the owner is notified');
update profiles set credits_balance = 7 where email = 'alex@kim.co';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select t.ok((select seen_at is null from clearances where type = 'social'), 'the new clearance starts unseen (Passport shows "Working on it")');
select public.see_clearance((select id from clearances where type = 'social'));
select t.ok((select seen_at is not null from clearances where type = 'social'), 'opening screen 13 marks it seen');
select public.book_session(t.next_session('agility-drop-in'), (select juno from t.ids));
select t.ok(true, 'with Social, group sport books');
select t.expect_error($$select public.record_assessment((select juno from t.ids), 'social', 'eastside', 'x', 'cleared')$$, 'permission denied');

-- ---- Notifications ---------------------------------------------------------------------------
select public.mark_notifications_read();
select t.ok(not exists (select 1 from notifications where read_at is null), 'mark all read');

-- ---- Storage ---------------------------------------------------------------------------------
insert into storage.objects (bucket_id, name) values ('dog-photos', '00000000-0000-0000-0000-00000000000a/juno.jpg');
select t.ok(true, 'a member can upload into their own folder');
select t.expect_error($$insert into storage.objects (bucket_id, name) values ('vaccine-docs', '00000000-0000-0000-0000-00000000000b/x.pdf')$$, 'row-level security');

-- ---- Monthly credits ---------------------------------------------------------------------------
reset role;
update profiles set credits_balance = 14, credits_reset_on = current_date where email = 'alex@kim.co';
select public.grant_monthly_credits();
select t.ok((select credits_balance from profiles where email = 'alex@kim.co') = 20, 'rollover is capped at one month: min(14, 10) + 10');
select t.ok((select credits_reset_on from profiles where email = 'alex@kim.co') > current_date, 'the next reset moves to the 1st of next month');

drop schema t cascade;
