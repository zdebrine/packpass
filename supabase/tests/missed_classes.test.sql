-- Missed classes (migrations/…_missed_classes.sql). Uses its own accounts.
create schema m;
create function m.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
grant usage on schema m to authenticated;
grant execute on all functions in schema m to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'missed@class.co', '{"name":"Mia Missed"}');
insert into dogs (owner_id, name, breed) values ('00000000-0000-0000-0000-0000000000d1', 'Rex', 'Lab');

-- Four past sessions of a 60-minute-or-so class: one long over, one that just ended, one the partner cancelled,
-- one the dog was checked in to.
create table m.s (k text primary key, id uuid);
with x as (insert into sessions (class_id, starts_at, capacity, packpass_spots, spots_left)
           values ('agility-drop-in', now() - interval '1 day', 6, 6, 5) returning id)
insert into m.s select 'over', id from x;
with x as (insert into sessions (class_id, starts_at, capacity, packpass_spots, spots_left)
           select 'agility-drop-in', now() - make_interval(mins => duration_min) - interval '30 minutes', 6, 6, 5
           from class_types where id = 'agility-drop-in' returning id)
insert into m.s select 'just_ended', id from x;
with x as (insert into sessions (class_id, starts_at, capacity, packpass_spots, spots_left, cancelled_at)
           values ('agility-drop-in', now() - interval '2 days', 6, 6, 5, now() - interval '3 days') returning id)
insert into m.s select 'cancelled', id from x;
with x as (insert into sessions (class_id, starts_at, capacity, packpass_spots, spots_left)
           values ('agility-drop-in', now() - interval '3 days', 6, 6, 5) returning id)
insert into m.s select 'attended', id from x;

insert into bookings (session_id, dog_id, member_id, credits_charged, status)
select s.id, d.id, d.owner_id, 2, case when s.k = 'attended' then 'checked_in' else 'booked' end::booking_status
from m.s s, dogs d where d.owner_id = '00000000-0000-0000-0000-0000000000d1';
create table m.b as select s.k, b.id from bookings b join m.s s on s.id = b.session_id;
grant select on m.b to authenticated;

select m.ok(public.mark_no_shows() = 1, 'marks one no-show');
select m.ok((select status from bookings where id = (select id from m.b where k = 'over')) = 'no_show', 'the class long over is missed');
select m.ok((select status from bookings where id = (select id from m.b where k = 'just_ended')) = 'booked', 'a class that just ended waits two hours for a late check-in');
select m.ok((select status from bookings where id = (select id from m.b where k = 'cancelled')) = 'booked', 'a cancelled session is never a no-show');
select m.ok((select status from bookings where id = (select id from m.b where k = 'attended')) = 'checked_in', 'a checked-in dog is left alone');
select m.ok((select count(*) from notifications where kind = 'class_missed' and member_id = '00000000-0000-0000-0000-0000000000d1'
             and href = '/missed/' || (select id from m.b where k = 'over')
             and title = 'Rex missed ' || (select title from class_types where id = 'agility-drop-in')
             and body like '%2 credits were used%') = 1, 'the member is told once, with the credits');
select m.ok(public.mark_no_shows() = 0, 'running again marks nothing');
select m.ok(public.push_kind('class_missed'), 'and it is pushed');

-- The Log shows it, marked as missed.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
select m.ok((select missed and credits = 2 from public.my_log(1) where booking_id = (select id from m.b where k = 'over')), 'the Log marks it missed');
select m.ok((select not missed from public.my_log(1) where booking_id = (select id from m.b where k = 'attended')), 'and not the class the dog went to');
reset role;

-- The partner checks Rex in after all: no longer missed, and the notification goes.
update bookings set status = 'checked_in', checked_in_at = now() where id = (select id from m.b where k = 'over');
select m.ok(not exists (select 1 from notifications where kind = 'class_missed' and member_id = '00000000-0000-0000-0000-0000000000d1'),
            'checking in afterwards takes the notification back');

-- Check-in closes 15 minutes after the start (…_check_in_closes.sql).
create table m.code as select b.id booking, s.id session, s.check_in_code code
from bookings b join sessions s on s.id = b.session_id where b.id = (select id from m.b where k = 'just_ended');
grant select on m.code to authenticated;
update sessions set starts_at = now() - interval '20 minutes' where id = (select session from m.code);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
do $$ begin
  perform public.check_in((select booking from m.code), (select code from m.code));
  raise exception 'FAILED: checked in 20 minutes after the start';
exception when others then
  if sqlerrm <> 'too_late' then raise; end if;
  raise notice 'ok: check-in is closed 20 minutes after the start';
end $$;
reset role;
update sessions set starts_at = now() - interval '10 minutes' where id = (select session from m.code);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
select public.check_in((select booking from m.code), (select code from m.code));
select m.ok((select status from bookings where id = (select booking from m.code)) = 'checked_in', 'and open 10 minutes after');
reset role;

drop schema m cascade;
delete from auth.users where id = '00000000-0000-0000-0000-0000000000d1';
