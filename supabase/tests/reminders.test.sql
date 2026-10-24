-- PackPass › Reminder sequence (migrations/…_reminders.sql). Uses its own account.
create schema rm;
create function rm.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
create function rm.expect_error(q text, want text) returns void language plpgsql as $$
declare got text;
begin
  begin execute q; exception when others then got := sqlerrm; end;
  if got is null or got not like '%' || want || '%' then raise exception 'FAILED: expected error "%" got "%"', want, got; end if;
  raise notice 'ok: rejected with %', want;
end $$;
grant usage on schema rm to authenticated;
grant execute on all functions in schema rm to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'remind@me.co', '{"name":"Rae Minder"}');
select public.seed_demo_member('00000000-0000-0000-0000-0000000000e1');
insert into waiver_signatures (member_id, waiver_id, signed_name)
select '00000000-0000-0000-0000-0000000000e1', id, 'Rae Minder' from waivers where partner_id is null and active;
update profiles set credits_balance = 20 where id = '00000000-0000-0000-0000-0000000000e1';
create table rm.ids as select
  (select id from dogs where owner_id = '00000000-0000-0000-0000-0000000000e1' and name = 'Juno') juno,
  (select id from sessions where class_id = 'sniff-space' and starts_at > now() + interval '3 days' order by starts_at limit 1) s1,
  (select id from sessions where class_id = 'sniff-space' and starts_at > now() + interval '3 days' order by starts_at offset 1 limit 1) s2;
grant select on rm.ids to authenticated;
create function rm.note(k text) returns public.notifications language sql as $$
  select * from public.notifications where member_id = '00000000-0000-0000-0000-0000000000e1' and kind = k order by created_at desc limit 1
$$;
grant execute on function rm.note to authenticated;

-- 1. Booked: credits used and left, stay or drop-off, free cancel time.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
select public.book_session((select s1 from rm.ids), (select juno from rm.ids));
reset role;
select rm.ok((rm.note('booked')).title like 'Booked. Sniff space, % _m.', 'the booked notice names the class and time');
select rm.ok((rm.note('booked')).body ~ '^\d+ credits? used · \d+( of \d+)? left\. .+\. You stay with Juno\. Free cancel until .+\.$', 'with credits, stay rule and free cancel time');
select rm.ok((rm.note('booked')).session_id = (select s1 from rm.ids), 'and the session it''s about');

-- Nothing is due yet.
select rm.ok(public.send_reminders() = 0, 'no reminders days ahead');

-- 2. 24 hours before.
update bookings set created_at = now() - interval '3 days' where session_id = (select s1 from rm.ids);
update sessions set starts_at = now() + interval '23 hours' where id = (select s1 from rm.ids);
select rm.ok(public.send_reminders() = 1, 'the 24-hour reminder goes out');
select rm.ok(public.send_reminders() = 0, 'once');
select rm.ok((rm.note('reminder_24h')).title like 'Tomorrow, %: Sniff space' or (rm.note('reminder_24h')).title like 'Today, %: Sniff space', 'it says when');
select rm.ok((rm.note('reminder_24h')).body like '%Meet at the %. You stay with Juno. Free cancel until %', 'where to meet, the stay rule and free cancel time');
select rm.ok(public.push_kind('reminder_24h') and public.email_kind('reminder_24h'), 'pushed and emailed');

-- 3. 2 hours before.
update sessions set starts_at = now() + interval '90 minutes' where id = (select s1 from rm.ids);
select rm.ok(public.send_reminders() = 1, 'the 2-hour reminder goes out');
select rm.ok((rm.note('reminder_2h')).title = 'In 2 hours: Sniff space', 'In 2 hours');
select rm.ok((rm.note('reminder_2h')).body like '%Free cancel closed %', 'and says the free cancel window closed');
select rm.ok(public.send_reminders() = 0, 'once');

-- A class booked inside both windows gets neither reminder.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
select public.book_session((select s2 from rm.ids), (select juno from rm.ids));
reset role;
update sessions set starts_at = now() + interval '60 minutes' where id = (select s2 from rm.ids);
select rm.ok(public.send_reminders() = 0, 'booked an hour before: no reminder');
select rm.ok((select reminded_2h_at is not null from bookings where session_id = (select s2 from rm.ids)), 'but it''s marked done');

-- Cancelled sessions and bookings get nothing.
select rm.ok(not exists (select 1 from notifications where kind like 'reminder_%' and session_id = (select s2 from rm.ids)), 'nothing for it at all');

-- 5. No booking in 10 days: one nudge, then none until the next booking.
update bookings set status = 'cancelled' where member_id = '00000000-0000-0000-0000-0000000000e1';
update bookings set created_at = now() - interval '11 days' where member_id = '00000000-0000-0000-0000-0000000000e1';
update profiles set created_at = now() - interval '30 days' where id = '00000000-0000-0000-0000-0000000000e1';
select rm.ok(public.send_nudges() >= 1, 'a quiet member gets a nudge');
select rm.ok((rm.note('nudge_10d')).body = 'Two that fit Juno this week.', 'naming their dog');
select rm.ok(public.send_nudges() = 0, 'running it again nudges nobody');
select rm.ok((select count(*) from notifications where member_id = '00000000-0000-0000-0000-0000000000e1' and kind = 'nudge_10d') = 1, 'one nudge per quiet stretch');

-- Email preference and the jobs stay private.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
select public.set_email_reminders(false);
select rm.expect_error($$select public.send_reminders()$$, 'permission denied');
select rm.expect_error($$select * from public.email_context(gen_random_uuid())$$, 'permission denied');
reset role;
select rm.ok((select not email_reminders from profiles where id = '00000000-0000-0000-0000-0000000000e1'), 'members can turn email reminders off');

drop schema rm cascade;
