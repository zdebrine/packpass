-- Path classes and Social only where the class asks for it (migrations/…_path_classes.sql). Uses its own
-- accounts and dog: Chaco, 3 years old, on step 3 (Small-group play) of Calm around dogs, no Social yet.
create schema pc;
create function pc.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
create function pc.expect_error(q text, want text) returns void language plpgsql as $$
declare got text;
begin
  begin
    execute q;
  exception when others then
    got := sqlerrm;
  end;
  if got is null or got not like '%' || want || '%' then raise exception 'FAILED: expected error "%" but got "%"', want, got; end if;
  raise notice 'ok: rejected with %', want;
end $$;
create function pc.as_user(id text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', id, false)
$$;
grant usage, create on schema pc to authenticated;
grant execute on all functions in schema pc to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000007c1', 'chaco@owner.co', '{"name":"Zed Owner"}'),
  ('00000000-0000-0000-0000-0000000007c2', 'pathclass@eastside.co', '{"name":"Eastside Trainer"}'),
  ('00000000-0000-0000-0000-0000000007c4', 'pathclass@packpass.co', '{"name":"PackPass Admin"}');
insert into packpass_admins (user_id) values ('00000000-0000-0000-0000-0000000007c4');
select public.link_partner_staff('pathclass@eastside.co', 'eastside', 'trainer', 'sam');

create table pc.ids (k text primary key, id uuid);
with x as (insert into dogs (owner_id, name, birth_year, birth_month, weight_lb, fixed)
           values ('00000000-0000-0000-0000-0000000007c1', 'Chaco', extract(year from now())::int - 3, extract(month from now())::int, 40, true) returning id)
insert into pc.ids select 'chaco', id from x;
insert into vaccinations (dog_id, type, expires_on, verified)
select (select id from pc.ids where k = 'chaco'), t::vaccine_type, current_date + 300, true from unnest(array['rabies', 'dhpp', 'bordetella']) t;
insert into dog_paths (dog_id, path_id, next_step) values ((select id from pc.ids where k = 'chaco'), 'calm-around-dogs', 3);
create function pc.chaco() returns uuid language sql as $$ select id from pc.ids where k = 'chaco' $$;
grant select on pc.ids to authenticated;

-- A session of a class three days out. Added in its own statement, so booking_block (stable) sees it.
create table pc.s (k text primary key, id uuid);
create function pc.add_session(cls text) returns void language sql as $$
  with x as (insert into public.sessions (class_id, starts_at, capacity, packpass_spots, spots_left)
             values (cls, now() + interval '3 days', 5, 5, 5) returning id)
  insert into pc.s select cls, id from x
$$;
create function pc.session(cls text) returns uuid language sql as $$ select id from pc.s where k = cls $$;
grant select on pc.s to authenticated;
create function pc.step3() returns jsonb language sql as $$
  select s from public.my_paths(pc.chaco()) p, jsonb_array_elements(p.steps) s where p.path_id = 'calm-around-dogs' and (s ->> 'position')::int = 3
$$;

-- ---- The catalog's classes keep the old rule -----------------------------------------------------------
select pc.ok((select count(*) from path_step_classes) = (select count(*) from path_steps), 'every step''s own class is a Path class for it');
select pc.add_session('fitness');
select pc.add_session('small-group-play');
select pc.ok(public.booking_block(pc.chaco(), pc.session('fitness')) = 'needs_social', 'a catalog group class still needs Social');
select pc.ok(public.booking_block(pc.chaco(), pc.session('small-group-play')) is null, 'a dog on the path can book the step''s Path class');

-- ---- Chaco's case: the step's class is seniors only ----------------------------------------------------
update class_types set min_age_months = 96 where id = 'small-group-play';
set role authenticated;
select pc.as_user('00000000-0000-0000-0000-0000000007c1');
select pc.ok(pc.step3() -> 'options' = '[]'::jsonb, 'a seniors-only Path class isn''t offered to a 3-year-old');
select pc.ok(pc.step3() ->> 'class_id' = 'small-group-play', 'the step still names its own class when none fits');
reset role;

-- A class the partner set to no clearance can be booked by any dog with current vaccines.
set role authenticated;
select pc.as_user('00000000-0000-0000-0000-0000000007c2');
create table pc.made as select public.partner_save_class(null, '{"title":"Afternoon pack play","discipline":"Play","category":"play",
  "session_type":"class","duration_min":45,"intensity":2,"group_size":5,"balance":"social","clearance":""}'::jsonb) id;
select pc.ok((select requires is null from class_types where id = (select id from pc.made)), 'None saves no clearance');
reset role;
update class_types set status = 'live' where id = (select id from pc.made);
select pc.add_session((select id from pc.made));
select pc.ok(public.booking_block(pc.chaco(), pc.session((select id from pc.made))) is null, 'a group class with no clearance doesn''t ask for Social');

-- A class that asks for Social blocks Chaco until the partner marks it a Path class for step 3.
set role authenticated;
select pc.as_user('00000000-0000-0000-0000-0000000007c2');
create table pc.social as select public.partner_save_class(null, '{"title":"Calm group play","discipline":"Play","category":"play",
  "session_type":"class","duration_min":45,"intensity":2,"group_size":5,"balance":"social","clearance":"social"}'::jsonb) id;
reset role;
update class_types set status = 'live' where id = (select id from pc.social);
select pc.add_session((select id from pc.social));
create table pc.sess as select pc.session((select id from pc.social)) id;
select pc.ok(public.booking_block(pc.chaco(), (select id from pc.sess)) = 'needs_social', 'a class set to Social needs it');

set role authenticated;
select pc.as_user('00000000-0000-0000-0000-0000000007c2');
select pc.expect_error($$select public.admin_set_path_steps((select id from pc.social), '[{"path_id":"calm-around-dogs","position":3}]')$$, 'not_admin');
select pc.expect_error($$select * from public.admin_path_classes()$$, 'not_admin');
select pc.as_user('00000000-0000-0000-0000-0000000007c4');
select public.admin_set_path_steps((select id from pc.social), '[{"path_id":"calm-around-dogs","position":3},{"path_id":"calm-around-dogs","position":4}]');
reset role;
select pc.ok((select array_agg(position) from path_step_classes where class_id = (select id from pc.social)) = '{3}',
             'PackPass marks a class for a step (not the assessment step)');
select pc.ok(public.booking_block(pc.chaco(), (select id from pc.sess)) is null, 'Chaco, on the path, can book the Path class');
set role authenticated;
select pc.as_user('00000000-0000-0000-0000-0000000007c1');
select pc.ok(pc.step3() -> 'options' = jsonb_build_array((select id from pc.social)), 'the path offers the Path class Chaco can join');
select pc.ok(pc.step3() ->> 'class_id' = (select id from pc.social), 'and names it as the step''s class');
reset role;

-- Checking in to it finishes the step.
insert into bookings (session_id, dog_id, member_id, credits_charged)
values ((select id from pc.sess), pc.chaco(), '00000000-0000-0000-0000-0000000007c1', 1);
update bookings set status = 'checked_in', checked_in_at = now() where session_id = (select id from pc.sess) and dog_id = pc.chaco();
select pc.ok((select next_step from dog_paths where dog_id = pc.chaco() and path_id = 'calm-around-dogs') = 4, 'checking in to a Path class finishes the step');

-- Unmarking it takes it off the path.
set role authenticated;
select pc.as_user('00000000-0000-0000-0000-0000000007c4');
select pc.ok((select steps from public.admin_path_classes() where id = (select id from pc.social)) = '[{"path_id": "calm-around-dogs", "position": 3}]'::jsonb,
             'PackPass sees the steps a class counts for');
select public.admin_set_path_steps((select id from pc.social), '[]');
reset role;
select pc.ok(not exists (select 1 from path_step_classes where class_id = (select id from pc.social)), 'an empty list unmarks the class');

update class_types set min_age_months = 12 where id = 'small-group-play';
drop schema pc cascade;
