-- Partner dashboard functions (migrations/…_partner_dashboard.sql). Runs after booking.test.sql on
-- the same database; uses its own accounts.
create schema p;
create function p.expect_error(q text, want text) returns void language plpgsql as $$
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
create function p.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
create function p.as_user(id text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', id, false)
$$;
grant usage, create on schema p to authenticated;
grant execute on all functions in schema p to authenticated;

-- Accounts: a Ridgeline owner (also trainer Maren), an Eastside trainer, a member with Juno.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@ridgeline.co', '{"name":"Rae Owner"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'sam@eastside.co', '{"name":"Sam Reyes"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'member@dog.co', '{"name":"Mia Member"}'),
  ('00000000-0000-0000-0000-0000000000a4', 'lena@southfork.co', '{"name":"Lena Brooks"}');
update sessions set capacity = capacity + 2, packpass_spots = packpass_spots + 2, spots_left = spots_left + 2 where class_id = 'herding-fundamentals';
select public.seed_demo_member('00000000-0000-0000-0000-0000000000a3');
-- A second member whose Juno has Social (so group classes are open to her).
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a5', 'second@dog.co');
select public.seed_demo_member('00000000-0000-0000-0000-0000000000a5');
insert into clearances (dog_id, type, scope, partner_id, assessed_on, expires_on)
values ((select id from dogs where owner_id = '00000000-0000-0000-0000-0000000000a5' and name = 'Juno'), 'social', 'network', 'eastside', current_date, current_date + 365);
select public.link_partner_staff('owner@ridgeline.co', 'ridgeline', 'owner', 'maren');
select public.link_partner_staff('sam@eastside.co', 'eastside', 'trainer', 'sam');
select public.link_partner_staff('lena@southfork.co', 'southfork', 'trainer', 'lena');
create table p.ids as select
  (select id from dogs where owner_id = '00000000-0000-0000-0000-0000000000a3' and name = 'Juno') juno,
  (select b.id from bookings b join dogs d on d.id = b.dog_id where d.owner_id = '00000000-0000-0000-0000-0000000000a3') hf_booking,
  (select b.session_id from bookings b join dogs d on d.id = b.dog_id where d.owner_id = '00000000-0000-0000-0000-0000000000a3') hf;
grant select on p.ids to authenticated;

-- ---- Who can see what ----------------------------------------------------------------------------
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a1');
select p.ok(public.my_partner() = 'ridgeline', 'a staff account belongs to its partner');
select p.ok((select count(*) from public.partner_sessions(now(), now() + interval '7 days')) > 0
            and not exists (select 1 from public.partner_sessions(now(), now() + interval '7 days') x join class_types c on c.id = x.class_id where c.partner_id <> 'ridgeline'),
            'staff see only their own sessions');
select p.ok((select check_in_code from public.partner_sessions(now(), now() + interval '30 days') where id = (select hf from p.ids)) ~ '^\d{4}$', 'staff see the check-in code');
select p.ok((select booked from public.partner_sessions(now(), now() + interval '30 days') where id = (select hf from p.ids)) >= 1, 'and how many dogs are booked');
select p.ok((select dog_name from public.partner_roster((select hf from p.ids)) where booking_id = (select hf_booking from p.ids)) = 'Juno', 'the roster lists the booked dog');
select p.ok((select owner_name || ' · ' || vaccine_line from public.partner_roster((select hf from p.ids)) where booking_id = (select hf_booking from p.ids)) like 'Mia Member · Bordetella expires%', 'with the owner and the vaccine that runs out soonest');
select p.as_user('00000000-0000-0000-0000-0000000000a3');
select p.expect_error($$select * from public.partner_sessions(now(), now() + interval '7 days')$$, 'not_partner');
select p.expect_error($$select * from public.partner_roster((select hf from p.ids))$$, 'not_partner');
select p.as_user('00000000-0000-0000-0000-0000000000a2');
select p.ok(not exists (select 1 from public.partner_roster((select hf from p.ids))), 'another partner gets an empty roster');
select p.expect_error($$select public.partner_check_in((select hf_booking from p.ids))$$, 'not_found');

-- ---- Check-in, capacity, waitlist switches -------------------------------------------------------
select p.as_user('00000000-0000-0000-0000-0000000000a1');
select public.partner_check_in((select hf_booking from p.ids));
select p.ok((select status from public.partner_roster((select hf from p.ids)) where booking_id = (select hf_booking from p.ids)) = 'checked_in', 'staff can check a dog in by hand');
select public.partner_check_in((select hf_booking from p.ids), true);
select p.ok((select status from public.partner_roster((select hf from p.ids)) where booking_id = (select hf_booking from p.ids)) = 'booked', 'and undo it');
create table p.cap as select packpass_spots - spots_left taken, capacity from sessions where id = (select hf from p.ids);
grant select on p.cap to authenticated;
select p.expect_error($$select public.partner_update_session((select hf from p.ids), 10, (select taken from p.cap) - 1, true, true)$$, 'below_booked');
select public.partner_update_session((select hf from p.ids), 12, (select taken from p.cap), false, true);
reset role;
select p.ok((select spots_left = 0 and capacity = 12 and not waitlist_open from sessions where id = (select hf from p.ids)), 'staff set capacity, PackPass spots and the waitlist switch');
-- A member can't join a closed waitlist.
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a5');
select p.expect_error($$select public.join_waitlist((select id from dogs where name = 'Juno'), (select hf from p.ids))$$, 'waitlist_closed');

-- ---- Adding sessions -----------------------------------------------------------------------------
select p.as_user('00000000-0000-0000-0000-0000000000a1');
create table p.added as select public.partner_add_session('agility-drop-in', date_trunc('day', now()) + interval '9 days 15 hours', 10, 6, true) id;
reset role;
select p.ok((select capacity = 10 and packpass_spots = 6 and spots_left = 6 from sessions where id = (select id from p.added)), 'staff add a session with its own capacity');
select p.ok(exists (select 1 from timetable t where t.class_id = 'agility-drop-in' and t.starts = ((date_trunc('day', now()) + interval '9 days 15 hours') at time zone 'America/Chicago')::time), 'a repeating session joins the weekly timetable');
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a1');
select p.expect_error($$select public.partner_add_session('scent-work', now() + interval '2 days', 6, 6, false)$$, 'not_found');

-- ---- Blocking dates -------------------------------------------------------------------------------
reset role;
create table p.blk as select s.id, (s.starts_at at time zone 'America/Chicago')::date d
from sessions s where s.class_id = 'agility-drop-in' and s.starts_at > now() + interval '3 days' and s.cancelled_at is null order by s.starts_at limit 1;
grant select on p.blk to authenticated;
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a5');
select public.book_session((select id from p.blk), (select id from dogs where name = 'Juno'));
reset role;
create table p.before as select credits_balance c from profiles where id = '00000000-0000-0000-0000-0000000000a5';
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a1');
select p.ok((select sessions >= 1 and dogs = 1 from public.partner_block_dates((select d from p.blk), (select d from p.blk), 'Weather', 'Field is flooded.')), 'blocking a day reports the sessions and dogs affected');
reset role;
select p.ok((select cancelled_at is not null and cancel_reason = 'Weather' from sessions where id = (select id from p.blk)), 'the sessions are cancelled');
select p.ok((select credits_balance from profiles where id = '00000000-0000-0000-0000-0000000000a5') = (select c from p.before) + 2, 'booked dogs get their credits back');
select p.ok(exists (select 1 from notifications where member_id = '00000000-0000-0000-0000-0000000000a5' and kind = 'session_cancelled' and body like '%(weather). 2 credits are back%Field is flooded.'), 'and the owner is told why');
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a5');
select p.ok(not exists (select 1 from sessions where id = (select id from p.blk)), 'members no longer see a cancelled session');
select p.expect_error($$select public.book_session((select id from p.blk), (select id from dogs where name = 'Juno'))$$, 'cancelled');

-- Weekly repeat on and off. Free roam runs daily; stopping one weekday keeps the other six.
reset role;
create table p.rep as select s.id, extract(dow from s.starts_at at time zone 'America/Chicago')::int dw, (s.starts_at at time zone 'America/Chicago')::time t
from sessions s where s.class_id = 'free-roam' and s.starts_at > now() + interval '1 day' and s.cancelled_at is null order by s.starts_at limit 1;
grant select on p.rep to authenticated;
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a2');
select public.partner_set_repeat((select id from p.rep), false);
reset role;
select p.ok((select count(*) from timetable where class_id = 'free-roam' and starts = (select t from p.rep)) = 6
            and not exists (select 1 from timetable where class_id = 'free-roam' and weekday = (select dw from p.rep)), 'stopping a daily class''s repeat drops only that weekday');
set role authenticated;
select public.partner_set_repeat((select id from p.rep), true);
reset role;
select p.ok((select count(*) from timetable where class_id = 'free-roam' and starts = (select t from p.rep)) = 7, 'and turning it back on restores it');

-- Cancelling one session.
reset role;
create table p.one as select s.id from sessions s where s.class_id = 'herding-livestock' and s.starts_at > now() + interval '1 day' and s.cancelled_at is null order by s.starts_at limit 1;
grant select on p.one to authenticated;
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a2');
select p.expect_error($$select public.partner_cancel_session((select id from p.one), 'Trainer away')$$, 'not_found');
select p.as_user('00000000-0000-0000-0000-0000000000a1');
select p.ok(public.partner_cancel_session((select id from p.one), 'Trainer away') = 0, 'staff cancel one session');
select p.expect_error($$select public.partner_cancel_session((select id from p.one), 'Again')$$, 'not_found');

-- ---- Session notes ---------------------------------------------------------------------------------
reset role;
update sessions set starts_at = now() - interval '2 hours' where id = (select hf from p.ids);
update bookings set status = 'checked_in', checked_in_at = now() - interval '2 hours' where id = (select hf_booking from p.ids);
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a1');
select p.ok(exists (select 1 from public.partner_notes(7) where booking_id = (select hf_booking from p.ids) and note is null), 'a session that ran shows up as needing a note');
select p.expect_error($$select public.partner_send_note((select hf_booking from p.ids), '  ')$$, 'empty_note');
select public.partner_send_note((select hf_booking from p.ids), 'Great recall today. Work on waiting at the gate.', array['Recall', 'Gate wait']);
select public.partner_send_note((select hf_booking from p.ids), 'Great recall today. Work on the gate wait next time.', array['Recall']);
reset role;
select p.ok((select note from session_notes where booking_id = (select hf_booking from p.ids)) like '%next time.', 'staff send a note and can edit it');
select p.ok((select count(*) from notifications where member_id = '00000000-0000-0000-0000-0000000000a3' and kind = 'session_note') = 1
            and (select title from notifications where member_id = '00000000-0000-0000-0000-0000000000a3' and kind = 'session_note') = 'Note on Juno from Maren',
            'the owner is told once, by the trainer''s name');
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a3');
select p.ok((select count(*) from session_notes) = 1, 'the owner can read the note');

-- ---- Assessments ------------------------------------------------------------------------------------
reset role;
insert into sessions (class_id, starts_at, capacity, packpass_spots, spots_left) values
  ('herding-assessment', now() - interval '1 hour', 1, 1, 0), ('social-assessment', now() - interval '3 hours', 1, 1, 0);
insert into bookings (session_id, dog_id, member_id, credits_charged) values
  ((select id from sessions where class_id = 'herding-assessment' and starts_at < now() order by starts_at desc limit 1), (select juno from p.ids), '00000000-0000-0000-0000-0000000000a3', 2),
  ((select id from sessions where class_id = 'social-assessment' and starts_at < now() order by starts_at desc limit 1), (select juno from p.ids), '00000000-0000-0000-0000-0000000000a3', 2);
create table p.asb as select
  (select b.id from bookings b join sessions s on s.id = b.session_id where s.class_id = 'herding-assessment' and b.dog_id = (select juno from p.ids)) herding,
  (select b.id from bookings b join sessions s on s.id = b.session_id where s.class_id = 'social-assessment' and b.dog_id = (select juno from p.ids) and s.starts_at < now()) social;
grant select on p.asb to authenticated;
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a1');
select p.ok(exists (select 1 from public.partner_assessments() where booking_id = (select herding from p.asb) and outcome is null), 'assessment bookings wait for a result');
select public.partner_record_result((select herding from p.asb), 'cleared', array['Stock awareness', 'Responds to a stop'], array['Calm at the gate']);
reset role;
select p.ok(exists (select 1 from clearances where dog_id = (select juno from p.ids) and type = 'herding' and scope = 'partner' and partner_id = 'ridgeline' and assessor = 'Maren Holt'),
            'a pass grants Herding at this partner, signed by the trainer');
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a1');
select p.expect_error($$select public.partner_record_result((select herding from p.asb), 'cleared')$$, 'already_recorded');
select p.expect_error($$select public.partner_record_result((select social from p.asb), 'cleared')$$, 'not_found');
select p.as_user('00000000-0000-0000-0000-0000000000a2');
reset role;
delete from dog_paths where dog_id = (select juno from p.ids);
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a2');
select public.partner_record_result((select social from p.asb), 'not_yet', '{}', array['Greets new dogs calmly'], 'Close. Two sessions of distance work first.', true);
reset role;
select p.ok(exists (select 1 from dog_paths where dog_id = (select juno from p.ids) and path_id = 'calm-around-dogs' and completed_at is null), 'not yet, with a goal, starts the path to Social');
select p.ok(exists (select 1 from notifications where member_id = '00000000-0000-0000-0000-0000000000a3' and kind = 'assessment_result' and body like 'Close.%training path%'), 'and tells the owner');

-- ---- The member's Log -------------------------------------------------------------------------------
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a3');
select p.ok((select note from public.my_log() where booking_id = (select hf_booking from p.ids)) like 'Great recall%'
            and (select note_by from public.my_log() where booking_id = (select hf_booking from p.ids)) = 'Maren Holt',
            'the Log shows the session with the trainer''s note');
select p.ok((select outcome = 'cleared' and assessed = 'herding' from public.my_log() where booking_id = (select herding from p.asb))
            and (select outcome = 'not_yet' and quote like 'Close.%' from public.my_log() where booking_id = (select social from p.asb)),
            'and assessment results, cleared or not yet');
select p.ok(not exists (select 1 from public.my_log() where starts_at > now()), 'upcoming sessions aren''t in the Log yet');
select p.as_user('00000000-0000-0000-0000-0000000000a5');
select p.ok(not exists (select 1 from public.my_log() where booking_id in ((select hf_booking from p.ids), (select herding from p.asb))), 'members only see their own Log');
reset role;
select p.expect_error($$set local role anon; select public.my_log()$$, 'permission denied');

-- ---- Training path progress ---------------------------------------------------------------------------
reset role;
select p.ok((select next_step from dog_paths where dog_id = (select juno from p.ids) and path_id = 'calm-around-dogs') = 1, 'Juno starts Calm around dogs at step 1');
insert into sessions (class_id, starts_at, capacity, packpass_spots, spots_left) values
  ('calm-private', now() - interval '5 hours', 1, 1, 0), ('parallel-walk', now() - interval '4 hours', 1, 1, 0), ('small-group-play', now() - interval '20 hours', 6, 6, 5);
insert into bookings (session_id, dog_id, member_id, credits_charged)
select s.id, (select juno from p.ids), '00000000-0000-0000-0000-0000000000a3', 2 from sessions s
where s.starts_at < now() and s.starts_at > now() - interval '1 day' and s.class_id in ('calm-private', 'parallel-walk', 'small-group-play')
  and s.capacity <= 6 and not exists (select 1 from bookings b where b.session_id = s.id);
create table p.steps as select
  (select b.id from bookings b join sessions s on s.id = b.session_id where s.class_id = 'calm-private' and b.dog_id = (select juno from p.ids) and s.starts_at < now() order by s.starts_at desc limit 1) one,
  (select b.id from bookings b join sessions s on s.id = b.session_id where s.class_id = 'parallel-walk' and b.dog_id = (select juno from p.ids) and s.starts_at < now() order by s.starts_at desc limit 1) two,
  (select b.id from bookings b join sessions s on s.id = b.session_id where s.class_id = 'small-group-play' and b.dog_id = (select juno from p.ids) and s.starts_at < now() order by s.starts_at desc limit 1) play;
grant select on p.steps to authenticated;
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a2');
select public.partner_check_in((select play from p.steps));
reset role;
select p.ok((select next_step from dog_paths where dog_id = (select juno from p.ids) and path_id = 'calm-around-dogs') = 1, 'a later step''s class doesn''t count out of order');
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a2');
select public.partner_check_in((select one from p.steps));
reset role;
select p.ok((select next_step from dog_paths where dog_id = (select juno from p.ids) and path_id = 'calm-around-dogs') = 2
            and exists (select 1 from dog_path_steps where dog_id = (select juno from p.ids) and path_id = 'calm-around-dogs' and position = 1 and booking_id = (select one from p.steps)),
            'checking in to the current step''s class completes the step');
select p.ok(exists (select 1 from notifications where member_id = '00000000-0000-0000-0000-0000000000a3' and kind = 'path_step' and title = 'Step 1 of 4 done' and body like 'Distance work · Juno. Next: Parallel walk.'),
            'and tells the owner what''s next');
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a2');
select public.partner_send_note((select two from p.steps), 'Walked the fence line calmly twice.', '{}');
reset role;
select p.ok((select status from bookings where id = (select two from p.steps)) = 'checked_in'
            and (select next_step from dog_paths where dog_id = (select juno from p.ids) and path_id = 'calm-around-dogs') = 3,
            'a session note checks the dog in, which moves the path on');
-- Undoing a check-in takes the step back.
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a2');
select public.partner_check_in((select two from p.steps), true);
reset role;
select p.ok((select next_step from dog_paths where dog_id = (select juno from p.ids) and path_id = 'calm-around-dogs') = 2
            and not exists (select 1 from dog_path_steps where booking_id = (select two from p.steps)),
            'undoing a check-in takes back the step it completed');
select p.ok(not exists (select 1 from notifications where member_id = '00000000-0000-0000-0000-0000000000a3' and title = 'Step 2 of 4 done')
            and exists (select 1 from notifications where member_id = '00000000-0000-0000-0000-0000000000a3' and title = 'Step 1 of 4 done'),
            'and its notification');
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a2');
select public.partner_check_in((select two from p.steps));
select public.partner_check_in((select one from p.steps), true);
reset role;
select p.ok((select next_step from dog_paths where dog_id = (select juno from p.ids) and path_id = 'calm-around-dogs') = 3
            and (select count(*) from dog_path_steps where dog_id = (select juno from p.ids)) = 2
            and (select count(*) from notifications where member_id = '00000000-0000-0000-0000-0000000000a3' and title = 'Step 2 of 4 done') = 1,
            'checking in again redoes it; undoing an earlier step keeps later progress');
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a3');
select p.ok((select count(*) from public.my_paths((select juno from p.ids))) = 2, 'my_paths lists every path');
select p.ok((select next_step = 3 and steps -> 0 ->> 'done_at' is not null and steps -> 1 ->> 'done_at' is not null and steps -> 2 ->> 'done_at' is null
             from public.my_paths((select juno from p.ids)) where path_id = 'calm-around-dogs'), 'with the date each step was done');
select p.ok((select started_at is null from public.my_paths((select juno from p.ids)) where path_id = 'loose-leash-walking'), 'and paths the dog hasn''t started');
select p.ok((select count(*) from dog_path_steps) = 2, 'owners read their dog''s step history');
select p.as_user('00000000-0000-0000-0000-0000000000a5');
select p.ok(not exists (select 1 from public.my_paths((select juno from p.ids))) and not exists (select 1 from dog_path_steps where dog_id = (select juno from p.ids)),
            'other members can''t see another dog''s paths');
reset role;
-- A path's last step: checking in completes the path, and undoing that reopens it.
insert into dog_paths (dog_id, path_id, next_step) values ((select juno from p.ids), 'loose-leash-walking', 3);
insert into sessions (class_id, starts_at, capacity, packpass_spots, spots_left) values ('focus-recall', now() - interval '3 hours', 1, 1, 0);
create table p.last (id uuid);
with nb as (
  insert into bookings (session_id, dog_id, member_id, credits_charged)
  select id, (select juno from p.ids), '00000000-0000-0000-0000-0000000000a3', 2 from sessions where class_id = 'focus-recall' and starts_at < now() order by starts_at desc limit 1
  returning id) insert into p.last select id from nb;
update bookings set status = 'checked_in' where id = (select id from p.last);
select p.ok((select completed_at is not null from dog_paths where dog_id = (select juno from p.ids) and path_id = 'loose-leash-walking')
            and exists (select 1 from notifications where member_id = '00000000-0000-0000-0000-0000000000a3' and title = 'Loose leash walking is complete'),
            'checking in to a path''s last step completes it');
update bookings set status = 'booked' where id = (select id from p.last);
select p.ok((select completed_at is null and next_step = 3 from dog_paths where dog_id = (select juno from p.ids) and path_id = 'loose-leash-walking')
            and not exists (select 1 from notifications where member_id = '00000000-0000-0000-0000-0000000000a3' and title = 'Loose leash walking is complete'),
            'undoing that check-in reopens the path');
delete from dog_paths where dog_id = (select juno from p.ids) and path_id = 'loose-leash-walking';

-- ---- Vet records ------------------------------------------------------------------------------------
reset role;
insert into storage.objects (bucket_id, name, owner) values
  ('vaccine-docs', '00000000-0000-0000-0000-0000000000a3/' || (select juno from p.ids) || '/1-record.pdf', '00000000-0000-0000-0000-0000000000a3');
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a1');
select p.ok((select count(*) from storage.objects where bucket_id = 'vaccine-docs') = 1, 'staff can open the vet record of a dog booked with them');
select public.partner_check_vaccines((select juno from p.ids));
select p.as_user('00000000-0000-0000-0000-0000000000a4');
select p.ok((select count(*) from storage.objects where bucket_id = 'vaccine-docs') = 0, 'other partners can''t');
select p.expect_error($$select public.partner_check_vaccines((select juno from p.ids))$$, 'not_found');
reset role;
select p.ok((select bool_and(verified) from vaccinations where dog_id = (select juno from p.ids)), 'staff mark the vaccines as checked');

-- ---- Classes and trainers ------------------------------------------------------------------------------
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a1');
create table p.newc as select public.partner_save_class(null, '{"title":"Treibball Basics","discipline":"Treibball","category":"sport","session_type":"class","duration_min":60,"intensity":3,"group_size":6,"balance":"physical","description":"Dogs push big balls into a goal.","image":"grass","energy":["High"],"sociability":["Loves dogs"],"requirements":[]}') id;
select p.ok((select status = 'in_review' and credits is null from class_types where id = (select id from p.newc)), 'a new class waits for PackPass to set its credits');
select p.as_user('00000000-0000-0000-0000-0000000000a3');
select p.ok(not exists (select 1 from class_types where id = (select id from p.newc)), 'members don''t see classes in review');
select p.as_user('00000000-0000-0000-0000-0000000000a1');
select public.partner_save_class('agility-drop-in', '{"title":"Agility drop-in","discipline":"Agility","category":"sport","session_type":"class","duration_min":60,"intensity":4,"group_size":8,"balance":"physical","description":"Longer course."}');
reset role;
select p.ok((select credit_review and status = 'live' and credits = 2 from class_types where id = 'agility-drop-in'), 'a longer class goes for a credit review and keeps its price meanwhile');
insert into timetable (class_id, starts) values ((select id from p.newc), '06:00');
select public.extend_schedule();
select p.ok(not exists (select 1 from sessions where class_id = (select id from p.newc)), 'classes in review get no sessions');
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a2');
select p.expect_error($$select public.partner_save_class('agility-drop-in', '{"title":"Hijack","category":"sport","duration_min":10,"intensity":1,"group_size":2,"balance":"physical"}')$$, 'not_found');
select p.expect_error($$select public.partner_save_trainer('maren', 'x', '{}', true)$$, 'not_found');
select p.as_user('00000000-0000-0000-0000-0000000000a1');
select public.partner_save_trainer('maren', 'Maren runs the herding program.', array['Herding', 'Recall'], false);
reset role;
select p.ok((select bio like 'Maren runs%' and specialties = array['Herding', 'Recall'] and not private_sessions from trainers where id = 'maren'), 'staff edit their trainer profiles');
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a1');
select public.partner_save_location(' Gravel lot by the gate ', '');
reset role;
select p.ok((select parking = 'Gravel lot by the gate' and meet_at is null from partners where id = 'ridgeline'), 'staff edit parking and meeting notes');

-- ---- Earnings -----------------------------------------------------------------------------------------
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a1');
select p.ok((select count(*) from public.partner_earnings(6)) = 6, 'earnings cover the last six months');
select p.ok((select credits >= 4 and amount_cents = credits * 950 from public.partner_earnings(1)), 'this month counts the sessions that ran, at $9.50 a credit');
select p.ok(exists (select 1 from public.partner_earnings_by_class() where class_id = 'herding-fundamentals'), 'broken down by class');
select p.as_user('00000000-0000-0000-0000-0000000000a2');
select p.expect_error($$select * from public.partner_earnings(6)$$, 'not_owner');
select p.expect_error($$select * from public.partner_earnings_by_class()$$, 'not_owner');
reset role;

-- ---- Team -------------------------------------------------------------------------------------------------
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a2');
select p.expect_error($$select * from public.partner_team()$$, 'not_owner');
select p.expect_error($$select public.partner_invite('x@y.co', 'trainer', null, 'X Y')$$, 'not_owner');
select p.as_user('00000000-0000-0000-0000-0000000000a3');
select p.expect_error($$select * from public.partner_team()$$, 'not_partner');
select p.as_user('00000000-0000-0000-0000-0000000000a1');
select p.ok((select count(*) = 1 and bool_and(is_me and role = 'owner' and trainer_name = 'Maren Holt') from public.partner_team()), 'an owner sees their team');
select p.expect_error($$select public.partner_invite('not an email', 'trainer', 'dev')$$, 'bad_email');
select p.expect_error($$select public.partner_invite('jo@ridgeline.co', 'trainer')$$, 'needs_trainer');
select p.expect_error($$select public.partner_invite('jo@ridgeline.co', 'trainer', 'sam')$$, 'bad_trainer');
select p.expect_error($$select public.partner_invite('jo@ridgeline.co', 'trainer', 'maren')$$, 'trainer_taken');
select p.expect_error($$select public.partner_invite('SAM@eastside.co', 'trainer', 'dev')$$, 'staff_elsewhere');
select p.expect_error($$select public.partner_invite('owner@ridgeline.co', 'owner')$$, 'already_staff');
select p.ok(public.partner_invite(' Jo@Ridgeline.co ', 'trainer', null, 'Jo Park') = 'invited', 'an email without an account is invited');
select p.ok((select count(*) = 1 and bool_and(email = 'jo@ridgeline.co' and trainer_name = 'Jo Park') from public.partner_team() where kind = 'invite'),
            'with a new trainer profile for them');
select p.expect_error($$select public.partner_invite('other@ridgeline.co', 'trainer', (select trainer_id from public.partner_team() where email = 'jo@ridgeline.co'))$$, 'trainer_taken');
reset role;
select p.ok((select partner_id = 'ridgeline' and credential is null from trainers where name = 'Jo Park'), 'the profile belongs to the partner, without a credential');
-- Jo signs up: nothing happens until the email is confirmed.
insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-0000000000b1', 'jo@ridgeline.co', null);
select p.ok(not exists (select 1 from partner_staff where user_id = '00000000-0000-0000-0000-0000000000b1'), 'an unconfirmed account isn''t added');
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-0000000000b1';
select p.ok((select partner_id = 'ridgeline' and role = 'trainer' and trainer_id = (select id from trainers where name = 'Jo Park') from partner_staff where user_id = '00000000-0000-0000-0000-0000000000b1'),
            'confirming the email joins the team, signed in as their trainer profile');
select p.ok(not exists (select 1 from partner_invites where email = 'jo@ridgeline.co'), 'and uses up the invite');
-- An existing account is added straight away.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b2', 'dev@ridgeline.co');
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a1');
select p.ok(public.partner_invite('dev@ridgeline.co', 'trainer', 'dev') = 'linked', 'an existing account is added straight away');
select p.ok((select count(*) from public.partner_team() where kind = 'staff') = 3, 'and shows on the team');
select p.ok(public.partner_invite('later@ridgeline.co', 'owner') = 'invited', 'owners can be invited without a trainer profile');
select public.partner_cancel_invite((select id::uuid from public.partner_team() where email = 'later@ridgeline.co'));
select p.ok(not exists (select 1 from public.partner_team() where email = 'later@ridgeline.co'), 'an invite can be cancelled');
select p.expect_error($$select public.partner_remove_staff('00000000-0000-0000-0000-0000000000a1')$$, 'is_me');
select p.expect_error($$select public.partner_remove_staff('00000000-0000-0000-0000-0000000000a2')$$, 'not_found');
select public.partner_remove_staff('00000000-0000-0000-0000-0000000000b2');
select p.as_user('00000000-0000-0000-0000-0000000000b2');
select p.ok(public.my_partner() is null, 'someone removed from the team loses the dashboard');
select p.as_user('00000000-0000-0000-0000-0000000000b1');
select p.expect_error($$select * from public.partner_team()$$, 'not_owner');
reset role;
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a1');
select public.partner_invite('again@ridgeline.co', 'owner');
select p.ok(not exists (select 1 from public.partner_invites), 'invites aren''t readable directly, only through the team functions');
reset role;

-- ---- PackPass admin ----------------------------------------------------------------------------------------
reset role;
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000a6', 'ops@packpass.co', '{"name":"Ops"}');
insert into packpass_admins (user_id) values ('00000000-0000-0000-0000-0000000000a6');
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a1');
select p.expect_error($$select * from public.admin_review_queue()$$, 'not_admin');
select p.expect_error($$select public.admin_set_class('agility-drop-in', 1, false, 'live')$$, 'not_admin');
select p.ok(not public.is_packpass_admin(), 'partner staff aren''t admins');
select p.as_user('00000000-0000-0000-0000-0000000000a6');
select p.ok(public.is_packpass_admin(), 'admins are listed by account');
select p.ok(exists (select 1 from public.admin_review_queue() where id = (select id from p.newc) and status = 'in_review'), 'new classes wait in the review queue');
select p.expect_error($$select public.admin_set_class((select id from p.newc), 0, false, 'live')$$, 'bad_credits');
select public.admin_set_class((select id from p.newc), 3, false, 'live');
reset role;
select p.ok((select status = 'live' and credits = 3 and not credit_review from class_types where id = (select id from p.newc)), 'an admin sets the credits and puts the class live');
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a6');
select p.ok(not exists (select 1 from public.admin_review_queue() where id = (select id from p.newc)), 'and it leaves the queue');
create table p.np as select public.admin_save_partner(null, '{"name":"North Loop Dogs","address":"5000 Burnet Rd","street":"Burnet Rd","type":"trainer","lat":30.32,"lng":-97.74}') id;
select p.ok((select id from p.np) = 'north-loop-dogs', 'admins add partners');
select p.ok(public.admin_save_trainer(null, 'north-loop-dogs', 'Priya Shah', 'CPDT-KA') = 'priya', 'and trainers');
select public.admin_link_staff('member@dog.co', 'north-loop-dogs', 'trainer', 'priya');
select p.expect_error($$select public.admin_link_staff('nobody@nowhere.co', 'north-loop-dogs', 'owner')$$, 'no_account');
select p.expect_error($$select public.admin_link_staff('member@dog.co', 'north-loop-dogs', 'trainer', 'maren')$$, 'bad_trainer');
select p.ok(exists (select 1 from public.admin_staff() where email = 'member@dog.co' and partner_id = 'north-loop-dogs' and trainer_name = 'Priya Shah'), 'and link staff accounts');
select p.ok((select staff = 1 and trainers = 1 from public.admin_partners() where id = 'north-loop-dogs'), 'the partner list counts staff and trainers');
select p.as_user('00000000-0000-0000-0000-0000000000a3');
select p.ok(public.my_partner() = 'north-loop-dogs', 'the linked account opens that partner''s dashboard');
select p.expect_error($$select public.admin_unlink_staff('00000000-0000-0000-0000-0000000000a3')$$, 'not_admin');
select p.as_user('00000000-0000-0000-0000-0000000000a6');
select public.admin_unlink_staff('00000000-0000-0000-0000-0000000000a3');
select p.expect_error($$select public.admin_unlink_staff('00000000-0000-0000-0000-0000000000a3')$$, 'not_found');
select p.as_user('00000000-0000-0000-0000-0000000000a3');
select p.ok(public.my_partner() is null and exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-0000000000a3'),
            'an admin can unlink an account, which keeps it as a member account');
reset role;

-- ---- Partner applications ---------------------------------------------------------------------------------
reset role;
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000b3', 'maya@northsidebarn.co', '{"name":"Maya Okafor"}');
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a1');
select p.expect_error($$select public.save_application('{"business_name":"X"}')$$, 'already_partner');
select p.as_user('00000000-0000-0000-0000-0000000000b3');
select public.save_application('{"partner_type":"trainer","business_name":"Northside Barn","address":"1180 Hollis Rd, Austin, TX","phone":"(512) 555-0142"}');
select p.ok((select status = 'draft' and contact_name = 'Maya Okafor' and business_name = 'Northside Barn' from partner_applications), 'an applicant saves a draft, named from their account');
select p.expect_error($$select public.submit_application()$$, 'incomplete');
select public.save_application('{"services":["Agility","Herding"],"formats":["Group drop-in"],"wheres":["Outdoors"],"group_size":"5 to 8","legal_name":"Northside Barn LLC"}');
select p.ok((select business_name = 'Northside Barn' and services = array['Agility', 'Herding'] from partner_applications), 'saving some fields keeps the rest');
select p.expect_error($$select public.submit_application()$$, 'missing_docs');
insert into storage.objects (bucket_id, name) values ('partner-docs', '00000000-0000-0000-0000-0000000000b3/license.pdf');
select p.expect_error($$insert into storage.objects (bucket_id, name) values ('partner-docs', '00000000-0000-0000-0000-0000000000a1/x.pdf')$$, 'row-level security');
select public.add_application_doc('license', '00000000-0000-0000-0000-0000000000b3/license.pdf', 'license.pdf', 1200);
select public.add_application_doc('insurance', '00000000-0000-0000-0000-0000000000b3/coi.pdf', 'coi.pdf', 900);
select p.expect_error($$select public.add_application_doc('certs', '00000000-0000-0000-0000-0000000000a1/c.pdf', 'c.pdf', 1)$$, 'not_found');
select p.expect_error($$select public.submit_application()$$, 'missing_docs');
create table p.cert as select public.add_application_doc('certs', '00000000-0000-0000-0000-0000000000b3/cert.pdf', 'cert.pdf', 600) id;
select public.submit_application();
select p.ok((select status = 'submitted' and submitted_at is not null from partner_applications), 'with license, insurance and certifications in, it can be submitted');
select p.expect_error($$select public.save_application('{"business_name":"Y"}')$$, 'submitted');
select p.expect_error($$select public.remove_application_doc((select id from p.cert))$$, 'submitted');
select p.as_user('00000000-0000-0000-0000-0000000000a2');
select p.ok(not exists (select 1 from partner_applications) and not exists (select 1 from storage.objects where bucket_id = 'partner-docs'), 'other accounts can''t see an application or its files');
select p.expect_error($$select * from public.admin_applications()$$, 'not_admin');
select p.as_user('00000000-0000-0000-0000-0000000000a6');
select p.ok((select count(*) from storage.objects where bucket_id = 'partner-docs') = 1, 'admins can open applicants'' files');
select p.ok((select jsonb_array_length(docs) = 3 and email = 'maya@northsidebarn.co' from public.admin_applications() where business_name = 'Northside Barn'), 'admins see the application with its documents');
create table p.app as select id from public.admin_applications() where business_name = 'Northside Barn';
grant select on p.app to authenticated;
select p.expect_error($$select public.admin_decide_application((select id from p.app), false, '')$$, 'needs_reason');
select public.admin_decide_application((select id from p.app), false, 'The insurance certificate expired in March. Upload the current one.');
select p.as_user('00000000-0000-0000-0000-0000000000b3');
select p.ok((select status = 'declined' and decline_reason like 'The insurance%' from partner_applications), 'a declined applicant sees why');
select p.expect_error($$select public.admin_decide_application((select id from p.app), true)$$, 'not_admin');
select public.remove_application_doc((select id from p.cert));
select p.ok((select status = 'draft' from partner_applications) and not exists (select 1 from partner_application_docs where kind = 'certs'), 'and can edit it again');
select public.add_application_doc('certs', '00000000-0000-0000-0000-0000000000b3/cert2.pdf', 'cert2.pdf', 600);
select public.submit_application();
select p.as_user('00000000-0000-0000-0000-0000000000a6');
select p.expect_error($$select public.admin_decide_application(gen_random_uuid(), true)$$, 'not_found');
select p.ok(public.admin_decide_application((select id from p.app), true) = 'northside-barn', 'approving creates the partner');
select p.expect_error($$select public.admin_decide_application((select id from p.app), true)$$, 'not_found');
reset role;
select p.ok((select type = 'trainer' and street = 'Hollis Rd' and address = '1180 Hollis Rd, Austin, TX' from partners where id = 'northside-barn'), 'from the business details');
select p.ok((select role = 'owner' and partner_id = 'northside-barn' and trainer_id = (select id from trainers where partner_id = 'northside-barn' and name = 'Maya Okafor')
             from partner_staff where user_id = '00000000-0000-0000-0000-0000000000b3'), 'with the applicant as owner and, as an independent trainer, their trainer profile');
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000b3');
select p.ok(public.my_partner() = 'northside-barn' and (select status = 'approved' from partner_applications), 'their dashboard opens');
select p.expect_error($$select public.save_application('{}')$$, 'already_partner');
reset role;

-- ---- Website leads -----------------------------------------------------------------------------------------
grant usage on schema p to anon;
grant execute on all functions in schema p to anon;
set role anon;
select public.submit_partner_lead('Trainer', 'Ana Ruiz', 'Ruiz Dog Training', 'Ana@RuizDogs.com', '78702');
select public.submit_partner_lead('Sport club', 'Ana Ruiz', 'Ruiz Dog Sport', 'ana@ruizdogs.com', '78702');
select p.expect_error($$select public.submit_partner_lead('Trainer', 'A', 'X', 'a@b.co', '78702')$$, 'bad_name');
select p.expect_error($$select public.submit_partner_lead('Trainer', 'Ana', 'Ruiz', 'not-an-email', '78702')$$, 'bad_email');
select p.expect_error($$select public.submit_partner_lead('Trainer', 'Ana', 'Ruiz', 'a@b.co', '787')$$, 'bad_zip');
select p.expect_error($$select public.submit_partner_lead('Groomer', 'Ana', 'Ruiz', 'a@b.co', '78702')$$, 'bad_type');
select p.ok(not exists (select 1 from public.partner_leads), 'the website can''t read leads back');
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a1');
select p.ok(not exists (select 1 from public.partner_leads), 'nobody reads leads directly');
select p.expect_error($$select * from public.admin_partner_leads()$$, 'not_admin');
select p.as_user('00000000-0000-0000-0000-0000000000a6');
select p.ok((select count(*) = 1 and bool_and(business_name = 'Ruiz Dog Sport' and email = 'ana@ruizdogs.com' and not applied) from public.admin_partner_leads()),
            'the website saves partner leads, one a day per email, for admins');
select p.ok((select applied from public.admin_partner_leads() where email = 'maya@northsidebarn.co') is null, 'leads only list who submitted');
reset role;

-- Founding-pack signups from the owner page, for admins only.
set role anon;
select public.submit_owner_waitlist(' Jo@Example.com ', '60614', 'high', '{leash_reactive}', 'regular');
select public.submit_owner_waitlist('jo@example.com', '60622', 'medium', '{}', null);
select p.expect_error($$select * from public.admin_owner_waitlist()$$, 'permission denied');
reset role;
select p.as_user('00000000-0000-0000-0000-0000000000a1');
select p.expect_error($$select * from public.admin_owner_waitlist()$$, 'not_admin');
select p.as_user('00000000-0000-0000-0000-0000000000a6');
select p.ok((select count(*) = 1 and bool_and(email = 'jo@example.com' and zip = '60622' and energy = 'medium' and plan is null and traits = '{}')
             from public.admin_owner_waitlist()), 'admins see founding-pack signups, one per email, latest answers');
reset role;

-- ---- Trait catalog and drop-off classes (copy refresh, phase 1) ---------------------------------------
set role anon;
select p.ok((select count(*) from public.traits) = 16, 'anyone can read the trait catalog');
select p.ok((select label = 'Loses it at dogs on walks' and partner_label like 'Leash reactive%' and path_id = 'calm-around-dogs' from public.traits where id = 'leash_reactive'),
            'each trait has an owner label, a partner label and the path it starts');
select p.expect_error($$select public.trait_ids('{x}')$$, 'permission denied');
reset role;
select p.ok(public.trait_ids('{"Pulls on the leash","Barks at bikes","Nervous with new dogs","pulls"}') = '{pulls,"Barks at bikes",nervous_dogs,pulls}',
            'old labels map to ids in order, and anything else is kept as is');
select p.ok(public.trait_ids('{}') = '{}', 'no traits stay no traits');
select p.ok((select traits = '{pulls,nervous_dogs}' from dogs where owner_id = '00000000-0000-0000-0000-0000000000a3' and name = 'Juno'), 'the demo dog is seeded with ids');
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a1');
create table p.drop as select
  public.partner_save_class(null, '{"title":"Agility drop-off","discipline":"Agility","category":"sport","session_type":"class","duration_min":60,"intensity":3,"group_size":6,"balance":"physical","drop_off":true}') a,
  public.partner_save_class(null, '{"title":"Recall 1:1","discipline":"Skills","category":"skills","session_type":"private","duration_min":45,"intensity":2,"balance":"mental","drop_off":true}') b,
  public.partner_save_class(null, '{"title":"Plain group class","discipline":"Agility","category":"sport","session_type":"class","duration_min":60,"intensity":3,"group_size":6,"balance":"physical"}') c;
reset role;
select p.ok((select drop_off from class_types where id = (select a from p.drop)), 'a partner can make a group class drop-off');
select p.ok((select not drop_off from class_types where id = (select b from p.drop)), 'privates are never drop-off');
select p.ok((select not drop_off from class_types where id = (select c from p.drop)), 'classes default to owners staying');
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a1');
select public.partner_save_class((select a from p.drop), '{"title":"Agility drop-off","discipline":"Agility","category":"sport","session_type":"class","duration_min":60,"intensity":3,"group_size":6,"balance":"physical"}');
reset role;
select p.ok((select drop_off from class_types where id = (select a from p.drop)), 'saving without the flag keeps it');
set role authenticated;
select p.as_user('00000000-0000-0000-0000-0000000000a1');
select public.partner_save_class((select a from p.drop), '{"title":"Agility drop-off","discipline":"Agility","category":"sport","session_type":"private","duration_min":60,"intensity":3,"balance":"physical","drop_off":true}');
reset role;
select p.ok((select not drop_off from class_types where id = (select a from p.drop)), 'turning a class into a private clears drop-off');
select p.expect_error($$update class_types set drop_off = true where id = 'herding-assessment'$$, 'class_types_drop_off_classes_only');

drop schema p cascade;
