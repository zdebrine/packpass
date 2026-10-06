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

-- ---- Rolling schedule ----------------------------------------------------------------------------
reset role;
select t.ok(public.extend_schedule() = 0, 'the seeded four weeks need no new sessions');
select t.ok(public.extend_schedule(35) > 0, 'a longer window adds sessions from the timetable');
select t.ok(public.extend_schedule(35) = 0, 'running it again adds nothing');
select t.ok((select bool_and(spots_left = capacity) from sessions where starts_at > now() + interval '29 days'), 'new sessions open every spot');
select t.ok(not exists (
  select 1 from sessions s where s.starts_at > now() + interval '29 days' and s.class_id = 'herding-fundamentals'
    and extract(dow from s.starts_at at time zone 'America/Chicago') <> 4), 'weekly classes land on their weekday (Herding Fundamentals on Thursdays)');
select t.expect_error($$set local role authenticated; select public.extend_schedule()$$, 'permission denied');
select t.expect_error($$set local role authenticated; insert into timetable (class_id, starts) values ('fitness', '06:00')$$, 'permission denied');

-- ---- Sign-up ---------------------------------------------------------------------------------
-- These checks were written for the pre-launch credits (10 on sign-up, a free monthly grant); the launch
-- policy (credit_policy defaults) is checked at the end of stripe.test.sql.
update credit_policy set signup_credits = 10, free_monthly = true;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alex@kim.co', '{"name":"Alex Kim"}'),
  ('00000000-0000-0000-0000-00000000000b', 'sam@example.com', '{"name":"Someone Else"}');

select t.ok((select credits_balance from profiles where email = 'alex@kim.co') = 10, 'new member starts on Regular with 10 credits');
select t.ok((select count(*) from credit_ledger where reason = 'adjustment') = 2, 'sign-up writes the grant to the ledger');

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
select t.ok(public.booking_block((select juno from t.ids), t.next_session('social-assessment')) is null, 'the Social assessment a starting month leads with is open without Social');

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


-- ---- Held spots (01j for dogs without Social) --------------------------------------------------
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000c', 'new@dog.co');
select public.seed_demo_member('00000000-0000-0000-0000-00000000000c');
create table t.c as
select (select id from dogs where owner_id = '00000000-0000-0000-0000-00000000000c' and name = 'Juno') as dog,
       t.next_session('free-roam') as roam, t.next_session('herding-livestock') as livestock, t.next_session('open-field') as field,
       (select spots_left from sessions where id = t.next_session('free-roam')) as roam_spots;
grant select on t.c to authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);

create temp table holds as select * from public.hold_sessions((select dog from t.c), array[(select roam from t.c), (select livestock from t.c)]);
select t.ok((select hold_id is not null from holds where session_id = (select roam from t.c)), 'a group session can be held without Social');
select t.ok((select error from holds where session_id = (select livestock from t.c)) = 'needs_herding', 'other rules still stop a hold');
select t.ok((select spots_left from sessions where id = (select roam from t.c)) = (select roam_spots from t.c) - 1, 'a hold takes the spot');
select t.ok((select credits_balance from profiles) = 7, 'a hold charges no credits');
select t.ok((select error from public.hold_sessions((select dog from t.c), array[(select roam from t.c)])) = 'already_booked', 'a session can''t be held twice');
select t.ok((select count(*) from held_spots where status = 'held') = 1, 'the member reads their own holds');

create temp table early as select * from public.book_held((select dog from t.c));
select t.ok((select error from early) = 'needs_social' and exists (select 1 from held_spots where status = 'held'), 'held spots stay held until the dog has Social');

reset role;
select public.record_assessment((select dog from t.c), 'social', 'eastside', 'Sam Reyes', 'cleared');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
create temp table booked_held as select * from public.book_held((select dog from t.c));
select t.ok((select booking_id is not null from booked_held), 'once cleared, held sessions book in one call');
select t.ok((select spots_left from sessions where id = (select roam from t.c)) = (select roam_spots from t.c) - 1, 'booking a held spot doesn''t take a second spot');
select t.ok((select credits_balance from profiles) = 6, 'credits are charged when the held session books');
select t.ok((select status from held_spots where session_id = (select roam from t.c)) = 'booked', 'the hold is marked booked');

-- Releasing by hand, and expiry.
select public.hold_sessions((select dog from t.c), array[(select field from t.c)]);
select public.release_holds((select dog from t.c));
select t.ok(not exists (select 1 from held_spots where status = 'held'), 'release gives the hold back');
select public.hold_sessions((select dog from t.c), array[(select field from t.c)]);
reset role;
create table t.field_spots as select spots_left n from sessions where id = (select field from t.c);
update held_spots set expires_at = now() - interval '1 minute' where status = 'held';
select t.ok(public.release_expired_holds() = 1, 'expired holds are released');
select t.ok((select spots_left from sessions where id = (select field from t.c)) = (select n from t.field_spots) + 1, 'an expired hold gives its spot back');

-- A "not yet" releases the dog's holds and tells the owner.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000d', 'notyet@dog.co');
select public.seed_demo_member('00000000-0000-0000-0000-00000000000d');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
select public.hold_sessions((select id from dogs limit 1), array[t.next_session('free-roam'), t.next_session('agility-drop-in')]);
select t.ok((select count(*) from held_spots where status = 'held') = 2, 'a new dog holds the rest of its month');
reset role;
select public.record_assessment((select id from dogs where owner_id = '00000000-0000-0000-0000-00000000000d' and name = 'Juno'), 'social', 'eastside', 'Sam Reyes', 'not_yet');
select t.ok((select count(*) from held_spots where member_id = '00000000-0000-0000-0000-00000000000d' and status = 'held') = 0, 'a not-yet result releases the holds');
select t.ok(exists (select 1 from notifications where member_id = '00000000-0000-0000-0000-00000000000d' and kind = 'holds_released'), 'and tells the owner');

-- ---- Hold reminders ---------------------------------------------------------------------------
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000e', 'remind@dog.co');
select public.seed_demo_member('00000000-0000-0000-0000-00000000000e');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
select public.hold_sessions((select id from dogs limit 1), array[t.next_session('free-roam'), t.next_session('agility-drop-in')]);
reset role;
update held_spots set reminded_at = now() where member_id <> '00000000-0000-0000-0000-00000000000e';
update held_spots set expires_at = now() + interval '3 days' where member_id = '00000000-0000-0000-0000-00000000000e';
select t.ok(public.remind_expiring_holds() = 0, 'holds far from release aren''t reminded');
update held_spots set expires_at = now() + interval '20 hours' where member_id = '00000000-0000-0000-0000-00000000000e';
select t.ok(public.remind_expiring_holds() = 1, 'holds releasing within a day get one reminder per dog');
select t.ok((select body from notifications where member_id = '00000000-0000-0000-0000-00000000000e' and kind = 'hold_expiring') like '2 held group sessions go back%needs a Social clearance%',
            'an uncleared dog''s reminder says it needs Social');
select t.ok(public.remind_expiring_holds() = 0, 'each hold is reminded once');
select t.ok(not exists (select 1 from held_spots where member_id = '00000000-0000-0000-0000-00000000000e' and status = 'held' and reminded_at is null), 'reminded holds are marked');
select public.record_assessment((select id from dogs where owner_id = '00000000-0000-0000-0000-00000000000e' and name = 'Juno'), 'social', 'eastside', 'Sam Reyes', 'cleared');
update held_spots set reminded_at = null where member_id = '00000000-0000-0000-0000-00000000000e';
select public.remind_expiring_holds();
select t.ok(exists (select 1 from notifications where member_id = '00000000-0000-0000-0000-00000000000e' and title = 'Book Juno''s held sessions'), 'a cleared dog''s reminder asks the member to book');

-- ---- Push tokens -------------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
select public.register_push_token('ExponentPushToken[abc123]', 'ios');
select public.register_push_token('ExponentPushToken[abc123]', 'ios');
select t.ok((select count(*) from push_tokens) = 1, 'a member registers a device once');
select t.expect_error($$select public.register_push_token('not-a-token', 'ios')$$, 'bad_token');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
select public.register_push_token('ExponentPushToken[abc123]', 'android');
select t.ok((select member_id from push_tokens) = '00000000-0000-0000-0000-00000000000d', 'a device signed into by someone else moves to them');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
select t.ok((select count(*) from push_tokens) = 0, 'members only see their own devices');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
delete from push_tokens where token = 'ExponentPushToken[abc123]';
reset role;
select t.ok(not exists (select 1 from push_tokens), 'a member can remove their device on sign-out');
select t.expect_error($$set local role anon; select public.remind_expiring_holds()$$, 'permission denied');

-- ---- Waitlist ----------------------------------------------------------------------------------
reset role;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'first@dog.co'),
  ('00000000-0000-0000-0000-0000000000f2', 'second@dog.co'),
  ('00000000-0000-0000-0000-0000000000f3', 'third@dog.co');
-- Each demo member books Herding Fundamentals; make room for three more.
update sessions set capacity = capacity + 3, packpass_spots = packpass_spots + 3, spots_left = spots_left + 3 where class_id = 'herding-fundamentals';
select public.seed_demo_member('00000000-0000-0000-0000-0000000000f1');
select public.seed_demo_member('00000000-0000-0000-0000-0000000000f2');
select public.seed_demo_member('00000000-0000-0000-0000-0000000000f3');
create table t.w as select
  t.next_session('sniff-space') sniff,
  (select id from sessions where class_id = 'sniff-space' and starts_at > now() + interval '1 day' order by starts_at offset 1 limit 1) other,
  (select id from dogs where owner_id = '00000000-0000-0000-0000-0000000000f1' and name = 'Juno') d1,
  (select id from dogs where owner_id = '00000000-0000-0000-0000-0000000000f2' and name = 'Juno') d2,
  (select id from dogs where owner_id = '00000000-0000-0000-0000-0000000000f3' and name = 'Juno') d3;
grant select on t.w to authenticated;
create function t.as_member(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f' || n, false)
$$;
grant execute on function t.as_member to authenticated;

set role authenticated;
select t.as_member(1);
select public.book_session((select sniff from t.w), (select d1 from t.w));
reset role;
update sessions set spots_left = 0 where id = (select sniff from t.w);
set role authenticated;
select t.as_member(2);
select t.ok(public.join_waitlist((select d2 from t.w), (select sniff from t.w)) = 1, 'a member joins a full session''s waitlist, first in line');
select t.expect_error($$select public.join_waitlist((select d2 from t.w), (select sniff from t.w))$$, 'already_waiting');
select t.expect_error($$select public.join_waitlist((select d2 from t.w), (select other from t.w))$$, 'not_full');
select t.as_member(3);
select t.ok(public.join_waitlist((select d3 from t.w), (select sniff from t.w)) = 2, 'the next member is second');
select t.ok((select place from public.my_waitlist() where session_id = (select sniff from t.w)) = 2, 'members see their place in line');
select t.as_member(1);
select t.expect_error($$select public.join_waitlist((select d1 from t.w), (select sniff from t.w))$$, 'already_booked');

-- A cancellation books the first in line.
select public.cancel_booking((select id from bookings where dog_id = (select d1 from t.w) and session_id = (select sniff from t.w)));
reset role;
select t.ok(exists (select 1 from bookings where dog_id = (select d2 from t.w) and session_id = (select sniff from t.w) and status = 'booked'), 'a cancellation books the first dog in line');
select t.ok((select spots_left from sessions where id = (select sniff from t.w)) = 0, 'the opened spot is taken, not left open');
select t.ok((select credits_balance from profiles where id = '00000000-0000-0000-0000-0000000000f2') = 6, 'the waitlisted member is charged');
select t.ok((select status from waitlist where dog_id = (select d2 from t.w)) = 'booked', 'their waitlist entry is closed as booked');
select t.ok(exists (select 1 from notifications where member_id = '00000000-0000-0000-0000-0000000000f2' and kind = 'waitlist_booked')
            and not exists (select 1 from notifications where member_id = '00000000-0000-0000-0000-0000000000f2' and kind = 'booked' and href like '%' || (select sniff from t.w)),
            'they get one "off the waitlist" notification');

-- If the next member can't book any more, they're skipped and told why.
update profiles set credits_balance = 0 where id = '00000000-0000-0000-0000-0000000000f3';
set role authenticated;
select t.as_member(2);
select public.cancel_booking((select id from bookings where dog_id = (select d2 from t.w) and session_id = (select sniff from t.w)));
reset role;
select t.ok((select status from waitlist where dog_id = (select d3 from t.w)) = 'missed', 'a member without credits is skipped');
select t.ok(exists (select 1 from notifications where member_id = '00000000-0000-0000-0000-0000000000f3' and kind = 'waitlist_missed' and body like '%not enough credits%'), 'and told why');
select t.ok((select spots_left from sessions where id = (select sniff from t.w)) = 1, 'with nobody left in line, the spot stays open');

-- Inside 12 hours nothing books itself; everyone waiting hears about the spot once.
update profiles set credits_balance = 7 where id = '00000000-0000-0000-0000-0000000000f3';
update sessions set spots_left = 0 where id = (select other from t.w);
set role authenticated;
select t.as_member(3);
select public.join_waitlist((select d3 from t.w), (select other from t.w));
reset role;
update sessions set starts_at = now() + interval '6 hours' where id = (select other from t.w);
update sessions set spots_left = 1 where id = (select other from t.w);
update sessions set spots_left = 0 where id = (select other from t.w);
update sessions set spots_left = 1 where id = (select other from t.w);
select t.ok(not exists (select 1 from bookings where dog_id = (select d3 from t.w) and session_id = (select other from t.w)), 'inside 12 hours the waitlist doesn''t book for you');
select t.ok((select count(*) from notifications where member_id = '00000000-0000-0000-0000-0000000000f3' and kind = 'waitlist_open') = 1, 'it tells you once that a spot opened');
set role authenticated;
select t.as_member(3);
select public.leave_waitlist((select d3 from t.w), (select other from t.w));
select t.ok(not exists (select 1 from public.my_waitlist()), 'a member can leave the waitlist');
select t.ok(not exists (select 1 from waitlist where member_id <> '00000000-0000-0000-0000-0000000000f3'), 'members only see their own waitlist rows');
reset role;
select t.expect_error($$set local role authenticated; select public.fill_from_waitlist((select sniff from t.w))$$, 'permission denied');

-- ---- Push webhook ------------------------------------------------------------------------------
reset role;
select t.ok(public.push_kind('waitlist_booked') and not public.push_kind('booked'), 'only some notifications are pushed');
select t.ok(not public.push_secret_ok(null) and not public.push_secret_ok('guess'), 'without the Vault secret, nothing passes the webhook check');
select t.expect_error($$set local role authenticated; select public.push_secret_ok('x')$$, 'permission denied');

-- ---- Monthly credits ---------------------------------------------------------------------------
reset role;
update profiles set credits_balance = 14, credits_reset_on = current_date where email = 'alex@kim.co';
select public.grant_monthly_credits();
select t.ok((select credits_balance from profiles where email = 'alex@kim.co') = 20, 'rollover is capped at one month: min(14, 10) + 10');
select t.ok((select credits_reset_on from profiles where email = 'alex@kim.co') > current_date, 'the next reset moves to the 1st of next month');

-- ---- Changing email ------------------------------------------------------------------------------
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e2', 'old@dog.co');
update auth.users set email = 'new@dog.co' where id = '00000000-0000-0000-0000-0000000000e2';
select t.ok((select email from profiles where id = '00000000-0000-0000-0000-0000000000e2') = 'new@dog.co', 'a changed email carries over to the profile');

-- ---- Deleting an account ---------------------------------------------------------------------
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'leaving@dog.co');
select public.seed_demo_member('00000000-0000-0000-0000-0000000000e1');
create table t.leaving as select b.session_id sid, s.spots_left before from bookings b join sessions s on s.id = b.session_id
  where b.member_id = '00000000-0000-0000-0000-0000000000e1' and b.status = 'booked';
select t.expect_error($$set local role anon; select public.delete_my_account()$$, 'permission denied');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
select public.delete_my_account();
reset role;
select t.ok(not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-0000000000e1')
            and not exists (select 1 from profiles where id = '00000000-0000-0000-0000-0000000000e1')
            and not exists (select 1 from dogs where owner_id = '00000000-0000-0000-0000-0000000000e1')
            and not exists (select 1 from bookings where member_id = '00000000-0000-0000-0000-0000000000e1'),
            'deleting an account removes the member, their dogs and bookings');
select t.ok((select spots_left from sessions where id = (select sid from t.leaving)) = (select before from t.leaving) + 1, 'and gives their upcoming spots back');

drop schema t cascade;
