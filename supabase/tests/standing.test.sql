-- PackPass › Standing bookings (migrations/…_standing_bookings.sql). Uses its own account.
create schema sb;
create function sb.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
create function sb.expect_error(q text, want text) returns void language plpgsql as $$
declare got text;
begin
  begin execute q; exception when others then got := sqlerrm; end;
  if got is null or got not like '%' || want || '%' then raise exception 'FAILED: expected error "%" got "%"', want, got; end if;
  raise notice 'ok: rejected with %', want;
end $$;
grant usage on schema sb to authenticated;
grant execute on all functions in schema sb to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000005b', 'standing@me.co', '{"name":"Stan Ding"}');
select public.seed_demo_member('00000000-0000-0000-0000-00000000005b');
insert into waiver_signatures (member_id, waiver_id, signed_name)
select '00000000-0000-0000-0000-00000000005b', id, 'Stan Ding' from waivers where partner_id is null and active;
-- Vaccines current for the next two months, so every weekly date is open to Juno.
update vaccinations set expires_on = current_date + 365
where dog_id = (select id from dogs where owner_id = '00000000-0000-0000-0000-00000000005b' and name = 'Juno');

-- A weekly class at one time with four dates ahead, all inside this credit month; credits for three of them.
create table sb.ids as
with weekly as (
  select class_id, to_char(starts_at at time zone 'America/Chicago', 'D HH24:MI') slot
  from sessions where starts_at > now() + interval '15 minutes' and cancelled_at is null
  group by 1, 2
  having count(*) >= 4 and bool_and(spots_left > 1)
     and bool_and(public.booking_block((select id from dogs where owner_id = '00000000-0000-0000-0000-00000000005b' and name = 'Juno'), id) is null)
  order by 1, 2 limit 1
)
select (select id from dogs where owner_id = '00000000-0000-0000-0000-00000000005b' and name = 'Juno') juno,
       w.class_id, (select credits from class_types where id = w.class_id) cost,
       array(select s.id from sessions s where s.class_id = w.class_id and s.starts_at > now() + interval '15 minutes' and s.cancelled_at is null
             and to_char(s.starts_at at time zone 'America/Chicago', 'D HH24:MI') = w.slot order by s.starts_at limit 4) dates
from weekly w;
update profiles set credits_balance = 3 * (select cost from sb.ids), credits_reset_on = current_date + 40
where id = '00000000-0000-0000-0000-00000000005b';
-- Juno can join it (nothing in this test is about blockers).
select sb.ok(public.booking_block((select juno from sb.ids), (select dates[1] from sb.ids)) is null, 'Juno can book the weekly class');
grant select on sb.ids to authenticated;
create function sb.booked() returns int language sql as $$
  select count(*)::int from public.bookings where member_id = '00000000-0000-0000-0000-00000000005b' and status = 'booked'
    and series_id is not null
$$;
create function sb.note(k text) returns public.notifications language sql as $$
  select * from public.notifications where member_id = '00000000-0000-0000-0000-00000000005b' and kind = k order by created_at desc limit 1
$$;
create function sb.notes(k text) returns int language sql as $$
  select count(*)::int from public.notifications where member_id = '00000000-0000-0000-0000-00000000005b' and kind = k
$$;
grant execute on all functions in schema sb to authenticated;

-- 1. Repeat weekly until credits run out: the picked date and the next two book; the fourth drops off.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000005b', false);
select sb.expect_error($$select public.start_series((select dates[1] from sb.ids), (select juno from sb.ids), current_date - 1)$$, 'bad_until');
create temp table s1 as select public.start_series((select dates[1] from sb.ids), (select juno from sb.ids)) id;
reset role;
select sb.ok(sb.booked() = 3, 'the first three dates book');
select sb.ok((select credits_balance from profiles where id = '00000000-0000-0000-0000-00000000005b') = 0, 'using every credit');
select sb.ok(not exists (select 1 from notifications where member_id = '00000000-0000-0000-0000-00000000005b' and kind = 'booked' and session_id in (select unnest(dates) from sb.ids)), 'no per-date Booked notices');
select sb.ok((sb.note('series_booked')).title like 'Booked every %day. %', 'one Booked every … notice');
select sb.ok((sb.note('series_booked')).body like '3 dates booked, % to %, until credits run out. Each date has its own free cancel window%', 'listing the dates and the rule');
select sb.ok(sb.notes('series_short') = 1, 'the fourth date drops off');
select sb.ok((sb.note('series_short')).session_id = (select dates[4] from sb.ids), 'the notice names that date');
select sb.ok((sb.note('series_short')).href like '/month%', 'and opens the month');

-- 2. The job says it once, and books nothing new while credits are short.
select sb.ok(public.book_series_ahead() = 0, 'the job books nothing more');
select sb.ok(sb.notes('series_short') = 1, 'and does not repeat the drop-off notice');

-- 3. my_series: the dates and their state.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000005b', false);
create temp table sd as select d->>'session_id' sid, d->>'status' st from public.my_series(), jsonb_array_elements(dates) d;
select sb.ok((select count(*) from sd where st = 'booked') = 3, 'my_series lists the three booked dates');
select sb.ok((select st from sd where sid::uuid = (select dates[4] from sb.ids)) = 'short', 'and the fourth as short');

-- 4. Cancelling one date gives its credits back; the job books the short date and never rebooks the cancelled one.
select public.cancel_booking((select id from bookings where session_id = (select dates[2] from sb.ids) and member_id = auth.uid()));
reset role;
select sb.ok(public.book_series_ahead() = 1, 'the job books the date that dropped off');
select sb.ok((select status from bookings where session_id = (select dates[4] from sb.ids) and member_id = '00000000-0000-0000-0000-00000000005b') = 'booked', 'that is the fourth');
select sb.ok((select count(*) from bookings where session_id = (select dates[2] from sb.ids) and member_id = '00000000-0000-0000-0000-00000000005b') = 1, 'the cancelled date stays cancelled');
select sb.ok((sb.note('series_booked')).title like 'Standing booking: 1 more date of %', 'the job says what it added');
select sb.ok(public.book_series_ahead() = 0, 'running it again books nothing');

-- 5. Ending the series cancels the dates still free to cancel, and stops the job.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000005b', false);
select sb.ok(public.end_series((select id from s1)) = 3, 'ending cancels the three booked dates');
select sb.ok(not exists (select 1 from public.my_series()), 'and the series is gone from my_series');
select sb.expect_error($$select public.end_series((select id from s1))$$, 'not_found');
reset role;
select sb.ok((select credits_balance from profiles where id = '00000000-0000-0000-0000-00000000005b') = 3 * (select cost from sb.ids), 'with every credit back');

-- 6. Someone else's series is out of reach, and the jobs are not callable by members.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000005c', 'other@me.co');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000005c', false);
select sb.ok(not exists (select 1 from public.booking_series), 'another member sees no series');
select sb.expect_error($$select public.end_series((select id from s1))$$, 'not_found');
select sb.expect_error('select public.book_series_ahead()', 'permission denied');
select sb.expect_error($$select public.fill_series((select id from s1))$$, 'permission denied');
reset role;

drop schema sb cascade;
