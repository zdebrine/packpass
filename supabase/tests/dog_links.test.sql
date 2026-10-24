-- Every notification about one dog's class opens that dog (migrations/…_dog_links.sql). One owner, two dogs,
-- both Social cleared with current vaccines. Uses its own accounts.
create schema dl;
-- Members sign the PackPass waiver before booking (…_booking_waivers.sql); this test isn't about waivers.
create function dl.sign_waivers() returns void language sql security definer set search_path = public as $$
  insert into public.waiver_signatures (member_id, waiver_id, signed_name)
  select p.id, w.id, 'Test member' from public.profiles p join public.waivers w on w.active and w.partner_id is null
  on conflict do nothing
$$;
grant usage on schema dl to authenticated;
grant execute on function dl.sign_waivers to authenticated;
create function dl.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
grant usage on schema dl to authenticated;
grant execute on all functions in schema dl to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000002d1', 'kit@two.dogs', '{"name":"Kit Two"}'),
  ('00000000-0000-0000-0000-0000000002d9', 'sam@eastside.links', '{"name":"Sam Links"}');
update profiles set credits_balance = 30 where id = '00000000-0000-0000-0000-0000000002d1';
select public.link_partner_staff('sam@eastside.links', 'eastside', 'trainer');
insert into dogs (owner_id, name, breed) values
  ('00000000-0000-0000-0000-0000000002d1', 'Pip', 'Lab'),
  ('00000000-0000-0000-0000-0000000002d1', 'Moss', 'Collie');
create table dl.ids as select
  (select id from dogs where owner_id = '00000000-0000-0000-0000-0000000002d1' and name = 'Pip') pip,
  (select id from dogs where owner_id = '00000000-0000-0000-0000-0000000002d1' and name = 'Moss') moss;
insert into vaccinations (dog_id, type, expires_on, verified)
select d, t::vaccine_type, current_date + 300, true from dl.ids, unnest(array[pip, moss]) d, unnest(array['rabies', 'dhpp', 'bordetella']) t;
insert into clearances (dog_id, type, scope, partner_id, assessed_on, expires_on)
select d, 'social', 'network', 'eastside', current_date - 30, current_date + 335 from dl.ids, unnest(array[pip, moss]) d;
grant select on dl.ids to authenticated;

create table dl.s (k text primary key, id uuid);
with x as (insert into sessions (class_id, starts_at, capacity, packpass_spots, spots_left) values ('small-group-play', now() + interval '3 days', 5, 5, 5) returning id)
insert into dl.s select 'both', id from x;
with x as (insert into sessions (class_id, starts_at, capacity, packpass_spots, spots_left) values ('small-group-play', now() + interval '4 days', 5, 5, 0) returning id)
insert into dl.s select 'full_far', id from x;
with x as (insert into sessions (class_id, starts_at, capacity, packpass_spots, spots_left) values ('small-group-play', now() + interval '6 hours', 5, 5, 0) returning id)
insert into dl.s select 'full_soon', id from x;
with x as (insert into sessions (class_id, starts_at, capacity, packpass_spots, spots_left) values ('small-group-play', now() + interval '5 days', 5, 5, 5) returning id)
insert into dl.s select 'held', id from x;
with x as (insert into sessions (class_id, starts_at, capacity, packpass_spots, spots_left) values ('small-group-play', now() - interval '1 day', 5, 5, 3) returning id)
insert into dl.s select 'past', id from x;
grant select on dl.s to authenticated;
create function dl.sid(k text) returns uuid language sql stable as $$ select id from dl.s where s.k = sid.k $$;
create function dl.href(kind text, path text, dog uuid) returns boolean language sql stable as $$
  select exists (select 1 from public.notifications n where n.member_id = '00000000-0000-0000-0000-0000000002d1'
                 and n.kind = href.kind and n.href = public.dog_href(path, dog))
$$;
create function dl.count(kind text) returns int language sql stable as $$
  select count(*)::int from public.notifications where member_id = '00000000-0000-0000-0000-0000000002d1' and kind = count.kind
$$;
grant execute on all functions in schema dl to authenticated;

-- Booked: one notification per dog, each opening that dog's class.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000002d1', false);
select dl.sign_waivers();
select public.book_session(dl.sid('both'), (select pip from dl.ids));
select public.book_session(dl.sid('both'), (select moss from dl.ids));
reset role;
select dl.ok(dl.href('booked', '/class/' || dl.sid('both'), (select pip from dl.ids)), 'Pip''s booking opens the class for Pip');
select dl.ok(dl.href('booked', '/class/' || dl.sid('both'), (select moss from dl.ids)), 'Moss''s booking opens the class for Moss');

-- Waitlist, more than 12 hours out: a spot opening books the first dog in line, and says which.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000002d1', false);
select public.join_waitlist((select moss from dl.ids), dl.sid('full_far'));
select public.join_waitlist((select moss from dl.ids), dl.sid('full_soon'));
select public.join_waitlist((select pip from dl.ids), dl.sid('full_soon'));
reset role;
-- (Spots coming back run fill_from_waitlist from a trigger.)
update sessions set spots_left = 1 where id = dl.sid('full_far');
select dl.ok((select status from waitlist where session_id = dl.sid('full_far')) = 'booked', 'a spot opening books Moss off the waitlist');
select dl.ok(dl.href('waitlist_booked', '/class/' || dl.sid('full_far'), (select moss from dl.ids)), 'off the waitlist opens the class for Moss');
select dl.ok(not exists (select 1 from notifications where kind = 'booked' and href like '/class/' || dl.sid('full_far') || '%'),
             'and the plain booked notification stays quiet');

-- Inside 12 hours: each waiting dog hears a spot opened, linked to that dog.
update sessions set spots_left = 1 where id = dl.sid('full_soon');
select dl.ok(not exists (select 1 from waitlist where session_id = dl.sid('full_soon') and status <> 'waiting'), 'inside 12 hours nobody is booked automatically');
select dl.ok(dl.count('waitlist_open') = 2, 'one "spot opened" per waiting dog');
select dl.ok(dl.href('waitlist_open', '/class/' || dl.sid('full_soon'), (select pip from dl.ids))
             and dl.href('waitlist_open', '/class/' || dl.sid('full_soon'), (select moss from dl.ids)), 'each names its dog');

-- Waitlist booking fails (out of credits): the missed notice names the dog.
update profiles set credits_balance = 0 where id = '00000000-0000-0000-0000-0000000002d1';
update sessions set starts_at = now() + interval '2 days' where id = dl.sid('full_soon');
select public.fill_from_waitlist(dl.sid('full_soon'));
select dl.ok(dl.href('waitlist_missed', '/class/' || dl.sid('full_soon'), (select moss from dl.ids)), 'a missed waitlist spot opens the class for Moss');
update profiles set credits_balance = 30 where id = '00000000-0000-0000-0000-0000000002d1';

-- A trainer's note opens that dog's Log. (Staff can't read the member's bookings, so the id goes in a table.)
create table dl.note as select id from bookings where session_id = dl.sid('both') and dog_id = (select moss from dl.ids);
grant select on dl.note to authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000002d9', false);
select public.partner_send_note((select id from dl.note), 'Great recall today.');
reset role;
select dl.ok(dl.href('session_note', '/log', (select moss from dl.ids)), 'a note on Moss opens Moss''s Log');

-- Held spots releasing soon open Today for that dog.
insert into held_spots (session_id, dog_id, member_id, expires_at)
select dl.sid('held'), pip, '00000000-0000-0000-0000-0000000002d1', now() + interval '12 hours' from dl.ids;
select public.remind_expiring_holds();
select dl.ok(dl.href('hold_expiring', '/', (select pip from dl.ids)), 'Pip''s hold reminder opens Today for Pip');

-- A missed class opens that dog's Missed class screen, and checking in afterwards takes it back.
insert into bookings (session_id, dog_id, member_id, credits_charged, status)
select dl.sid('past'), d, '00000000-0000-0000-0000-0000000002d1', 1, 'booked' from dl.ids, unnest(array[pip, moss]) d;
select public.mark_no_shows();
select dl.ok(dl.href('class_missed', '/missed/' || (select id from bookings where session_id = dl.sid('past') and dog_id = (select moss from dl.ids)), (select moss from dl.ids)),
             'Moss''s missed class opens for Moss');
update bookings set status = 'checked_in', checked_in_at = now() where session_id = dl.sid('past') and dog_id = (select moss from dl.ids);
select dl.ok(dl.count('class_missed') = 1, 'checking Moss in afterwards takes back only Moss''s notice');
-- A notice sent before the migration (no dog in the link) is taken back too.
update notifications set href = '/missed/' || (select id from bookings where session_id = dl.sid('past') and dog_id = (select pip from dl.ids))
where kind = 'class_missed' and member_id = '00000000-0000-0000-0000-0000000002d1';
update bookings set status = 'checked_in', checked_in_at = now() where session_id = dl.sid('past') and dog_id = (select pip from dl.ids);
select dl.ok(dl.count('class_missed') = 0, 'an old-style missed notice is taken back too');

-- A partner cancelling the session refunds both dogs and opens Book for each.
select dl.ok(public.cancel_session_for_partner(dl.sid('both'), 'Weather', null) = 2, 'cancelling refunds both dogs'' bookings');
select dl.ok(dl.href('session_cancelled', '/book', (select pip from dl.ids)) and dl.href('session_cancelled', '/book', (select moss from dl.ids)),
             'each cancellation names its dog');

drop schema dl cascade;
