-- Intake calls and 1:1 offers (migrations/…_intake_calls.sql). Uses its own accounts and runs in a transaction it
-- rolls back.
begin;
create schema ic;
create function ic.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
create function ic.expect_error(q text, want text) returns void language plpgsql as $$
declare got text;
begin
  begin execute q; exception when others then got := sqlerrm; end;
  if got is null or got not like '%' || want || '%' then raise exception 'FAILED: expected error "%" got "%"', want, got; end if;
  raise notice 'ok: rejected with %', want;
end $$;
create function ic.as_user(id text) returns void language sql as $$ select set_config('request.jwt.claim.sub', id, false) $$;
grant usage on schema ic to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000ca1', 'ic-member@dog.co', '{"name":"Ivy Member"}'),
  ('00000000-0000-0000-0000-000000000ca2', 'ic-owner@eastside.co', '{"name":"Ian Owner"}'),
  ('00000000-0000-0000-0000-000000000ca3', 'ic-owner@northside.co', '{"name":"Nell Owner"}'),
  ('00000000-0000-0000-0000-000000000ca4', 'ic-other@dog.co', '{"name":"Olga Other"}');
select public.seed_demo_member('00000000-0000-0000-0000-000000000ca1');
select public.seed_demo_member('00000000-0000-0000-0000-000000000ca4');
insert into waiver_signatures (member_id, waiver_id, signed_name)
select '00000000-0000-0000-0000-000000000ca1', id, 'Ivy Member' from waivers where active;
select public.link_partner_staff('ic-owner@eastside.co', 'eastside', 'owner', null);
select public.link_partner_staff('ic-owner@northside.co', 'northside', 'owner', null);
create table ic.v as select
  (select id from dogs where owner_id = '00000000-0000-0000-0000-000000000ca1' and name = 'Juno') juno,
  (select id from dogs where owner_id = '00000000-0000-0000-0000-000000000ca4' and name = 'Juno') other_juno,
  (select id from intake_slots where trainer_id = 'sam' order by starts_at limit 1) slot1,
  (select id from intake_slots where trainer_id = 'sam' order by starts_at offset 1 limit 1) slot2,
  null::uuid call1, null::uuid offer1, null::uuid offer2, null::uuid offer3;
grant select, update on ic.v to authenticated;
create function ic.note(k text) returns public.notifications language sql as $$
  select * from public.notifications where member_id = '00000000-0000-0000-0000-000000000ca1' and kind = k order by created_at desc limit 1
$$;
grant execute on all functions in schema ic to authenticated;

-- The member finds the specialists: Sam with open times, Ana through Calendly.
set role authenticated;
select ic.as_user('00000000-0000-0000-0000-000000000ca1');
select ic.ok((select jsonb_array_length(slots) = 21 and not calendly and phone and focus = 'reactivity, new dogs'
              from public.intake_specialists() where trainer_id = 'sam'), 'Sam is listed with three times a day for a week');
select ic.ok((select calendly and not phone from public.intake_specialists() where trainer_id = 'ana'), 'Ana books through Calendly');

-- Booking checks.
select ic.expect_error($$select public.book_intake((select slot1 from ic.v), (select juno from ic.v), 'phone', null)$$, 'bad_phone');
select ic.expect_error($$select public.book_intake((select slot1 from ic.v), (select juno from ic.v), 'zoom')$$, 'bad_mode');
select ic.expect_error($$select public.book_intake((select slot1 from ic.v), (select other_juno from ic.v), 'video')$$, 'not_your_dog');

-- A video call: free, the time comes off the list, and the link stays hidden until 10 minutes before.
select public.book_intake((select slot1 from ic.v), (select juno from ic.v), 'video');
reset role;
update ic.v set call1 = (select id from intake_calls where slot_id = slot1);
set role authenticated;
select ic.ok((select credits_balance = 7 from public.profiles where id = '00000000-0000-0000-0000-000000000ca1'), 'an intake call costs no credits');
select ic.ok((select jsonb_array_length(slots) = 20 from public.intake_specialists() where trainer_id = 'sam'), 'the booked time comes off the list');
select ic.ok((select link is null and mode = 'video' from public.my_intake_calls() where id = (select call1 from ic.v)), 'the link stays hidden until just before');
select ic.expect_error($$select public.book_intake((select slot2 from ic.v), (select juno from ic.v), 'phone', '512 555 0142')$$, 'already_booked');
select ic.as_user('00000000-0000-0000-0000-000000000ca4');
select ic.expect_error($$select public.book_intake((select slot1 from ic.v), (select other_juno from ic.v), 'video')$$, 'full');
select public.book_intake((select slot2 from ic.v), (select other_juno from ic.v), 'phone', '(512) 555-0142');
reset role;
select ic.ok((select phone = '5125550142' from intake_calls where slot_id = (select slot2 from ic.v)), 'a phone call keeps the number, digits only');

-- 10 minutes before: the link goes out once, and shows in the app.
update intake_calls set starts_at = now() + interval '5 minutes' where id = (select call1 from ic.v);
select ic.ok(public.send_intake_links() = 1 and public.send_intake_links() = 0, 'the link goes out once');
select ic.ok((ic.note('intake_link')).body like '%https://meet.packpass.dev/sam-reyes' and (ic.note('intake_link')).href like '/intake/sam?dog=%', 'the member gets the meeting link');
set role authenticated;
select ic.as_user('00000000-0000-0000-0000-000000000ca1');
select ic.ok((select link = 'https://meet.packpass.dev/sam-reyes' from public.my_intake_calls() where id = (select call1 from ic.v)), 'and it shows on the call');

-- Calendly: shares the dog's profile once and hands back the link.
select ic.ok(public.request_intake('ana', (select juno from ic.v)) = 'https://calendly.com/ana-ruiz/intake', 'a Calendly specialist hands back the link');
select public.request_intake('ana', (select juno from ic.v));
reset role;
select ic.ok((select count(*) = 1 from intake_calls where trainer_id = 'ana' and mode = 'calendly'), 'asking twice is one request');
set role authenticated;
select ic.expect_error($$select public.request_intake('sam', (select juno from ic.v))$$, 'not_found');

-- The partner sees the call with the dog's profile; another partner doesn't.
select ic.as_user('00000000-0000-0000-0000-000000000ca3');
select ic.ok(not exists (select 1 from public.partner_intake_calls() where trainer_id = 'sam'), 'another partner doesn''t see Sam''s calls');
select ic.ok((select count(*) = 1 from public.partner_intake_calls() where trainer_id = 'ana'), 'Ana''s partner sees the Calendly request');
select ic.as_user('00000000-0000-0000-0000-000000000ca2');
select ic.ok((select dog_name = 'Juno' and owner_name = 'Ivy Member' and traits = '{pulls,nervous_dogs}' and offer_id is null
              from public.partner_intake_calls() where id = (select call1 from ic.v)), 'the partner sees Juno''s profile on the call');
select ic.expect_error($$select public.partner_save_intake('sam', 'meet.example.com/sam', null, true, true)$$, 'bad_link');
select ic.expect_error($$select public.partner_save_intake('ana', 'https://meet.example.com/ana', null, true, true)$$, 'not_found');
select ic.ok(public.partner_add_intake_slots('sam', array[now() + interval '20 days', now() - interval '1 day', (select starts_at from intake_slots where id = (select slot2 from ic.v))]) = 1,
             'adding times skips past ones and duplicates');
select ic.expect_error($$select public.partner_remove_intake_slot((select slot2 from ic.v))$$, 'booked');

-- Offering a 1:1.
select ic.expect_error($$select public.partner_offer_private((select call1 from ic.v), 'small-group-play', now() + interval '2 days', '')$$, 'not_private');
select ic.expect_error($$select public.partner_offer_private((select call1 from ic.v), 'calm-private', now() + interval '1 hour', '')$$, 'too_soon');
select public.partner_offer_private((select call1 from ic.v), 'calm-private', now() + interval '3 days', 'Juno settles fast one-on-one.');
reset role;
update ic.v set offer1 = (select id from private_offers where intake_id = call1);
select ic.ok((ic.note('private_offer')).title = 'Sam offered Juno a 1:1.' and (ic.note('private_offer')).body like 'Calm around dogs, % · 3 credits. Book by %.'
             and (ic.note('private_offer')).href like '/offer/' || (select offer1 from ic.v) || '%', 'the owner is told about the offer');
set role authenticated;
select ic.expect_error($$select public.partner_offer_private((select call1 from ic.v), 'calm-private', now() + interval '4 days', '')$$, 'already_offered');

-- Only that member sees the offered session.
select ic.as_user('00000000-0000-0000-0000-000000000ca4');
select ic.ok(not exists (select 1 from public.sessions where id = (select session_id from public.private_offers where id = (select offer1 from ic.v))), 'other members don''t see the offered session');
select ic.as_user('00000000-0000-0000-0000-000000000ca1');
select ic.ok(exists (select 1 from public.sessions s join public.private_offers o on o.session_id = s.id where o.id = (select offer1 from ic.v)), 'the member sees it');
select ic.ok((select status = 'offered' and credits = 3 and note = 'Juno settles fast one-on-one.' and trainer_name = 'Sam Reyes'
              from public.my_private_offers() where id = (select offer1 from ic.v)), 'the member sees the offer');

-- Booked for its credits from the booking sheet (book_session), which closes the offer.
select public.book_session((select session_id from public.private_offers where id = (select offer1 from ic.v)), (select juno from ic.v));
reset role;
select ic.ok((select o.status = 'booked' and b.status = 'booked' and b.credits_charged = 3 from private_offers o join bookings b on b.id = o.booking_id
              where o.id = (select offer1 from ic.v)), 'booking the offer books the 1:1');
select ic.ok((select credits_balance = 4 from public.profiles where id = '00000000-0000-0000-0000-000000000ca1'), 'for its credits');
set role authenticated;
select ic.expect_error($$select public.answer_private_offer((select offer1 from ic.v), true)$$, 'offer_closed');

-- Another time: the offered session is cancelled.
select ic.as_user('00000000-0000-0000-0000-000000000ca2');
select public.partner_offer_private((select call1 from ic.v), 'parallel-walk', now() + interval '5 days', null);
reset role;
update ic.v set offer2 = (select id from private_offers where intake_id = call1 and status = 'offered');
set role authenticated;
select ic.as_user('00000000-0000-0000-0000-000000000ca1');
select public.answer_private_offer((select offer2 from ic.v), false);
reset role;
select ic.ok((select o.status = 'other_time' and s.cancelled_at is not null from private_offers o join sessions s on s.id = o.session_id
              where o.id = (select offer2 from ic.v)), 'asking for another time cancels the offered session');
set role authenticated;
select ic.as_user('00000000-0000-0000-0000-000000000ca2');
select ic.ok((select offer_status = 'other_time' and offer_title = 'Parallel walk' from public.partner_intake_calls() where id = (select call1 from ic.v)),
             'the partner sees they asked for another time');

-- An offer nobody answers expires.
select public.partner_offer_private((select call1 from ic.v), 'parallel-walk', now() + interval '6 days', null);
reset role;
update ic.v set offer3 = (select id from private_offers where intake_id = call1 and status = 'offered');
update private_offers set expires_at = now() - interval '1 minute' where id = (select offer3 from ic.v);
set role authenticated;
select ic.as_user('00000000-0000-0000-0000-000000000ca1');
select ic.expect_error($$select public.answer_private_offer((select offer3 from ic.v), true)$$, 'offer_expired');
reset role;
select ic.ok(public.expire_private_offers() = 1, 'the expiry job closes it');
select ic.ok((select o.status = 'expired' and s.cancelled_at is not null from private_offers o join sessions s on s.id = o.session_id
              where o.id = (select offer3 from ic.v)), 'and cancels its session');

-- Cancelling a call puts the time back.
set role authenticated;
select ic.as_user('00000000-0000-0000-0000-000000000ca4');
select public.cancel_intake((select id from intake_calls where slot_id = (select slot2 from ic.v) and status = 'booked'));
select ic.ok((select exists (select 1 from jsonb_array_elements(slots) x where (x ->> 'id')::uuid = (select slot2 from ic.v))
              from public.intake_specialists() where trainer_id = 'sam'), 'a cancelled call puts the time back');
select ic.expect_error($$select public.cancel_intake((select call1 from ic.v))$$, 'not_found');
reset role;

rollback;
