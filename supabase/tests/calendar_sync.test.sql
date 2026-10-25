-- Calendar sync, iCal busy feeds (migrations/…_calendar_sync.sql). Uses its own accounts and runs in a transaction it
-- rolls back. The Edge Function's reads are stood in for by calling calendar_store_busy() as it does.
begin;
create schema cs;
create function cs.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
create function cs.expect_error(q text, want text) returns void language plpgsql as $$
declare got text;
begin
  begin execute q; exception when others then got := sqlerrm; end;
  if got is null or got not like '%' || want || '%' then raise exception 'FAILED: expected error "%" got "%"', want, got; end if;
  raise notice 'ok: rejected with %', want;
end $$;
create function cs.as_user(id text) returns void language sql as $$ select set_config('request.jwt.claim.sub', id, false) $$;
grant usage on schema cs to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000ca1e1', 'cs-member@dog.co', '{"name":"Cara Member"}'),
  ('00000000-0000-0000-0000-0000000ca1e2', 'cs-owner@eastside.co', '{"name":"Cy Owner"}'),
  ('00000000-0000-0000-0000-0000000ca1e3', 'cs-owner@northside.co', '{"name":"Nia Owner"}');
select public.seed_demo_member('00000000-0000-0000-0000-0000000ca1e1');
insert into waiver_signatures (member_id, waiver_id, signed_name)
select '00000000-0000-0000-0000-0000000ca1e1', id, 'Cara Member' from waivers where active;
update profiles set credits_balance = 20 where id = '00000000-0000-0000-0000-0000000ca1e1';
select public.link_partner_staff('cs-owner@eastside.co', 'eastside', 'owner', null);
select public.link_partner_staff('cs-owner@northside.co', 'northside', 'owner', null);

-- A second Eastside trainer with a class of her own, at the same time as Sam's Free roam.
insert into trainers (id, partner_id, name) values ('cs-tess', 'eastside', 'Tess Trainer');
insert into class_types select (jsonb_populate_record(null::class_types, to_jsonb(c) || '{"id":"cs-class","title":"Tess roam","trainer_id":"cs-tess"}')).*
from class_types c where c.id = 'free-roam';
create table cs.v as select
  (select id from dogs where owner_id = '00000000-0000-0000-0000-0000000ca1e1' and name = 'Juno') juno,
  (select id from sessions where class_id = 'free-roam' and starts_at > now() + interval '1 day' and cancelled_at is null order by starts_at limit 1) s1,
  null::uuid tess_s, null::uuid feed1, null::uuid feed2;
insert into sessions (class_id, starts_at, capacity, packpass_spots, spots_left)
select 'cs-class', starts_at, 6, 6, 6 from sessions where id = (select s1 from cs.v);
update cs.v set tess_s = (select id from sessions where class_id = 'cs-class');
grant select, update on cs.v to authenticated;
grant execute on all functions in schema cs to authenticated;

-- Adding feeds.
set role authenticated;
select cs.as_user('00000000-0000-0000-0000-0000000ca1e2');
select cs.ok((select hide_when_busy and id is null from public.partner_calendar()), 'no feeds yet, and hiding is on by default');
select cs.expect_error($$select public.partner_add_calendar_feed('Gingr', 'http://app.gingrapp.com/a.ics')$$, 'bad_feed_url');
select cs.expect_error($$select public.partner_add_calendar_feed('', 'https://app.gingrapp.com/a.ics')$$, 'bad_name');
select cs.expect_error($$select public.partner_add_calendar_feed('Ana', 'https://example.com/a.ics', 'ana')$$, 'not_found');
reset role;
update cs.v set feed1 = (select public.partner_add_calendar_feed('Gingr', 'webcal://app.gingrapp.com/ical/secret-token.ics'))
  from (select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000ca1e2', false)) x;
set role authenticated;
select cs.expect_error($$select public.partner_add_calendar_feed('Again', 'webcal://app.gingrapp.com/ical/secret-token.ics')$$, 'already_added');
select cs.ok((select host = 'app.gingrapp.com' and status = 'pending' and trainer_id is null from public.partner_calendar()),
             'the feed shows by its host, not its private address, until it is read');
select cs.ok(public.partner_owns_feed((select feed1 from cs.v)), 'the Edge Function may read it for Eastside');
select cs.as_user('00000000-0000-0000-0000-0000000ca1e3');
select cs.ok((select count(*) = 1 and bool_and(id is null) from public.partner_calendar()), 'Northside doesn''t see it');
select cs.ok(not public.partner_owns_feed((select feed1 from cs.v)), 'nor may read it');
select cs.expect_error($$select public.partner_remove_calendar_feed((select feed1 from cs.v))$$, 'not_found');
select cs.as_user('00000000-0000-0000-0000-0000000ca1e1');
select cs.expect_error($$select * from public.partner_calendar()$$, 'not_partner');
select cs.expect_error($$select public.calendar_store_busy((select feed1 from cs.v), '[]')$$, 'permission denied');
reset role;
select cs.ok((select count(*) = 1 from public.calendar_feeds_due()), 'a new feed is due');
select cs.ok((select count(*) = 1 from public.calendar_feeds_due((select feed1 from cs.v))), 'and can be read on request');

-- A read finds a busy time over Sam's Free roam: it closes, Tess's class at the same time doesn't (the feed is
-- Eastside's, so it covers every class; the trainer feed below narrows it).
select cs.ok(public.calendar_store_busy((select feed1 from cs.v), jsonb_build_array(
  jsonb_build_object('starts_at', s.starts_at - interval '30 minutes', 'ends_at', s.starts_at + interval '30 minutes', 'title', 'Private client'),
  jsonb_build_object('starts_at', now() - interval '2 days', 'ends_at', now() - interval '1 day', 'title', 'Long gone'))) >= 2,
  'a read stores busy times and closes sessions')
from sessions s where s.id = (select s1 from cs.v);
select cs.ok((select busy_hidden from sessions where id = (select s1 from cs.v)) and (select busy_hidden from sessions where id = (select tess_s from cs.v)),
             'a whole-place feed closes every class at that time');
select cs.ok((select status = 'ok' and busy_count = 1 and last_read_at is not null from calendar_feeds where id = (select feed1 from cs.v)),
             'past busy times are dropped and the feed is marked read');
select cs.ok((select count(*) = 0 from public.calendar_feeds_due()), 'a feed just read isn''t due');

-- Members: the session says so, and booking it is blocked.
set role authenticated;
select cs.as_user('00000000-0000-0000-0000-0000000ca1e1');
select cs.ok((select busy_hidden from public.sessions where id = (select s1 from cs.v)), 'members can read that a session is closed');
select cs.expect_error($$select public.book_session((select s1 from cs.v), (select juno from cs.v))$$, 'partner_busy');
select cs.ok(public.booking_block((select juno from cs.v), (select s1 from cs.v)) = 'partner_busy', 'booking_block says why');

-- The partner sees the busy time and the closed sessions on the schedule.
select cs.as_user('00000000-0000-0000-0000-0000000ca1e2');
select cs.ok((select count(*) filter (where kind = 'busy' and title = 'Private client') = 1 and count(*) filter (where kind = 'hidden') = 2
              from public.partner_busy(now(), now() + interval '15 days')), 'the schedule gets the busy time and the closed sessions');
select cs.ok((select hidden_sessions = 2 and busy_count = 1 and status = 'ok' from public.partner_calendar()), 'Settings counts them');

-- Hiding off: busy times stay, nothing closes; back on closes them again.
select cs.ok(public.partner_set_hide_when_busy(false) = 0, 'turning hiding off opens the sessions');
select cs.ok(not (select busy_hidden from public.sessions where id = (select s1 from cs.v)), 'Free roam is bookable again');
select cs.ok(public.partner_set_hide_when_busy(true) = 2, 'turning it on closes them again');
reset role;

-- A session added inside a busy time starts closed.
insert into sessions (class_id, starts_at, capacity, packpass_spots, spots_left)
select 'small-group-play', starts_at - interval '15 minutes', 4, 4, 4 from sessions where id = (select s1 from cs.v);
select cs.ok((select busy_hidden from sessions where class_id = 'small-group-play' and starts_at = (select starts_at - interval '15 minutes' from sessions where id = (select s1 from cs.v))),
             'a session added inside a busy time starts closed');
delete from sessions where class_id = 'small-group-play' and starts_at = (select starts_at - interval '15 minutes' from sessions where id = (select s1 from cs.v));

-- A read that fails keeps the busy times it had.
select public.calendar_store_busy((select feed1 from cs.v), null, 'The calendar answered 500.');
select cs.ok((select status = 'error' and error = 'The calendar answered 500.' and busy_count = 1 from calendar_feeds where id = (select feed1 from cs.v))
             and (select busy_hidden from sessions where id = (select s1 from cs.v)), 'a failed read is shown and keeps the last busy times');

-- A trainer's feed only closes that trainer's classes.
set role authenticated;
select cs.as_user('00000000-0000-0000-0000-0000000ca1e2');
select public.partner_remove_calendar_feed((select feed1 from cs.v));
select cs.ok(not (select busy_hidden from public.sessions where id = (select s1 from cs.v)), 'removing a feed opens what it closed');
reset role;
update cs.v set feed2 = (select public.partner_add_calendar_feed('Tess''s calendar', 'https://calendar.google.com/tess.ics', 'cs-tess'))
  from (select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000ca1e2', false)) x;
select public.calendar_store_busy((select feed2 from cs.v), jsonb_build_array(
  jsonb_build_object('starts_at', s.starts_at, 'ends_at', s.starts_at + interval '1 hour', 'title', 'Board and train')))
from sessions s where s.id = (select s1 from cs.v);
select cs.ok((select busy_hidden from sessions where id = (select tess_s from cs.v)) and not (select busy_hidden from sessions where id = (select s1 from cs.v)),
             'a trainer''s feed closes only that trainer''s classes');

-- Already booked dogs keep their spots: closing never cancels.
select cs.ok((select count(*) = 0 from sessions where id = (select tess_s from cs.v) and cancelled_at is not null), 'closing a session doesn''t cancel it');

rollback;
