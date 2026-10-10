-- One owner, two dogs (docs/MULTI_DOG_SPEC.md, migrations/…_multi_dog.sql). Uses its own accounts.
-- Rex has a Social clearance and current vaccines; Bea starts with neither.
create schema md;
create function md.expect_error(q text, want text) returns void language plpgsql as $$
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
create function md.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
create function md.as_user(id text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', id, false)
$$;
grant usage on schema md to authenticated;
grant execute on all functions in schema md to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000001d1', 'maya@two.dogs', '{"name":"Maya Two"}'),
  ('00000000-0000-0000-0000-0000000001d2', 'other@two.dogs', '{"name":"Otto Other"}'),
  ('00000000-0000-0000-0000-0000000001d9', 'trainer@eastside.co', '{"name":"Sam Trainer"}');
update profiles set credits_balance = 20 where id = '00000000-0000-0000-0000-0000000001d1';
select public.link_partner_staff('trainer@eastside.co', 'eastside', 'trainer');

insert into dogs (owner_id, name, breed) values
  ('00000000-0000-0000-0000-0000000001d1', 'Rex', 'Lab'),
  ('00000000-0000-0000-0000-0000000001d1', 'Bea', 'Beagle');
create table md.ids as select
  (select id from dogs where owner_id = '00000000-0000-0000-0000-0000000001d1' and name = 'Rex') rex,
  (select id from dogs where owner_id = '00000000-0000-0000-0000-0000000001d1' and name = 'Bea') bea;
insert into vaccinations (dog_id, type, expires_on, verified)
select rex, t::vaccine_type, current_date + 300, true from md.ids, unnest(array['rabies', 'dhpp', 'bordetella']) t;
insert into clearances (dog_id, type, scope, partner_id, assessed_on, expires_on)
select rex, 'social', 'network', 'eastside', current_date - 30, current_date + 335 from md.ids;

-- Sessions this test owns, so spot counts are known: a group class (needs Social), a second one that's full,
-- two more a few days out to hold, and the private Calm session (no Social needed).
create table md.s (k text primary key, id uuid);
with x as (insert into sessions (class_id, starts_at, capacity, packpass_spots, spots_left) values ('fitness', now() + interval '3 days', 6, 6, 6) returning id)
insert into md.s select 'group', id from x;
with x as (insert into sessions (class_id, starts_at, capacity, packpass_spots, spots_left) values ('fitness', now() + interval '4 days', 6, 6, 0) returning id)
insert into md.s select 'full', id from x;
with x as (insert into sessions (class_id, starts_at, capacity, packpass_spots, spots_left) values ('small-group-play', now() + interval '5 days', 5, 5, 5) returning id)
insert into md.s select 'hold_rex', id from x;
with x as (insert into sessions (class_id, starts_at, capacity, packpass_spots, spots_left) values ('small-group-play', now() + interval '6 days', 5, 5, 5) returning id)
insert into md.s select 'hold_bea', id from x;
with x as (insert into sessions (class_id, starts_at, capacity, packpass_spots, spots_left) values ('calm-private', now() + interval '3 days', 1, 1, 1) returning id)
insert into md.s select 'private', id from x;
grant select on md.ids, md.s to authenticated;
create function md.sid(k text) returns uuid language sql stable as $$ select id from md.s where s.k = sid.k $$;
create function md.spots(k text) returns int language sql stable as $$ select spots_left from public.sessions where id = md.sid(k) $$;
create function md.credits() returns int language sql stable as $$
  select credits_balance from public.profiles where id = '00000000-0000-0000-0000-0000000001d1'
$$;
grant execute on all functions in schema md to authenticated;

-- ---- Each dog books on its own records -------------------------------------------------------
set role authenticated;
select md.as_user('00000000-0000-0000-0000-0000000001d1');
select md.ok((select count(*) from dogs) = 2, 'the owner sees both dogs');
select md.ok(public.booking_block((select rex from md.ids), md.sid('group')) is null, 'Rex, cleared, can book a group class');
select md.ok(public.booking_block((select bea from md.ids), md.sid('group')) = 'needs_social', 'Bea needs her own Social clearance for it');
select md.expect_error($$select public.book_session(md.sid('group'), (select bea from md.ids))$$, 'needs_social');
select md.ok(public.booking_block((select bea from md.ids), md.sid('private')) = 'vaccines', 'Rex''s vaccines don''t count for Bea');
insert into vaccinations (dog_id, type, expires_on) select bea, t::vaccine_type, current_date + 200 from md.ids, unnest(array['rabies', 'dhpp', 'bordetella']) t;
select md.ok(public.booking_block((select bea from md.ids), md.sid('private')) is null, 'Bea''s own vaccines open the private session');
select md.ok(public.booking_block((select rex from md.ids), md.sid('private')) is null, 'and Rex is unaffected');

-- ---- Holds are per dog ---------------------------------------------------------------------------
select md.ok((select error is null from public.hold_sessions((select bea from md.ids), array[md.sid('group')])), 'Bea holds the group class while she waits on Social');
select md.ok(md.spots('group') = 5, 'the hold takes a spot');
select md.ok(public.release_holds((select rex from md.ids)) = 0, 'releasing Rex''s holds leaves Bea''s alone');
select md.ok((select count(*) from held_spots where status = 'held' and dog_id = (select bea from md.ids)) = 1, 'Bea''s hold stands');

-- Bea passes her Social assessment.
reset role;
select public.record_assessment((select bea from md.ids), 'social', 'eastside', 'Sam Reyes', 'cleared');
select md.ok((select count(*) from clearances where type = 'social' and dog_id = (select bea from md.ids)) = 1, 'the clearance goes on Bea');
select md.ok((select count(*) from clearances where dog_id = (select rex from md.ids)) = 1, 'Rex keeps just his');
select md.ok((select href = '/clearance-earned?dog=' || (select bea from md.ids) from notifications
              where member_id = '00000000-0000-0000-0000-0000000001d1' and kind = 'clearance_earned'), 'the Clearance earned link opens Bea');

-- ---- Two dogs, one session, one credit balance ------------------------------------------------------
set role authenticated;
select md.as_user('00000000-0000-0000-0000-0000000001d1');
select public.book_session(md.sid('group'), (select rex from md.ids));
select public.book_session(md.sid('group'), (select bea from md.ids));
select md.ok((select count(*) from bookings where session_id = md.sid('group') and status = 'booked') = 2, 'both dogs book the same session');
select md.ok(md.spots('group') = 4, 'Rex takes a spot and Bea uses the one she held');
select md.ok(md.credits() = 16, 'both bookings come out of the account''s credits (2 + 2 of 20)');
select md.expect_error($$select public.book_session(md.sid('group'), (select rex from md.ids))$$, 'already_booked');
select public.cancel_booking((select id from bookings where session_id = md.sid('group') and dog_id = (select rex from md.ids) and status = 'booked'));
select md.ok((select status from bookings where session_id = md.sid('group') and dog_id = (select bea from md.ids)) = 'booked', 'cancelling Rex leaves Bea booked');
select md.ok(md.spots('group') = 5 and md.credits() = 18, 'and gives back Rex''s spot and credits only');

-- ---- The waitlist is per dog ---------------------------------------------------------------------
select md.ok(public.join_waitlist((select rex from md.ids), md.sid('full')) = 1, 'Rex joins a full session''s waitlist');
select md.ok(public.join_waitlist((select bea from md.ids), md.sid('full')) = 2, 'Bea joins behind him');
select md.expect_error($$select public.join_waitlist((select bea from md.ids), md.sid('full'))$$, 'already_waiting');
select public.leave_waitlist((select rex from md.ids), md.sid('full'));
select md.ok((select place from public.my_waitlist() where dog_id = (select bea from md.ids)) = 1 and
             not exists (select 1 from public.my_waitlist() where dog_id = (select rex from md.ids)), 'Rex leaving moves Bea up');

-- ---- Nobody else can use them ---------------------------------------------------------------------
select md.as_user('00000000-0000-0000-0000-0000000001d2');
select md.ok(not exists (select 1 from dogs where owner_id = '00000000-0000-0000-0000-0000000001d1'), 'another member sees neither dog');
select md.expect_error($$select public.book_session(md.sid('group'), (select rex from md.ids))$$, 'not_your_dog');
select md.expect_error($$select * from public.hold_sessions((select bea from md.ids), array[md.sid('group')])$$, 'not_your_dog');
select md.expect_error($$select public.join_waitlist((select bea from md.ids), md.sid('full'))$$, 'not_your_dog');
select md.expect_error($$select public.start_path((select bea from md.ids), 'loose-leash-walking')$$, 'not_your_dog');

-- ---- Path steps, and undoing them, per dog ---------------------------------------------------------
select md.as_user('00000000-0000-0000-0000-0000000001d1');
select public.start_path((select rex from md.ids), 'loose-leash-walking');
select public.start_path((select bea from md.ids), 'loose-leash-walking');
reset role;
with x as (insert into sessions (class_id, starts_at, capacity, packpass_spots, spots_left)
           select 'loose-leash', now() - interval '1 day' * g, 1, 1, 0 from generate_series(1, 3) g returning id, starts_at)
insert into md.s select 'walk' || row_number() over (order by starts_at desc), id from x;
insert into bookings (session_id, dog_id, member_id, credits_charged)
select md.sid('walk1'), bea, '00000000-0000-0000-0000-0000000001d1'::uuid, 3 from md.ids union all
select md.sid('walk2'), rex, '00000000-0000-0000-0000-0000000001d1', 3 from md.ids union all
select md.sid('walk3'), rex, '00000000-0000-0000-0000-0000000001d1', 3 from md.ids;
create function md.bk(k text) returns uuid language sql stable as $$ select id from public.bookings where session_id = md.sid(k) $$;
update bookings set status = 'checked_in' where id in (md.bk('walk1'), md.bk('walk2'));
select md.ok((select next_step from dog_paths where dog_id = (select bea from md.ids) and path_id = 'loose-leash-walking') = 2
             and (select next_step from dog_paths where dog_id = (select rex from md.ids) and path_id = 'loose-leash-walking') = 2,
             'each dog''s check-in moves its own path on');
select md.ok((select count(*) from notifications where kind = 'path_step' and href = '/goal/loose-leash-walking?dog=' || (select bea from md.ids)) = 1
             and (select count(*) from notifications where kind = 'path_step' and href = '/goal/loose-leash-walking?dog=' || (select rex from md.ids)) = 1,
             'and each step''s link opens that dog''s goal');
update bookings set status = 'booked' where id = md.bk('walk1');
select md.ok(not exists (select 1 from notifications where kind = 'path_step' and href like '%?dog=' || (select bea from md.ids))
             and exists (select 1 from notifications where kind = 'path_step' and href like '%?dog=' || (select rex from md.ids)),
             'undoing Bea''s check-in takes back her step''s notification, not Rex''s');
-- A notification sent before the dog was in the link is still taken back.
update bookings set status = 'checked_in' where id = md.bk('walk3');
update notifications set href = '/goal/loose-leash-walking' where kind = 'path_step' and title = 'Step 2 of 3 done';
update bookings set status = 'booked' where id = md.bk('walk3');
select md.ok(not exists (select 1 from notifications where kind = 'path_step' and title = 'Step 2 of 3 done'), 'an older link without the dog is taken back too');

-- ---- The partner's "not yet" names the dog ---------------------------------------------------------
set role authenticated;
select md.as_user('00000000-0000-0000-0000-0000000001d1');
select md.ok((select error is null from public.hold_sessions((select rex from md.ids), array[md.sid('hold_rex')])), 'Rex holds a session');
select md.ok((select error is null from public.hold_sessions((select bea from md.ids), array[md.sid('hold_bea')])), 'Bea holds another');
reset role;
with x as (insert into sessions (class_id, starts_at, capacity, packpass_spots, spots_left) values ('social-recheck', now() - interval '2 hours', 1, 1, 0) returning id)
insert into md.s select 'recheck', id from x;
insert into bookings (session_id, dog_id, member_id, credits_charged)
select md.sid('recheck'), rex, '00000000-0000-0000-0000-0000000001d1', 2 from md.ids;
-- Staff can't read member bookings directly, so take the id out first.
create table md.recheck as select md.bk('recheck') id;
grant select on md.recheck to authenticated;
set role authenticated;
select md.as_user('00000000-0000-0000-0000-0000000001d9');
select public.partner_record_result((select id from md.recheck), 'not_yet', '{}', array['Settling at the gate'], 'Close. A little more distance work.');
reset role;
select md.ok((select href = '/passport/social?dog=' || (select rex from md.ids) from notifications where kind = 'assessment_result'
              and member_id = '00000000-0000-0000-0000-0000000001d1'), 'the result''s link opens Rex''s Passport');
select md.ok((select href = '/goal/calm-around-dogs?dog=' || (select rex from md.ids) from notifications where kind = 'holds_released'
              and member_id = '00000000-0000-0000-0000-0000000001d1'), 'Rex''s held spots go back, and the link names him');
select md.ok((select status from held_spots where session_id = md.sid('hold_rex')) = 'released'
             and (select status from held_spots where session_id = md.sid('hold_bea')) = 'held', 'Bea''s held spot stays');

select md.ok(public.dog_href('/vaccines', (select rex from md.ids)) = '/vaccines?dog=' || (select rex from md.ids), 'dog_href adds the dog to a link');

drop schema md cascade;
