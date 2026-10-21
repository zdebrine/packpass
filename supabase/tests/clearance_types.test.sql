-- Clearances as data (migrations/…_clearance_types.sql): a clearance PackPass adds works like Social and
-- Herding for booking and assessments, with its own scope and expiry. Uses its own accounts and dog.
create schema ct;
create function ct.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
create function ct.expect_error(q text, want text) returns void language plpgsql as $$
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
create function ct.as_user(id text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', id, false)
$$;
grant usage, create on schema ct to authenticated, anon;
grant execute on all functions in schema ct to authenticated, anon;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000007d1', 'scout@owner.co', '{"name":"Scout Owner"}'),
  ('00000000-0000-0000-0000-0000000007d2', 'cleartypes@eastside.co', '{"name":"Eastside Trainer"}');
select public.link_partner_staff('cleartypes@eastside.co', 'eastside', 'trainer', 'sam');

create table ct.ids (k text primary key, id text);
with x as (insert into dogs (owner_id, name, birth_year, birth_month, weight_lb, fixed)
           values ('00000000-0000-0000-0000-0000000007d1', 'Scout', extract(year from now())::int - 3, extract(month from now())::int, 40, true) returning id)
insert into ct.ids select 'scout', id from x;
create function ct.scout() returns uuid language sql as $$ select id::uuid from ct.ids where k = 'scout' $$;
insert into vaccinations (dog_id, type, expires_on, verified)
select ct.scout(), t::vaccine_type, current_date + 300, true from unnest(array['rabies', 'dhpp', 'bordetella']) t;
grant select, insert on ct.ids to authenticated;

-- A session of a class three days out, in its own statement so booking_block (stable) sees it.
create function ct.add_session(k text, cls text) returns void language sql as $$
  with x as (insert into public.sessions (class_id, starts_at, capacity, packpass_spots, spots_left)
             values (cls, now() + interval '3 days', 5, 5, 5) returning id)
  insert into ct.ids select k, id::text from x
$$;
create function ct.session(k text) returns uuid language sql as $$ select id::uuid from ct.ids where k = $1 $$;

-- ---- Social and Herding carry over -------------------------------------------------------------------
select ct.ok((select count(*) from clearance_types where id in ('social', 'herding') and status = 'active') = 2, 'Social and Herding are clearance types');
select ct.ok((select scope = 'network' from clearance_types where id = 'social'), 'Social is network-wide');
select ct.ok((select scope = 'partner' and group_also_requires = 'social' from clearance_types where id = 'herding'), 'Herding is partner-only and needs Social in groups');

-- ---- A new clearance --------------------------------------------------------------------------------
insert into clearance_types (id, name, scope, expiry_months, status) values ('scentwork', 'Scentwork', 'partner', 6, 'draft');
set role anon;
select ct.ok((select count(*) from clearance_types where id = 'scentwork') = 0, 'a draft clearance is hidden');
reset role;
update clearance_types set status = 'active' where id = 'scentwork';
set role anon;
select ct.ok((select count(*) from clearance_types where id = 'scentwork') = 1, 'an active clearance can be read');
reset role;

set role authenticated;
select ct.as_user('00000000-0000-0000-0000-0000000007d2');
insert into ct.ids select 'class', public.partner_save_class(null, '{"title":"Scent games","discipline":"Scentwork","category":"play",
  "session_type":"class","duration_min":45,"intensity":2,"group_size":4,"balance":"social","clearance":"scentwork"}'::jsonb);
select ct.expect_error($$select public.partner_save_class(null, '{"title":"Nope","discipline":"Scentwork","category":"play",
  "session_type":"class","duration_min":45,"intensity":2,"group_size":4,"balance":"social","clearance":"no-such-clearance"}'::jsonb)$$, 'foreign key');
reset role;
update class_types set status = 'live' where id = (select id from ct.ids where k = 'class');
select ct.ok((select requires = 'scentwork' from class_types where id = (select id from ct.ids where k = 'class')), 'a class can require it');
select ct.add_session('s1', (select id from ct.ids where k = 'class'));
select ct.ok(public.booking_block(ct.scout(), ct.session('s1')) = 'needs_scentwork', 'a dog without it is blocked');

select public.record_assessment(ct.scout(), 'scentwork', 'eastside', 'Sam', 'cleared');
select ct.ok((select scope = 'partner' and expires_on = (current_date + interval '6 months')::date
              from clearances where dog_id = ct.scout() and type = 'scentwork'), 'passing grants it with its own scope and expiry');
select ct.ok((select title like 'Scout is Scentwork cleared%' from notifications where member_id = '00000000-0000-0000-0000-0000000007d1'
              and kind = 'clearance_earned'), 'the owner is told by name');
select ct.ok(public.booking_block(ct.scout(), ct.session('s1')) is null, 'then the dog can book');

-- Needing Social in group classes works for any clearance.
update clearance_types set group_also_requires = 'social' where id = 'scentwork';
select ct.ok(public.booking_block(ct.scout(), ct.session('s1')) = 'needs_social', 'a group class also needs the clearance it names');
update clearance_types set group_also_requires = null where id = 'scentwork';

-- ---- Clean up ----------------------------------------------------------------------------------------
delete from sessions where class_id = (select id from ct.ids where k = 'class');
delete from class_types where id = (select id from ct.ids where k = 'class');
delete from dogs where id = ct.scout();
delete from clearance_types where id = 'scentwork';
drop schema ct cascade;
