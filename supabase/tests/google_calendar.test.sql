-- Calendar sync, Google two-way (migrations/…_google_calendar.sql). Uses its own accounts and runs in a transaction it
-- rolls back. The Edge Function's side is stood in for by calling its functions as the service role does.
begin;
create schema gc;
create function gc.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
create function gc.expect_error(q text, want text) returns void language plpgsql as $$
declare got text;
begin
  begin execute q; exception when others then got := sqlerrm; end;
  if got is null or got not like '%' || want || '%' then raise exception 'FAILED: expected error "%" got "%"', want, got; end if;
  raise notice 'ok: rejected with %', want;
end $$;
create function gc.as_user(id text) returns void language sql as $$ select set_config('request.jwt.claim.sub', id, false) $$;
grant usage on schema gc to authenticated, service_role;
grant execute on all functions in schema gc to authenticated, service_role;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000ac1e1', 'gc-member@dog.co', '{"name":"Gia Member"}'),
  ('00000000-0000-0000-0000-0000000ac1e2', 'gc-owner@eastside.co', '{"name":"Gus Owner"}'),
  ('00000000-0000-0000-0000-0000000ac1e3', 'gc-owner@northside.co', '{"name":"Nell Owner"}');
select public.seed_demo_member('00000000-0000-0000-0000-0000000ac1e1');
select public.link_partner_staff('gc-owner@eastside.co', 'eastside', 'owner', null);
select public.link_partner_staff('gc-owner@northside.co', 'northside', 'owner', null);
create table gc.v as select
  (select id from dogs where owner_id = '00000000-0000-0000-0000-0000000ac1e1' and name = 'Juno') juno,
  (select id from sessions where class_id = 'free-roam' and starts_at > now() + interval '1 day' and cancelled_at is null order by starts_at limit 1) s1,
  (select id from sessions where class_id = 'free-roam' and starts_at > now() + interval '1 day' and cancelled_at is null order by starts_at offset 1 limit 1) s2,
  null::uuid st, null::uuid st2, null::uuid feed;
grant select, update on gc.v to authenticated, service_role;
-- What to write for Juno's two sessions (the seed's own bookings show up in the exports too).
create view gc.mine as select x.* from public.calendar_google_exports((select feed from gc.v)) x, gc.v where x.session_id in (v.s1, v.s2);
grant select on gc.mine to service_role;
-- Juno is booked into two of Eastside's Free roam sessions.
insert into bookings (session_id, dog_id, member_id, credits_charged)
select s, (select juno from gc.v), '00000000-0000-0000-0000-0000000ac1e1', 1 from gc.v, unnest(array[s1, s2]) s;

-- Starting a sign-in: staff only, their own trainers only.
set role authenticated;
select gc.as_user('00000000-0000-0000-0000-0000000ac1e1');
select gc.expect_error($$select public.partner_google_start()$$, 'not_partner');
select gc.as_user('00000000-0000-0000-0000-0000000ac1e2');
select gc.expect_error($$select public.partner_google_start('ana')$$, 'not_found');
update gc.v set st = public.partner_google_start(), st2 = public.partner_google_start();
select gc.expect_error($$select public.calendar_google_state_ok((select st from gc.v))$$, 'permission denied');
select gc.expect_error($$select public.calendar_google_connect((select st from gc.v), 'a@b.co', 'r', 'a', 3600)$$, 'permission denied');
select gc.expect_error($$select * from public.calendar_google_tokens$$, 'permission denied');
select gc.expect_error($$select * from public.calendar_oauth_states$$, 'permission denied');

-- Finishing it (the Edge Function, after Google's callback).
set role service_role;
select gc.ok(public.calendar_google_state_ok((select st from gc.v)), 'a fresh sign-in is waiting');
select gc.expect_error($$select public.calendar_google_connect(gen_random_uuid(), 'a@b.co', 'r', 'a', 3600)$$, 'expired');
select gc.expect_error($$select public.calendar_google_connect((select st2 from gc.v), 'not an email', 'r', 'a', 3600)$$, 'bad_email');
update gc.v set feed = public.calendar_google_connect(st, ' Dana@Eastside.co ', 'refresh-1', 'access-1', 3600);
select gc.ok(not public.calendar_google_state_ok((select st from gc.v)), 'a sign-in is used once');
select gc.ok((select kind = 'google' and name = 'Google Calendar · dana@eastside.co' and status = 'pending' and trainer_id is null
              from public.calendar_feeds where id = (select feed from gc.v)), 'the connection is a Google feed for the whole place');
select gc.ok((select refresh_token = 'refresh-1' and access_token = 'access-1' and access_expires_at > now() + interval '50 minutes'
              from public.calendar_google_tokens where feed_id = (select feed from gc.v)), 'its tokens are kept');
select gc.ok((select count(*) = 0 from public.calendar_feeds_due() where id = (select feed from gc.v)), 'the iCal reader leaves it alone');
select gc.ok((select count(*) = 1 from public.calendar_google_due() where id = (select feed from gc.v)), 'the Google sync picks it up');

-- Signing in again with the same account: no second connection; no new refresh token keeps the old one.
reset role;
update gc.v set st = (select public.partner_google_start()) from (select gc.as_user('00000000-0000-0000-0000-0000000ac1e2')) x;
set role service_role;
select gc.ok(public.calendar_google_connect((select st from gc.v), 'dana@eastside.co', '', 'access-2', 3600) = (select feed from gc.v),
             'signing in again updates the same connection');
select gc.ok((select refresh_token = 'refresh-1' and access_token = 'access-2' from public.calendar_google_tokens where feed_id = (select feed from gc.v)),
             'an empty refresh token keeps the one Google sent first');
select public.calendar_google_token((select feed from gc.v), 'access-3', 3600);
select gc.ok((select access_token = 'access-3' from public.calendar_google_tokens where feed_id = (select feed from gc.v)), 'a refreshed token is kept');

-- The partner sees it like a feed, by host.
reset role;
set role authenticated;
select gc.as_user('00000000-0000-0000-0000-0000000ac1e2');
select gc.ok((select host = 'www.googleapis.com' and name like 'Google Calendar%' from public.partner_calendar() where id = (select feed from gc.v)),
             'Settings lists the Google connection');
select gc.ok(public.partner_owns_feed((select feed from gc.v)), 'Eastside may sync or disconnect it');
select gc.as_user('00000000-0000-0000-0000-0000000ac1e3');
select gc.ok(not public.partner_owns_feed((select feed from gc.v)), 'Northside may not');

-- Busy times from Google close sessions the same way.
set role service_role;
select public.calendar_store_busy((select feed from gc.v), jsonb_build_array(jsonb_build_object(
  'starts_at', starts_at - interval '15 minutes', 'ends_at', starts_at + interval '30 minutes', 'title', 'Private client')))
from sessions where id = (select s1 from gc.v);
select gc.ok((select busy_hidden from sessions where id = (select s1 from gc.v)), 'a Google busy time closes the session');

-- Writing bookings: both sessions are to write; then one is written, one changes, and a booking is cancelled.
select gc.ok((select count(*) = 2 and bool_and(title = 'Free roam' and dogs like '%Juno%' and event_id is null) from gc.mine),
             'both booked sessions are to write, with the dogs');
select public.calendar_google_store_exports((select feed from gc.v),
  jsonb_build_array(jsonb_build_object('session_id', s1, 'event_id', 'ev-1', 'hash', 'h1'), jsonb_build_object('session_id', s2, 'event_id', 'ev-2', 'hash', 'h2')), null)
from gc.v;
select gc.ok((select count(*) = 2 and bool_and(event_id is not null) from gc.mine), 'written events are remembered');
reset role;
update bookings set status = 'cancelled', cancelled_at = now() where session_id = (select s2 from gc.v);
set role service_role;
select gc.ok((select title is null and event_id = 'ev-2' from gc.mine where session_id = (select s2 from gc.v)),
             'a session with no dogs left is an event to remove');
select public.calendar_google_store_exports((select feed from gc.v), '[]', array[(select s2 from gc.v)]);
select gc.ok((select count(*) = 1 from gc.mine), 'removed events are forgotten');

-- A trainer's connection writes only that trainer's classes.
reset role;
update gc.v set st = (select public.partner_google_start((select trainer_id from class_types where id = 'free-roam')))
  from (select gc.as_user('00000000-0000-0000-0000-0000000ac1e2')) x;
set role service_role;
select gc.expect_error($$select public.calendar_google_connect((select st from gc.v), 'sam@gmail.com', '', 'a', 3600)$$, 'no_refresh_token');
reset role;
update gc.v set st = (select public.partner_google_start((select trainer_id from class_types where id = 'free-roam')))
  from (select gc.as_user('00000000-0000-0000-0000-0000000ac1e2')) x;
set role service_role;
update gc.v set st2 = public.calendar_google_connect(st, 'sam@gmail.com', 'r', 'a', 3600);
select gc.ok((select trainer_id = 'sam' from public.calendar_feeds where id = (select st2 from gc.v)), 'a connection for Sam');
select gc.ok((select count(*) = 1 from public.calendar_google_exports((select st2 from gc.v)) x where x.session_id = (select s1 from gc.v)), 'a trainer connection writes that trainer''s booked sessions');
reset role;
select gc.as_user('00000000-0000-0000-0000-0000000ac1e2');
update class_types set trainer_id = null where id = 'free-roam';
set role service_role;
select gc.ok((select count(*) = 0 from public.calendar_google_exports((select st2 from gc.v)) x where x.session_id = (select s1 from gc.v)), 'and none of anyone else''s');

-- Disconnecting forgets the connection, its tokens and events, and opens the sessions it closed.
select public.calendar_google_disconnect((select feed from gc.v));
select gc.expect_error($$select public.calendar_google_disconnect((select feed from gc.v))$$, 'not_found');
select gc.ok((select count(*) = 0 from public.calendar_google_tokens where feed_id = (select feed from gc.v))
         and (select count(*) = 0 from public.calendar_exports where feed_id = (select feed from gc.v)), 'tokens and events are gone');
select gc.ok((select not busy_hidden from sessions where id = (select s1 from gc.v)), 'the closed session opens again');

rollback;
