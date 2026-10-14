-- "Only these breeds", Assessed fit and impressions (migrations/…_breed_review_overrides.sql).
create schema r;
create function r.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
create function r.expect_error(q text, want text) returns void language plpgsql as $$
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
create function r.next(cls text) returns uuid language sql as $$
  select id from public.sessions where class_id = cls and starts_at > now() + interval '1 day' order by starts_at limit 1
$$;
create function r.as_user(id text) returns void language sql as $$ select set_config('request.jwt.claim.sub', id, false) $$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000bb01', 'breeds@dogs.co', '{"name":"Bea Breeds"}'),
  ('00000000-0000-0000-0000-00000000bb02', 'owner@ridge.co', '{"name":"Rory Ridge"}'),
  ('00000000-0000-0000-0000-00000000bb03', 'admin@packpass.co', '{"name":"Ada Admin"}'),
  ('00000000-0000-0000-0000-00000000bb04', 'other@dogs.co', '{"name":"Oli Other"}');
select public.link_partner_staff('owner@ridge.co', 'ridgeline', 'owner', 'maren');
insert into packpass_admins (user_id) values ('00000000-0000-0000-0000-00000000bb03');

create table r.d (k text primary key, id uuid);
with x as (
  insert into dogs (owner_id, name, breed_ids, birth_year, weight_lb, fixed) values
    ('00000000-0000-0000-0000-00000000bb01', 'Kep', '{border-collie}', extract(year from now())::int - 3, 40, true),
    ('00000000-0000-0000-0000-00000000bb01', 'Lab', '{labrador-retriever}', extract(year from now())::int - 3, 70, true),
    ('00000000-0000-0000-0000-00000000bb01', 'Pug', '{pug}', extract(year from now())::int - 3, 15, true)
  returning id, name)
insert into r.d select lower(name), id from x;
create function r.block(dog text, cls text) returns text language sql as $$
  select public.booking_block((select id from r.d where k = dog), r.next(cls))
$$;
grant usage on schema r to authenticated;
grant select on r.d to authenticated;
grant execute on all functions in schema r to authenticated;

-- ---- Only these breeds ---------------------------------------------------------------------------------------
set role authenticated;
select r.as_user('00000000-0000-0000-0000-00000000bb02');
select r.expect_error($$select public.partner_set_breed_only('herding-livestock', true, '')$$, 'breed_only_reason');
select r.expect_error($$select public.partner_set_breed_only('agility-drop-in', true, 'Insurance')$$, 'breed_only_needs_built_for');
select r.expect_error($$select public.partner_set_breed_only('scent-work', true, 'Insurance')$$, 'not_found');
select r.ok(public.partner_set_breed_only('herding-livestock', true, 'Sanctioned trial prep') = 'pending', 'asking for only these breeds waits for PackPass');
reset role;
select r.ok(r.block('lab', 'herding-livestock') <> 'breed_only', 'until PackPass approves, every breed can still book');

set role authenticated;
select r.as_user('00000000-0000-0000-0000-00000000bb02');
select r.expect_error($$select * from public.admin_review_queue()$$, 'not_admin');
select r.expect_error($$select public.admin_set_breed_only('herding-livestock', true)$$, 'not_admin');
select r.as_user('00000000-0000-0000-0000-00000000bb03');
select r.ok(exists (select 1 from public.admin_review_queue() where id = 'herding-livestock' and breed_only_status = 'pending'
                    and breed_only_reason = 'Sanctioned trial prep' and built_for = '{herding}'), 'the request waits in the review queue');
select public.admin_set_breed_only('herding-livestock', true);
select r.ok(not exists (select 1 from public.admin_review_queue() where id = 'herding-livestock'), 'and leaves it once decided');
reset role;
select r.ok(r.block('lab', 'herding-livestock') = 'breed_only', 'once approved, a Lab can''t book a herding-breeds-only class');
select r.ok(r.block('kep', 'herding-livestock') <> 'breed_only', 'a Border Collie can');

-- Changing who it's built for asks again; an admin status change alone doesn't.
update class_types set built_for = '{herding,sighthound}' where id = 'herding-livestock';
select r.ok((select breed_only_status from class_types where id = 'herding-livestock') = 'pending', 'changing Built for sends it back to review');
update class_types set breed_only_status = 'approved' where id = 'herding-livestock';
select r.ok((select breed_only_status from class_types where id = 'herding-livestock') = 'approved', 'an admin decision sticks');
select r.expect_error($$update class_types set built_for = '{}' where id = 'herding-livestock'$$, 'breed_only_needs_built_for');
update class_types set built_for = '{herding}', breed_only_status = 'approved' where id = 'herding-livestock';

-- ---- Assessed fit --------------------------------------------------------------------------------------------
select r.ok(r.block('pug', 'herding-livestock') = 'too_small', 'a 15 lb Pug is too small for Herding on Livestock');
set role authenticated;
select r.as_user('00000000-0000-0000-0000-00000000bb02');
select r.expect_error($$select public.partner_set_fit_override((select id from r.d where k = 'pug'), true, 'Met her')$$, 'not_found');
reset role;
insert into bookings (session_id, dog_id, member_id, credits_charged)
values (r.next('herding-fundamentals'), (select id from r.d where k = 'pug'), '00000000-0000-0000-0000-00000000bb01', 0);
set role authenticated;
select r.as_user('00000000-0000-0000-0000-00000000bb02');
select public.partner_set_fit_override((select id from r.d where k = 'pug'), true, 'Keeps up with the big dogs');
select r.ok(exists (select 1 from public.partner_fit_overrides() where dog_id = (select id from r.d where k = 'pug') and assessor <> ''), 'staff see their Assessed fit dogs');
select r.as_user('00000000-0000-0000-0000-00000000bb01');
select r.ok((select count(*) from dog_fit_overrides) = 1, 'the owner can see their dog''s Assessed fit');
select r.as_user('00000000-0000-0000-0000-00000000bb04');
select r.ok((select count(*) from dog_fit_overrides) = 0, 'other members can''t');
reset role;
select r.ok(r.block('pug', 'herding-livestock') not in ('too_small', 'breed_only'), 'an Assessed fit lifts the size and breed gates at that partner');
update dogs set fixed = false where id = (select id from r.d where k = 'pug');
update class_types set requires_fixed = true where id = 'herding-livestock';
select r.ok(r.block('pug', 'herding-livestock') = 'needs_fixed', 'but not spayed or neutered');
update class_types set requires_fixed = false where id = 'herding-livestock';
update dogs set fixed = true where id = (select id from r.d where k = 'pug');
set role authenticated;
select r.as_user('00000000-0000-0000-0000-00000000bb02');
select public.partner_set_fit_override((select id from r.d where k = 'pug'), false);
reset role;
select r.ok(r.block('pug', 'herding-livestock') = 'too_small', 'turning it off puts the gates back');

-- ---- Impressions ----------------------------------------------------------------------------------------------
set role authenticated;
select r.as_user('00000000-0000-0000-0000-00000000bb04');
select r.expect_error($$select public.log_impressions((select id from r.d where k = 'kep'), '[]')$$, 'not_found');
select r.as_user('00000000-0000-0000-0000-00000000bb01');
select public.log_impressions((select id from r.d where k = 'kep'), jsonb_build_array(
  jsonb_build_object('session_id', r.next('herding-livestock'), 'surface', 'list', 'state', 'unlock', 'position', 0, 'score', 82, 'parts', '{"breed":35}'::jsonb),
  jsonb_build_object('session_id', r.next('scent-work'), 'surface', 'list', 'state', 'open', 'position', 1, 'score', 40),
  jsonb_build_object('session_id', '00000000-0000-0000-0000-000000000000', 'surface', 'list', 'state', 'open')));
select r.ok((select count(*) from match_impressions) = 0, 'members can''t read impressions');
reset role;
select r.ok((select count(*) from match_impressions where dog_id = (select id from r.d where k = 'kep')) = 2, 'impressions are logged, unknown sessions skipped');
select r.ok((select score = 82 and score_parts ->> 'breed' = '35' from match_impressions where session_id = r.next('herding-livestock')), 'with the score and its parts');
insert into bookings (session_id, dog_id, member_id, credits_charged) values (r.next('scent-work'), (select id from r.d where k = 'kep'), '00000000-0000-0000-0000-00000000bb01', 0);
select r.ok((select booked from match_impressions where session_id = r.next('scent-work')), 'booking the session marks the impression booked');
select r.ok(not (select booked from match_impressions where session_id = r.next('herding-livestock')), 'others stay unbooked');

-- Put the class back for the other tests.
update class_types set breed_only = false where id = 'herding-livestock';
select r.ok((select breed_only_status is null and breed_only_reason is null from class_types where id = 'herding-livestock'), 'turning it off clears the request');
-- Leave nothing behind for the other tests.
delete from match_impressions where dog_id in (select id from r.d);
delete from bookings where dog_id in (select id from r.d);
delete from dogs where id in (select id from r.d);
delete from partner_staff where user_id = '00000000-0000-0000-0000-00000000bb02';
delete from packpass_admins where user_id = '00000000-0000-0000-0000-00000000bb03';
drop schema r cascade;
