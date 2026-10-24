-- PackPass › Log at home (migrations/…_log_at_home.sql, practice.sql). Uses its own account.
create schema lh;
create function lh.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
create function lh.expect_error(q text, want text) returns void language plpgsql as $$
declare got text;
begin
  begin execute q; exception when others then got := sqlerrm; end;
  if got is null or got not like '%' || want || '%' then raise exception 'FAILED: expected error "%" got "%"', want, got; end if;
  raise notice 'ok: rejected with %', want;
end $$;
grant usage on schema lh to authenticated, anon;
grant execute on all functions in schema lh to authenticated, anon;

-- 1. The catalog loaded, and anyone can read it.
select lh.ok((select count(*) from skills) >= 14, 'skills are seeded');
select lh.ok((select count(*) from drills where active) >= 40, 'drills are seeded');
select lh.ok((select steps[2] from drills where id = 'turn-and-go') = 'The moment the leash goes tight, turn and walk the other way.', 'drill steps keep their text');
select lh.ok((select title from drills where id = 'watch-the-park') = 'Watch the park', 'Watch the park is a drill');
select lh.ok(not exists (select 1 from drills d where not exists (select 1 from skills k where k.id = d.skill_id)), 'every drill has its skill');
set role anon;
select lh.ok((select count(*) from skills) >= 14, 'signed-out visitors read skills');
reset role;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000006a', 'home@me.co', '{"name":"Hom Log"}'),
  ('00000000-0000-0000-0000-00000000006b', 'other-home@me.co', '{"name":"Oth Er"}');
select public.seed_demo_member('00000000-0000-0000-0000-00000000006a');
create table lh.dogs as select
  (select id from dogs where owner_id = '00000000-0000-0000-0000-00000000006a' and name = 'Juno') juno,
  (select id from dogs where owner_id = '00000000-0000-0000-0000-00000000006a' and name = 'Otis') otis;
grant select on lh.dogs to authenticated;

-- 2. Focus skills start from traits (pulls, nervous_dogs) and paths (Calm around dogs, Loose leash walking).
select lh.ok((select array_agg(skill_id order by skill_id) from dog_focus_skills where dog_id = (select juno from lh.dogs)) = '{calm_dogs,loose_leash}', 'Juno works on loose leash and calm around dogs');
select lh.ok((select source from dog_focus_skills where dog_id = (select juno from lh.dogs) and skill_id = 'loose_leash') = 'trait', 'seeded from the trait first');
select lh.ok(not exists (select 1 from dog_focus_skills where dog_id = (select otis from lh.dogs)), 'Otis has no traits and no focus skills');
update dogs set traits = '{recall}' where id = (select otis from lh.dogs);
select lh.ok((select skill_id from dog_focus_skills where dog_id = (select otis from lh.dogs)) = 'recall', 'a new trait adds its skill');
update dog_focus_skills set removed_at = now() where dog_id = (select otis from lh.dogs);
update dogs set traits = '{recall,jumps}' where id = (select otis from lh.dogs);
select lh.ok((select removed_at from dog_focus_skills where dog_id = (select otis from lh.dogs) and skill_id = 'recall') is not null, 'a removed skill stays removed');
select lh.ok(exists (select 1 from dog_focus_skills where dog_id = (select otis from lh.dogs) and skill_id = 'greetings'), 'while the next trait still adds its own');

-- 3. Logging: one row per dog, the activity's balance, skills checked.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000006a', false);
create temp table w as select public.log_home_activity(array[(select juno from lh.dogs)], 'walk', now() - interval '1 hour', 30, '{loose_leash}', 'good', '  Passed two dogs without a lunge.  ') id;
select lh.ok((select balance from home_activities where id = (select id from w)) = 'physical', 'a walk counts as physical');
select lh.ok((select note from home_activities where id = (select id from w)) = 'Passed two dogs without a lunge.', 'the note is trimmed');
create temp table w2 as select public.log_home_activity(array[(select juno from lh.dogs), (select otis from lh.dogs)], 'park', now(), 10, '{calm_dogs}', 'mixed', null, null, 'watch-the-park', 7) id;
select lh.ok((select count(*) from w2) = 2, 'logging for two dogs writes two rows');
select lh.ok((select count(distinct dog_id) from home_activities where id in (select id from w2)) = 2, 'one for each dog');
select lh.ok((select bool_and(balance = 'social' and drill_id = 'watch-the-park' and reps = 7) from home_activities where id in (select id from w2)), 'with the park balance, the drill and the reps');
create temp table w3 as select public.log_home_activity(array[(select otis from lh.dogs)], 'other', now(), 20) id;
select lh.ok((select balance from home_activities where id = (select id from w3)) is null, 'Something else has no balance unless picked');
create temp table w4 as select public.log_home_activity(array[(select otis from lh.dogs)], 'other', now(), 20, '{}', null, null, 'mental') id;
select lh.ok((select balance from home_activities where id = (select id from w4)) = 'mental', 'or the one picked');
select lh.expect_error($$select public.log_home_activity(array[(select juno from lh.dogs)], 'walk', now(), 30, '{flying}')$$, 'bad_skill');
select lh.expect_error($$select public.log_home_activity(array[(select juno from lh.dogs)], 'walk', now() + interval '1 day', 30)$$, 'bad_time');
select lh.expect_error($$select public.log_home_activity(array[(select juno from lh.dogs)], 'walk', now(), 0)$$, 'bad_duration');
select lh.expect_error($$select public.log_home_activity('{}', 'walk', now(), 30)$$, 'no_dog');
select lh.ok((select count(*) from home_activities) = 5, 'the member reads their five rows');

-- 4. Edit and delete.
select public.edit_home_activity((select id from w), 'sniff', now() - interval '1 day', 45, '{decompression}', 'good', '');
select lh.ok((select kind = 'sniff' and balance = 'mental' and duration_min = 45 and note is null from home_activities where id = (select id from w)), 'editing changes every field and the balance with the kind');
select public.delete_home_activity((select id from w3));
select lh.ok(not exists (select 1 from home_activities where id = (select id from w3)), 'deleting removes the row');
select lh.expect_error($$select public.delete_home_activity((select id from w3))$$, 'not_found');

-- 5. Weekly goal.
select public.set_practice_goal((select juno from lh.dogs), 4, 'after_work');
select lh.ok((select practice_days = 4 and practice_remind = 'after_work' from dogs where id = (select juno from lh.dogs)), 'the weekly goal saves');
select lh.expect_error($$select public.set_practice_goal((select juno from lh.dogs), 9)$$, 'bad_goal');

-- 6. Someone else can't read, log for, change or delete these.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000006b', false);
select lh.ok(not exists (select 1 from home_activities), 'another member reads none of them');
select lh.ok(not exists (select 1 from dog_focus_skills), 'or the focus skills');
select lh.expect_error($$select public.log_home_activity(array[(select juno from lh.dogs)], 'walk', now(), 30)$$, 'not_found');
select lh.expect_error($$select public.edit_home_activity((select id from w), 'walk', now(), 30)$$, 'not_found');
select lh.expect_error($$select public.delete_home_activity((select id from w))$$, 'not_found');
select lh.expect_error($$select public.set_practice_goal((select juno from lh.dogs), 3)$$, 'not_found');
select lh.expect_error($$insert into public.home_activities (member_id, dog_id, kind, done_at, duration_min) values (auth.uid(), (select juno from lh.dogs), 'walk', now(), 5)$$, 'row-level security');
select lh.expect_error('select public.seed_focus_skills(null)', 'permission denied');
reset role;

drop schema lh cascade;
