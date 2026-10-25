-- Report cards, homework ticks and no-shows from the roster (migrations/…_report_cards.sql). Uses its own accounts and
-- runs in a transaction it rolls back.
begin;
create schema rc;
create function rc.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
create function rc.expect_error(q text, want text) returns void language plpgsql as $$
declare got text;
begin
  begin execute q; exception when others then got := sqlerrm; end;
  if got is null or got not like '%' || want || '%' then raise exception 'FAILED: expected error "%" got "%"', want, got; end if;
  raise notice 'ok: rejected with %', want;
end $$;
create function rc.as_user(id text) returns void language sql as $$ select set_config('request.jwt.claim.sub', id, false) $$;
grant usage on schema rc to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000002c1', 'rc-member@dog.co', '{"name":"Remy Member"}'),
  ('00000000-0000-0000-0000-0000000002c2', 'rc-owner@southfork.co', '{"name":"Rae Owner"}'),
  ('00000000-0000-0000-0000-0000000002c3', 'rc-trainer@eastside.co', '{"name":"Ezra Trainer"}'),
  ('00000000-0000-0000-0000-0000000002c4', 'rc-other@dog.co', '{"name":"Otto Other"}');
select public.seed_demo_member('00000000-0000-0000-0000-0000000002c1');
select public.seed_demo_member('00000000-0000-0000-0000-0000000002c4');
insert into waiver_signatures (member_id, waiver_id, signed_name)
select '00000000-0000-0000-0000-0000000002c1', id, 'Remy Member' from waivers where active;
update profiles set credits_balance = 20 where id = '00000000-0000-0000-0000-0000000002c1';
select public.link_partner_staff('rc-owner@southfork.co', 'southfork', 'owner', null);
select public.link_partner_staff('rc-trainer@eastside.co', 'eastside', 'trainer', null);
create table rc.v as select
  (select id from dogs where owner_id = '00000000-0000-0000-0000-0000000002c1' and name = 'Juno') juno,
  (select id from sessions where class_id = 'sniff-space' and starts_at > now() + interval '3 days' order by starts_at limit 1) s1,
  (select id from sessions where class_id = 'sniff-space' and starts_at > now() + interval '3 days' order by starts_at offset 1 limit 1) s2,
  (select id from sessions where class_id = 'sniff-space' and starts_at > now() + interval '3 days' order by starts_at offset 2 limit 1) s3,
  null::uuid b1, null::uuid b2, null::uuid b3;
grant select, update on rc.v to authenticated;
create function rc.note(k text) returns public.notifications language sql as $$
  select * from public.notifications where member_id = '00000000-0000-0000-0000-0000000002c1' and kind = k order by created_at desc limit 1
$$;
grant execute on all functions in schema rc to authenticated;

-- Juno books three sessions; the first two then run (moved into the past).
set role authenticated;
select rc.as_user('00000000-0000-0000-0000-0000000002c1');
select public.book_session((select s1 from rc.v), (select juno from rc.v));
select public.book_session((select s2 from rc.v), (select juno from rc.v));
select public.book_session((select s3 from rc.v), (select juno from rc.v));
reset role;
update rc.v set b1 = (select id from bookings where session_id = s1 and status = 'booked'),
                b2 = (select id from bookings where session_id = s2 and status = 'booked'),
                b3 = (select id from bookings where session_id = s3 and status = 'booked');
update sessions set starts_at = now() - interval '2 hours' where id = (select s1 from rc.v);
update sessions set starts_at = now() - interval '1 hour' where id = (select s2 from rc.v);

-- The partner sees both dogs due.
set role authenticated;
select rc.as_user('00000000-0000-0000-0000-0000000002c2');
select rc.ok((select count(*) = 2 from public.partner_report_cards(7) r where r.dog_id = (select juno from rc.v) and r.sent_at is null), 'both sessions show a report card due');
select rc.ok((select count(*) between 1 and 8 from public.partner_homework_options((select s1 from rc.v))), 'homework drills are offered');

-- Checks on what's sent.
select rc.expect_error($$select public.partner_send_report_card((select b3 from rc.v), 2, 2, 2, 'Good', '[]')$$, 'too_early');
select rc.expect_error($$select public.partner_send_report_card((select b1 from rc.v), 4, 2, 2, 'Good', '[]')$$, 'bad_rating');
select rc.expect_error($$select public.partner_send_report_card((select b1 from rc.v), 2, 2, 2, 'Good', '[{"text":"a"},{"text":"b"},{"text":"c"},{"text":"d"}]')$$, 'bad_homework');
select rc.expect_error($$select public.partner_send_report_card((select b1 from rc.v), 2, 2, 2, 'Good', '[{"text":"Do it","drill":"no-such-drill"}]')$$, 'bad_homework');
select rc.as_user('00000000-0000-0000-0000-0000000002c3');
select rc.expect_error($$select public.partner_send_report_card((select b1 from rc.v), 2, 2, 2, 'Good', '[]')$$, 'not_found');

-- Sent with a note and two homework items: the card, the session note, the check-in and the owner's notification.
select rc.as_user('00000000-0000-0000-0000-0000000002c2');
select public.partner_send_report_card((select b1 from rc.v), 3, 1, 2, 'Great focus through the tunnel.',
  '[{"text":"Mat at home","drill":"mat-at-home"},{"text":"Watch dogs from 20 m. Reward calm looks."}]', '{Settle}');
reset role;
select rc.ok((select focus = 3 and sociability = 1 and skill = 2 and jsonb_array_length(homework) = 2 from report_cards where booking_id = (select b1 from rc.v)), 'the report card is saved');
select rc.ok((select note = 'Great focus through the tunnel.' and skills = '{Settle}' from session_notes where booking_id = (select b1 from rc.v)), 'the note is the session note');
select rc.ok((select status = 'checked_in' from bookings where id = (select b1 from rc.v)), 'sending checks the dog in');
select rc.ok((rc.note('session_note')).title like '% left a note for Juno.'
             and (rc.note('session_note')).body like 'Great focus through the tunnel. Two homework items until %.'
             and (rc.note('session_note')).href like '/after-class/%', 'the owner is told, with the homework');

-- The member sees it and ticks homework off; each tick is practice in the Log.
set role authenticated;
select rc.as_user('00000000-0000-0000-0000-0000000002c1');
select rc.ok((select note = 'Great focus through the tunnel.' and done = '{}' and open_until = (select starts_at from sessions where id = (select s2 from rc.v))
              from public.my_report_cards() where booking_id = (select b1 from rc.v)), 'the member sees the card, open until the next class');
select public.tick_homework((select b1 from rc.v), 0, true);
select rc.ok((select a.drill_id = 'mat-at-home' and a.duration_min = d.minutes and a.skills = array[d.skill_id]
              from home_activities a join drills d on d.id = 'mat-at-home' join homework_ticks t on t.activity_id = a.id
              where t.booking_id = (select b1 from rc.v) and t.item = 0), 'a drill tick logs that drill');
select rc.ok(public.tick_homework((select b1 from rc.v), 0, true) = (select activity_id from homework_ticks where booking_id = (select b1 from rc.v) and item = 0),
             'ticking twice logs it once');
select public.tick_homework((select b1 from rc.v), 1, true);
select rc.ok((select a.kind = 'train' and a.duration_min = 5 and a.note like 'Watch dogs%' from home_activities a join homework_ticks t on t.activity_id = a.id
              where t.booking_id = (select b1 from rc.v) and t.item = 1), 'the trainer''s own words log as training');
select public.tick_homework((select b1 from rc.v), 0, false);
select rc.ok((select done = '{1}' from public.my_report_cards() where booking_id = (select b1 from rc.v))
             and not exists (select 1 from home_activities where drill_id = 'mat-at-home' and dog_id = (select juno from rc.v)), 'unticking takes it out of the Log');
select rc.expect_error($$select public.tick_homework((select b1 from rc.v), 5, true)$$, 'not_found');
select rc.as_user('00000000-0000-0000-0000-0000000002c4');
select rc.expect_error($$select public.tick_homework((select b1 from rc.v), 0, true)$$, 'not_found');
select rc.ok(not exists (select 1 from public.my_report_cards()), 'another member doesn''t see it');

-- Updating keeps the ticks unless the homework changed, and doesn't tell the owner again.
select rc.as_user('00000000-0000-0000-0000-0000000002c2');
select public.partner_send_report_card((select b1 from rc.v), 3, 2, 2, 'Great focus through the tunnel.',
  '[{"text":"Mat at home","drill":"mat-at-home"},{"text":"Watch dogs from 20 m. Reward calm looks."}]', '{Settle}');
reset role;
select rc.ok(exists (select 1 from homework_ticks where booking_id = (select b1 from rc.v) and item = 1), 'same homework keeps the ticks');
select rc.ok((select count(*) = 1 from notifications where member_id = '00000000-0000-0000-0000-0000000002c1' and kind = 'session_note'), 'an update isn''t a new notification');
set role authenticated;
select public.partner_send_report_card((select b1 from rc.v), 3, 2, 2, '', '[{"text":"Hand target before meals"}]');
reset role;
select rc.ok(not exists (select 1 from homework_ticks where booking_id = (select b1 from rc.v)), 'new homework starts the ticks over');
select rc.ok(exists (select 1 from home_activities where dog_id = (select juno from rc.v) and note like 'Watch dogs%'), 'and what was logged stays in the Log');
select rc.ok(not exists (select 1 from session_notes where booking_id = (select b1 from rc.v)), 'a card without a note has no session note');

-- No-shows from the roster.
set role authenticated;
select rc.as_user('00000000-0000-0000-0000-0000000002c2');
select rc.ok((select sent_at is not null from public.partner_report_cards(7) where booking_id = (select b1 from rc.v)), 'a card without a note still counts as sent');
select rc.expect_error($$select public.partner_mark_no_show((select b3 from rc.v))$$, 'too_early');
select rc.expect_error($$select public.partner_mark_no_show((select b1 from rc.v))$$, 'not_booked');
select public.partner_mark_no_show((select b2 from rc.v));
reset role;
select rc.ok((select status = 'no_show' from bookings where id = (select b2 from rc.v)), 'a dog who didn''t come is marked a no-show');
select rc.ok((rc.note('class_missed')).href like '/missed/' || (select b2 from rc.v) || '%', 'and the owner gets the Missed class notification');
set role authenticated;
select rc.expect_error($$select public.partner_mark_no_show((select b2 from rc.v))$$, 'not_booked');
select public.partner_mark_no_show((select b2 from rc.v), true);
reset role;
select rc.ok((select status = 'booked' from bookings where id = (select b2 from rc.v)), 'undo puts it back');
select rc.ok(not exists (select 1 from notifications where kind = 'class_missed' and href like '/missed/' || (select b2 from rc.v) || '%'), 'and takes the notification back');
set role authenticated;
select rc.as_user('00000000-0000-0000-0000-0000000002c3');
select rc.expect_error($$select public.partner_mark_no_show((select b2 from rc.v))$$, 'not_found');
reset role;

rollback;
