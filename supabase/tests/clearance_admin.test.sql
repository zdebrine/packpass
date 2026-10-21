-- PackPass › Clearances (migrations/…_clearance_admin.sql): only admins create and edit clearances, rubrics and
-- training paths, and set what a class requires or grants. Uses its own accounts.
create schema ca;
create function ca.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
create function ca.expect_error(q text, want text) returns void language plpgsql as $$
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
create function ca.as_user(id text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', id, false)
$$;
grant usage on schema ca to authenticated;
grant execute on all functions in schema ca to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000007e1', 'clearadmin@packpass.co', '{"name":"PackPass Admin"}'),
  ('00000000-0000-0000-0000-0000000007e2', 'clearadmin@eastside.co', '{"name":"Eastside Trainer"}');
insert into packpass_admins (user_id) values ('00000000-0000-0000-0000-0000000007e1');
select public.link_partner_staff('clearadmin@eastside.co', 'eastside', 'trainer', 'sam');

-- ---- Trainers can't ------------------------------------------------------------------------------------
set role authenticated;
select ca.as_user('00000000-0000-0000-0000-0000000007e2');
select ca.expect_error($$select public.admin_save_clearance('{"name":"Agility"}')$$, 'not_admin');
select ca.expect_error($$select * from public.admin_clearance_types()$$, 'not_admin');
select ca.expect_error($$select public.admin_set_class_clearance('fitness', null, null)$$, 'not_admin');
select ca.expect_error($$select public.admin_save_path('{"title":"Nope"}')$$, 'not_admin');

-- ---- Admins create a clearance with a rubric -----------------------------------------------------------
select ca.as_user('00000000-0000-0000-0000-0000000007e1');
select ca.ok(public.admin_save_clearance('{"name":"Off-leash trails","scope":"network","expiry_months":6,
  "criteria":[{"label":"Recall under distraction"},{"label":"Settles at a trailhead","required":false},{"label":"  "}]}') = 'off-leash-trails',
  'a new clearance gets an id from its name');
select ca.ok((select status = 'draft' and expiry_months = 6 and jsonb_array_length(criteria) = 2
              from public.admin_clearance_types() where id = 'off-leash-trails'), 'it starts as a draft with its rubric (blank items dropped)');
select ca.expect_error($$select public.admin_save_clearance('{"name":"Off-leash trails"}')$$, 'name_taken');
select ca.ok(public.admin_save_clearance('{"id":"off-leash-trails","name":"Off-leash trails","status":"active","group_also_requires":"social"}') = 'off-leash-trails', 'activated');
select ca.ok((select group_also_requires = 'social' and jsonb_array_length(criteria) = 2 from public.admin_clearance_types() where id = 'off-leash-trails'),
  'editing without criteria keeps the rubric');
select ca.expect_error($$select public.admin_save_clearance('{"id":"social","name":"Social","scope":"partner"}')$$, 'scope_locked');
select ca.ok((select dogs_cleared > 0 and requiring_classes > 0 from public.admin_clearance_types() where id = 'social'), 'counts show how much uses Social');

-- ---- Requires and grants are PackPass's call -----------------------------------------------------------
select public.admin_set_class_clearance('fitness', 'off-leash-trails', 'social');
select ca.ok((select requires = 'off-leash-trails' and grants is null from class_types where id = 'fitness'), 'a class can require any clearance, and only assessments grant');
select public.admin_set_class_clearance('fitness', 'social', null);

-- ---- Training paths ------------------------------------------------------------------------------------
select ca.ok(public.admin_save_path('{"title":"Trail ready","grants":"off-leash-trails",
  "steps":[{"title":"Long line","class_id":"focus-recall"},{"title":"Trail check","class_id":"social-recheck"}]}') = 'trail-ready', 'a path is created');
select ca.ok((select count(*) = 2 from path_step_classes where path_id = 'trail-ready'), 'each step''s class is a Path class for it');
select ca.ok((select jsonb_agg(p) @> '[{"id":"trail-ready"}]' from public.admin_clearance_types() k, jsonb_array_elements(k.paths) p where k.id = 'off-leash-trails'),
  'the clearance lists its path');
select ca.expect_error($$select public.admin_save_path('{"id":"calm-around-dogs","title":"Calm around dogs","steps":[{"title":"Only step","class_id":"calm-private"}]}')$$, 'path_in_use');
select public.admin_save_path('{"id":"calm-around-dogs","title":"Calm around dogs","steps":[{"title":"Distance work","class_id":"calm-private"},
  {"title":"Parallel walk","class_id":"parallel-walk"},{"title":"Small-group play","class_id":"small-group-play"},{"title":"Social check","class_id":"social-recheck"}]}');
select ca.ok((select title = 'Social check' from path_steps where path_id = 'calm-around-dogs' and position = 4), 'a started path can still be reworded');

-- ---- Retiring ------------------------------------------------------------------------------------------
select public.admin_save_clearance('{"id":"off-leash-trails","name":"Off-leash trails","status":"retired"}');
reset role;
select ca.expect_error($$select public.record_assessment((select id from dogs limit 1), 'off-leash-trails', 'eastside', 'Sam', 'cleared')$$, 'clearance_retired');

-- ---- Clean up ------------------------------------------------------------------------------------------
update path_steps set title = 'Social re-check' where path_id = 'calm-around-dogs' and position = 4;
delete from training_paths where id = 'trail-ready';
delete from clearance_types where id = 'off-leash-trails';
drop schema ca cascade;
