-- Partner scheduling: templates and series (migrations/…_class_templates.sql). Uses its own accounts and runs in a
-- transaction it rolls back, so the classes it changes are as they were for the tests after it.
begin;
create schema ct;
create function ct.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
create function ct.expect_error(q text, want text) returns void language plpgsql as $$
declare got text;
begin
  begin execute q; exception when others then got := sqlerrm; end;
  if got is null or got not like '%' || want || '%' then raise exception 'FAILED: expected error "%" got "%"', want, got; end if;
  raise notice 'ok: rejected with %', want;
end $$;
create function ct.as_user(id text) returns void language sql as $$ select set_config('request.jwt.claim.sub', id, false) $$;
grant usage on schema ct to authenticated;
grant execute on all functions in schema ct to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'tpl-owner@ridgeline.co', '{"name":"Tia Owner"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'tpl-trainer@eastside.co', '{"name":"Eli Trainer"}'),
  ('00000000-0000-0000-0000-0000000000c3', 'tpl-member@dog.co', '{"name":"Max Member"}');
select public.link_partner_staff('tpl-owner@ridgeline.co', 'ridgeline', 'owner', null);
select public.link_partner_staff('tpl-trainer@eastside.co', 'eastside', 'trainer', null);
select public.seed_demo_member('00000000-0000-0000-0000-0000000000c3');
insert into waiver_signatures (member_id, waiver_id, signed_name)
select '00000000-0000-0000-0000-0000000000c3', id, 'Max Member' from waivers where active and partner_id is null;
-- A Ridgeline waiver the member hasn't signed (made inactive again at the end).
insert into waivers (partner_id, title, body) values ('ridgeline', 'Ridgeline waiver', 'Dogs can get hurt.');
-- Austin dates two and nine weeks out, from a Monday.
create table ct.d as select (date_trunc('week', (now() at time zone 'America/Chicago')::date + 14))::date mon;
grant select on ct.d to authenticated;
create table ct.v (series uuid, n int, copy text, one uuid);
grant select, insert, update on ct.v to authenticated;

set role authenticated;
select ct.as_user('00000000-0000-0000-0000-0000000000c1');

-- Series: Tue and Thu at 5:30 pm for six weeks.
insert into ct.v (series, n)
select series_id, sessions from public.partner_schedule_series('agility-drop-in', '{2,4}', '17:30', (select mon from ct.d), (select mon + 41 from ct.d), 10, 4);
select ct.ok((select n from ct.v) = 12, 'a six-week Tue and Thu series makes 12 sessions');
select ct.ok((select count(*) from partner_sessions(now(), now() + interval '120 days') s
              where s.class_id = 'agility-drop-in' and s.capacity = 10 and s.packpass_spots = 4 and s.spots_left = 4
                and to_char(s.starts_at at time zone 'America/Chicago', 'HH24:MI') = '17:30') >= 12,
             'each with the capacity, PackPass spots and time picked');
select ct.ok((select upcoming from partner_series() where id = (select series from ct.v)) = 12, 'the series lists with 12 to come');
select ct.expect_error($$select public.partner_schedule_series('agility-drop-in', '{2,4}', '17:30', (select mon from ct.d), (select mon + 41 from ct.d), 10, 4)$$, 'no_dates');
select ct.expect_error($$select public.partner_schedule_series('agility-drop-in', '{}', '17:30', (select mon from ct.d), (select mon + 6 from ct.d), 10, 4)$$, 'no_days');
select ct.expect_error($$select public.partner_schedule_series('agility-drop-in', '{1}', '17:30', (select mon from ct.d), (select mon + 200 from ct.d), 10, 4)$$, 'series_range');
select ct.expect_error($$select public.partner_schedule_series('agility-drop-in', '{1}', '17:30', (select mon from ct.d), (select mon + 6 from ct.d), 4, 6)$$, 'bad_capacity');

-- Rules: PackPass spots, the waiver and the waitlist.
select public.partner_set_class_rules('agility-drop-in', 3, false, false);
select ct.ok((select packpass_spots = 3 and not waiver_required and not waitlist_auto and not credit_review from class_types where id = 'agility-drop-in'),
             'booking rules save without a credit review');
select ct.expect_error($$select public.partner_set_class_rules('agility-drop-in', 99, true, true)$$, 'bad_capacity');
update ct.v set one = public.partner_add_session('agility-drop-in', now() + interval '20 days', 8, 3, false);
select ct.ok((select not auto_promote from sessions where id = (select one from ct.v)), 'a new session''s waitlist follows the template');

-- The partner's waiver is asked only when the template uses it.
reset role;
select ct.ok(public.waiver_block('00000000-0000-0000-0000-0000000000c3', (select id from sessions where series_id = (select series from ct.v) order by starts_at limit 1)) is null,
             'no partner waiver for a template that doesn''t use it');
update class_types set waiver_required = true where id = 'agility-drop-in';
select ct.ok(public.waiver_block('00000000-0000-0000-0000-0000000000c3', (select id from sessions where series_id = (select series from ct.v) order by starts_at limit 1)) = 'partner_waiver',
             'and asked for one that does');
set role authenticated;
select ct.as_user('00000000-0000-0000-0000-0000000000c1');

-- Duplicate and archive.
update ct.v set copy = public.partner_duplicate_class('herding-fundamentals');
select ct.ok((select title = 'Copy of Herding Fundamentals' and status = 'live' and credits = 2 and archived_at is null from class_types where id = (select copy from ct.v)),
             'a duplicate keeps the template and its credit cost');
select public.partner_archive_class('herding-fundamentals', true);
select ct.ok((select archived_at is not null from class_types where id = 'herding-fundamentals'), 'archiving marks the template');
select ct.ok(not exists (select 1 from timetable where class_id = 'herding-fundamentals'), 'and stops its weekly repeat');
select ct.expect_error($$select public.partner_schedule_series('herding-fundamentals', '{1}', '08:00', (select mon from ct.d), (select mon + 6 from ct.d), 6, 6)$$, 'archived');
select ct.expect_error($$select public.partner_add_session('herding-fundamentals', now() + interval '9 days', 6, 6, false)$$, 'archived');
select public.partner_archive_class('herding-fundamentals', false);
select ct.ok((select archived_at is null from class_types where id = 'herding-fundamentals'), 'restoring brings it back');

-- Another partner's staff can't touch Ridgeline's templates.
select ct.as_user('00000000-0000-0000-0000-0000000000c2');
select ct.expect_error($$select public.partner_schedule_series('agility-drop-in', '{1}', '08:00', (select mon from ct.d), (select mon + 6 from ct.d), 6, 6)$$, 'not_found');
select ct.expect_error($$select public.partner_duplicate_class('agility-drop-in')$$, 'not_found');
select ct.expect_error($$select public.partner_archive_class('agility-drop-in', true)$$, 'not_found');
select ct.expect_error($$select public.partner_set_class_rules('agility-drop-in', 2, true, true)$$, 'not_found');
select ct.ok(not exists (select 1 from partner_series()), 'and doesn''t see its series');
reset role;

rollback;
