-- Who a class is for (migrations/…_breeds.sql and …_class_fit_gates.sql). Uses its own account and dogs.
create schema f;
-- Members sign the PackPass waiver before booking (…_booking_waivers.sql); this test isn't about waivers.
create function f.sign_waivers() returns void language sql security definer set search_path = public as $$
  insert into public.waiver_signatures (member_id, waiver_id, signed_name)
  select p.id, w.id, 'Test member' from public.profiles p join public.waivers w on w.active and w.partner_id is null
  on conflict do nothing
$$;
grant usage on schema f to authenticated;
grant execute on function f.sign_waivers to authenticated;
create function f.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
create function f.expect_error(q text, want text) returns void language plpgsql as $$
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
-- First session of a class at least a day out.
create function f.next(cls text) returns uuid language sql as $$
  select id from public.sessions where class_id = cls and starts_at > now() + interval '1 day' order by starts_at limit 1
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000fd01', 'fit@dogs.co', '{"name":"Fran Fit"}');

-- ---- Breeds ------------------------------------------------------------------------------------
select f.ok((select count(*) from breeds) > 100, 'the breed list is loaded');
select f.ok((select aptitudes from breeds where id = 'border-collie') = '{herding}', 'a border collie is a herding breed');
select f.ok(public.breed_id_named('aussie') = 'australian-shepherd' and public.breed_id_named('Lab') = 'labrador-retriever', 'aliases find breeds');
select f.ok(public.breed_id_named('Space dog') is null, 'an unknown name finds nothing');

create table f.d (k text primary key, id uuid);
with x as (insert into dogs (owner_id, name, breed) values ('00000000-0000-0000-0000-00000000fd01', 'Ace', 'Aussie') returning id)
insert into f.d select 'typed', id from x;
select f.ok((select breed_ids = '{australian-shepherd}' and breed = 'Australian Shepherd' from dogs where id = (select id from f.d where k = 'typed')),
            'a typed breed fills breed_ids and the name rosters show');
with x as (insert into dogs (owner_id, name, mixed, breed_ids) values ('00000000-0000-0000-0000-00000000fd01', 'Mo', true, '{labrador-retriever,border-collie}') returning id)
insert into f.d select 'mix', id from x;
select f.ok((select breed from dogs where id = (select id from f.d where k = 'mix')) = 'Labrador Retriever and Border Collie mix', 'a mix reads as its breeds');
with x as (insert into dogs (owner_id, name, breed) values ('00000000-0000-0000-0000-00000000fd01', 'Zed', 'Moon hound') returning id)
insert into f.d select 'unknown', id from x;
select f.ok((select breed_ids = '{}' and breed = 'Moon hound' from dogs where id = (select id from f.d where k = 'unknown')), 'unknown text is kept, with no breed ids');
select f.expect_error($$insert into dogs (owner_id, name, breed_ids) values ('00000000-0000-0000-0000-00000000fd01', 'Bad', '{not-a-breed}')$$, 'bad_breed');
select f.expect_error($$insert into dogs (owner_id, name, mixed, breed_ids) values ('00000000-0000-0000-0000-00000000fd01', 'Many', true, '{pug,pug,pug,pug}')$$, 'breed_ids_check');

-- ---- Classes carry their gates -----------------------------------------------------------------------
select f.ok((select min_age_months from class_types where id = 'agility-drop-in') = 12, 'the "12 months or older" classes gate on it');
select f.ok((select min_age_months = 4 and max_age_months = 12 from class_types where id = 'puppy-social'), 'Puppy social is for 4 to 12 months');
select f.ok((select min_age_months from class_types where id = 'senior-strength') = 96, 'Senior strength is for dogs 8 and up');
select f.ok((select min_weight_lb from class_types where id = 'herding-livestock') = 25, 'Herding on Livestock is for dogs 25 lb and up');
select f.ok((select requires_fixed from class_types where id = 'free-roam'), 'Free roam is for spayed or neutered dogs');

-- ---- booking_block -----------------------------------------------------------------------------------
-- Dogs of different ages and sizes, aged against the sessions' dates (a day or more out).
with x as (
  insert into dogs (owner_id, name, birth_year, birth_month, weight_lb, fixed) values
    ('00000000-0000-0000-0000-00000000fd01', 'Pip', extract(year from now() - interval '6 months')::int, extract(month from now() - interval '6 months')::int, 12, false),
    ('00000000-0000-0000-0000-00000000fd01', 'Prime', extract(year from now())::int - 3, extract(month from now())::int, 40, true),
    ('00000000-0000-0000-0000-00000000fd01', 'Gran', extract(year from now())::int - 10, extract(month from now())::int, 50, true),
    ('00000000-0000-0000-0000-00000000fd01', 'Tiny', extract(year from now())::int - 4, extract(month from now())::int, 9, true),
    ('00000000-0000-0000-0000-00000000fd01', 'Nobody', null, null, null, null)
  returning id, name)
insert into f.d select lower(name), id from x;
create function f.block(dog text, cls text) returns text language sql as $$
  select public.booking_block((select id from f.d where k = dog), f.next(cls))
$$;
create function f.gated(dog text, cls text) returns boolean language sql as $$
  select coalesce(f.block(dog, cls), '') in ('too_young', 'too_old', 'too_small', 'too_large', 'needs_fixed')
$$;

select f.ok(f.block('pip', 'agility-drop-in') = 'too_young', 'a 6-month-old puppy is too young for a 12-months-up class');
select f.ok(not f.gated('pip', 'puppy-social'), 'and can join Puppy social');
select f.ok(f.block('prime', 'puppy-social') = 'too_old', 'a 3-year-old is too old for Puppy social');
select f.ok(f.block('prime', 'senior-strength') = 'too_young', 'and too young for Senior strength');
select f.ok(not f.gated('gran', 'senior-strength'), 'a 10-year-old can join Senior strength');
select f.ok(f.block('tiny', 'herding-livestock') = 'too_small', 'a 9 lb dog is too small for Herding on Livestock');
select f.ok(f.block('prime', 'herding-livestock') = 'needs_herding', 'a 40 lb dog passes the size gate and meets the clearance rule');
select f.ok(f.block('pip', 'free-roam') = 'too_young', 'the first gate a dog fails is the one reported');
select f.ok(f.block('nobody', 'free-roam') = 'needs_fixed', 'not knowing whether a dog is fixed fails needs_fixed');
select f.ok(not f.gated('nobody', 'agility-drop-in') and not f.gated('nobody', 'herding-livestock'), 'no birthday or weight on file passes those gates');
select f.ok(not f.gated('prime', 'scent-work'), 'a class without gates is open to every dog');

-- Booking says the same.
grant usage on schema f to authenticated;
grant select on f.d to authenticated;
grant execute on all functions in schema f to authenticated;
update profiles set credits_balance = 20 where id = '00000000-0000-0000-0000-00000000fd01';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000fd01', false);
select f.sign_waivers();
select f.expect_error($$select public.book_session(f.next('senior-strength'), (select id from f.d where k = 'prime'))$$, 'too_young');
reset role;

drop schema f cascade;
