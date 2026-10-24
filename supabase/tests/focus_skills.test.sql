-- PackPass › Working on (migrations/…_focus_skills.sql). Uses its own account.
create schema fs;
create function fs.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
create function fs.expect_error(q text, want text) returns void language plpgsql as $$
declare got text;
begin
  begin execute q; exception when others then got := sqlerrm; end;
  if got is null or got not like '%' || want || '%' then raise exception 'FAILED: expected error "%" got "%"', want, got; end if;
  raise notice 'ok: rejected with %', want;
end $$;
grant usage on schema fs to authenticated;
grant execute on all functions in schema fs to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000007a', 'focus@me.co', '{"name":"Foc Us"}'),
  ('00000000-0000-0000-0000-00000000007b', 'other-focus@me.co', '{"name":"Oth Er"}');
select public.seed_demo_member('00000000-0000-0000-0000-00000000007a');
create table fs.dog as select id from dogs where owner_id = '00000000-0000-0000-0000-00000000007a' and name = 'Juno';
grant select on fs.dog to authenticated;
create view fs.active as select skill_id, source from dog_focus_skills where dog_id = (select id from fs.dog) and removed_at is null;
grant select on fs.active to authenticated;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000007a', false);
select fs.ok((select array_agg(skill_id order by skill_id) from fs.active) = '{calm_dogs,loose_leash}', 'Juno starts on loose leash and calm around dogs');

-- Keep loose leash, drop calm around dogs, add recall.
select public.set_focus_skills((select id from fs.dog), '{loose_leash,recall}');
select fs.ok((select array_agg(skill_id order by skill_id) from fs.active) = '{loose_leash,recall}', 'the owner''s picks are what Juno works on');
select fs.ok((select source from fs.active where skill_id = 'loose_leash') = 'trait', 'a kept skill keeps where it came from');
select fs.ok((select source from fs.active where skill_id = 'recall') = 'owner', 'an added one is the owner''s');
reset role;
select public.seed_focus_skills((select id from fs.dog));
set role authenticated;
select fs.ok(not exists (select 1 from fs.active where skill_id = 'calm_dogs'), 'a dropped skill isn''t added back from traits');
select public.set_focus_skills((select id from fs.dog), '{loose_leash,recall,calm_dogs}');
select fs.ok((select count(*) from fs.active) = 3, 'and picking it again brings it back');
select fs.expect_error($$select public.set_focus_skills((select id from fs.dog), '{flying}')$$, 'bad_skill');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000007b', false);
select fs.expect_error($$select public.set_focus_skills((select id from fs.dog), '{recall}')$$, 'not_found');
reset role;

drop schema fs cascade;
