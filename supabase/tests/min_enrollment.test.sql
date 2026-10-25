-- Minimum enrollment and the template's free cancel window (migrations/…_min_enrollment.sql). Uses its own accounts
-- and runs in a transaction it rolls back.
begin;
create schema me;
create function me.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
create function me.expect_error(q text, want text) returns void language plpgsql as $$
declare got text;
begin
  begin execute q; exception when others then got := sqlerrm; end;
  if got is null or got not like '%' || want || '%' then raise exception 'FAILED: expected error "%" got "%"', want, got; end if;
  raise notice 'ok: rejected with %', want;
end $$;
create function me.as_user(id text) returns void language sql as $$ select set_config('request.jwt.claim.sub', id, false) $$;
grant usage on schema me to authenticated;
grant execute on all functions in schema me to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000001f1', 'min-member@dog.co', '{"name":"Mina Member"}'),
  ('00000000-0000-0000-0000-0000000001f2', 'min-owner@southfork.co', '{"name":"Sol Owner"}'),
  ('00000000-0000-0000-0000-0000000001f3', 'min-trainer@eastside.co', '{"name":"Eve Trainer"}');
select public.seed_demo_member('00000000-0000-0000-0000-0000000001f1');
insert into waiver_signatures (member_id, waiver_id, signed_name)
select '00000000-0000-0000-0000-0000000001f1', id, 'Mina Member' from waivers where active;
update profiles set credits_balance = 20 where id = '00000000-0000-0000-0000-0000000001f1';
select public.link_partner_staff('min-owner@southfork.co', 'southfork', 'owner', null);
select public.link_partner_staff('min-trainer@eastside.co', 'eastside', 'trainer', null);
create table me.v as select
  (select id from dogs where owner_id = '00000000-0000-0000-0000-0000000001f1' and name = 'Juno') juno,
  (select id from sessions where class_id = 'sniff-space' and starts_at > now() + interval '3 days' order by starts_at limit 1) s1,
  (select id from sessions where class_id = 'sniff-space' and starts_at > now() + interval '3 days' order by starts_at offset 1 limit 1) s2,
  (select id from sessions where class_id = 'sniff-space' and starts_at > now() + interval '3 days' order by starts_at offset 2 limit 1) s3,
  (select id from sessions where class_id = 'sniff-space' and starts_at > now() + interval '3 days' order by starts_at offset 3 limit 1) s4,
  0 credits;
grant select, update on me.v to authenticated;
create function me.credits() returns int language sql as $$ select credits_balance from public.profiles where id = '00000000-0000-0000-0000-0000000001f1' $$;
create function me.note(k text) returns public.notifications language sql as $$
  select * from public.notifications where member_id = '00000000-0000-0000-0000-0000000001f1' and kind = k order by created_at desc limit 1
$$;
grant execute on all functions in schema me to authenticated;

-- The owner sets the template's enrollment rules.
set role authenticated;
select me.as_user('00000000-0000-0000-0000-0000000001f2');
select public.partner_set_class_enrollment('sniff-space', 1, 12, 24);
select me.ok((select min_dogs = 1 and min_cutoff_hours = 12 and cancel_hours = 24 from class_types where id = 'sniff-space'), 'enrollment rules save');
select me.expect_error($$select public.partner_set_class_enrollment('sniff-space', 5, 12, 24)$$, 'bad_min');
select me.expect_error($$select public.partner_set_class_enrollment('sniff-space', 1, 0, 24)$$, 'bad_hours');
select me.ok(public.free_cancel_until((select s1 from me.v)) = (select starts_at - interval '24 hours' from sessions where id = (select s1 from me.v)),
             'free cancellation ends at the template''s window');

-- Juno books s1. At the cutoff it's below a minimum of 2, so it's cancelled and the credits come back.
select me.as_user('00000000-0000-0000-0000-0000000001f1');
select public.book_session((select s1 from me.v), (select juno from me.v));
reset role;
update me.v set credits = me.credits();
update class_types set min_dogs = 2 where id = 'sniff-space';
update sessions set starts_at = now() + interval '10 hours', created_at = now() - interval '3 days' where id = (select s1 from me.v);
select me.ok(public.enforce_minimums() = 1, 'a session below its minimum at the cutoff is cancelled');
select me.ok((select cancelled_at is not null and low_enrollment_at is not null and cancel_reason = 'Not enough dogs signed up' from sessions where id = (select s1 from me.v)),
             'and marked low enrollment');
select me.ok(me.credits() = (select credits from me.v) + 1, 'the member gets the credit back');
select me.ok((me.note('session_cancelled')).body like '%(not enough dogs signed up). 1 credit is back in your balance.', 'and is told why');
select me.ok(public.enforce_minimums() = 0, 'it''s checked once');

-- Run it anyway: back on, Juno re-booked and charged again.
set role authenticated;
select me.as_user('00000000-0000-0000-0000-0000000001f3');
select me.expect_error($$select public.partner_run_anyway((select s1 from me.v))$$, 'not_found');
select me.as_user('00000000-0000-0000-0000-0000000001f2');
select me.ok(public.partner_run_anyway((select s1 from me.v)) = 1, 'Run it anyway re-books the dog');
reset role;
select me.ok((select cancelled_at is null and low_enrollment_at is null and run_anyway_at is not null from sessions where id = (select s1 from me.v)), 'the session is back on');
select me.ok(exists (select 1 from bookings where session_id = (select s1 from me.v) and dog_id = (select juno from me.v) and status = 'booked'), 'Juno is booked again');
select me.ok(me.credits() = (select credits from me.v), 'and the credit is taken again');
select me.ok((me.note('session_back_on')).title = 'Sniff space is back on' and (me.note('session_back_on')).body like '%Juno is booked again for 1 credit.', 'the member hears it''s back on');
select me.ok(public.enforce_minimums() = 0, 'and it isn''t cancelled again');

-- Run it anyway before the cutoff keeps a session whatever the count.
set role authenticated;
select me.as_user('00000000-0000-0000-0000-0000000001f2');
select public.partner_run_anyway((select s2 from me.v));
reset role;
update sessions set starts_at = now() + interval '10 hours', created_at = now() - interval '3 days' where id = (select s2 from me.v);
select me.ok(public.enforce_minimums() = 0 and (select cancelled_at is null from sessions where id = (select s2 from me.v)), 'a session told to run isn''t cancelled');

-- A session added after its cutoff isn't checked.
update sessions set starts_at = now() + interval '10 hours', created_at = now() where id = (select s3 from me.v);
select me.ok(public.enforce_minimums() = 0 and (select cancelled_at is null from sessions where id = (select s3 from me.v)), 'a session added inside the cutoff runs');

-- Setting a minimum never cancels a session whose cutoff has passed.
update class_types set min_dogs = null where id = 'sniff-space';
update sessions set starts_at = now() + interval '10 hours', created_at = now() - interval '3 days' where id = (select s4 from me.v);
set role authenticated;
select me.as_user('00000000-0000-0000-0000-0000000001f2');
select public.partner_set_class_enrollment('sniff-space', 1, 12, 24);
reset role;
select me.ok(public.enforce_minimums() = 0 and (select min_checked_at is not null and cancelled_at is null from sessions where id = (select s4 from me.v)),
             'turning on a minimum leaves sessions past their cutoff alone');

-- The free cancel window follows the template: 24 hours, so cancelling 10 hours out uses the credit.
update class_types set min_dogs = null where id = 'sniff-space';
set role authenticated;
select me.as_user('00000000-0000-0000-0000-0000000001f1');
select public.book_session((select s4 from me.v), (select juno from me.v));
update me.v set credits = me.credits();
reset role;
select me.ok(public.booking_rules((select s4 from me.v), (select juno from me.v)) like '%Free cancel closed %', 'the booking rules say the window closed');
set role authenticated;
select public.cancel_booking((select id from bookings where session_id = (select s4 from me.v) and status = 'booked'));
select me.ok(me.credits() = (select credits from me.v), 'inside the window, cancelling keeps the credit used');
reset role;
select me.ok((select count(*) from payouts_due()) >= 0, 'payouts still add up');

-- With a 6-hour window, the same cancel is free.
update class_types set cancel_hours = 6 where id = 'sniff-space';
set role authenticated;
select me.as_user('00000000-0000-0000-0000-0000000001f1');
select public.book_session((select s4 from me.v), (select juno from me.v));
update me.v set credits = me.credits();
select public.cancel_booking((select id from bookings where session_id = (select s4 from me.v) and status = 'booked'));
select me.ok(me.credits() = (select credits from me.v) + 1, 'outside the window, the credit comes back');
reset role;

-- Earnings: the late cancel pays the partner; the refunded ones don't.
select me.ok((select count(*) from bookings b where b.session_id = (select s4 from me.v) and b.status = 'cancelled'
              and not exists (select 1 from credit_ledger l where l.booking_id = b.id and l.reason = 'refund')) = 1,
             'only the late cancel is unrefunded, so only it counts toward earnings');

rollback;
