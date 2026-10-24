-- PackPass › Waivers (migrations/…_waivers.sql). Uses its own accounts.
create schema v;
create function v.expect_error(q text, want text) returns void language plpgsql as $$
declare got text;
begin
  begin
    execute q;
  exception when others then
    got := sqlerrm;
  end;
  if got is null then raise exception 'FAILED: expected error "%" but it succeeded: %', want, q; end if;
  if got not like '%' || want || '%' then raise exception 'FAILED: expected error "%" but got "%" from: %', want, got, q; end if;
  raise notice 'ok: rejected with %', want;
end $$;
create function v.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
create function v.as_user(id text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', id, false)
$$;
grant usage, create on schema v to authenticated;
grant execute on all functions in schema v to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'signer@waiver.co', '{"name":"Sid Signer"}'),
  ('00000000-0000-0000-0000-0000000000d2', 'other@waiver.co', '{"name":"Olive Other"}');
insert into waivers (partner_id, title, body) values ('northside', 'Northside Canine waiver', 'Northside rules.');
create table v.ids as select
  (select id from waivers where partner_id is null and active) pp,
  (select id from waivers where partner_id = 'northside' and active) ns;
grant select on v.ids to authenticated;

set role authenticated;
select v.as_user('00000000-0000-0000-0000-0000000000d1');
select v.ok((select count(*) from waivers where active) >= 2, 'members can read live waivers');
select v.ok(not public.waiver_signed('00000000-0000-0000-0000-0000000000d1', null), 'PackPass waiver starts unsigned');
select v.ok(public.waiver_signed('00000000-0000-0000-0000-0000000000d1', 'ridgeline'), 'a partner with no waiver needs nothing');
select v.expect_error($$select public.sign_waiver((select pp from v.ids), ' ')$$, 'bad_name');
select v.expect_error($$select public.sign_waiver(gen_random_uuid(), 'Sid Signer')$$, 'not_found');
select v.expect_error($$insert into waiver_signatures (member_id, waiver_id, signed_name) select '00000000-0000-0000-0000-0000000000d1', pp, 'Sid' from v.ids$$, 'permission denied');
select v.expect_error($$insert into waivers (title, body) values ('Mine', 'x')$$, 'permission denied');
select public.sign_waiver((select pp from v.ids), 'Sid Signer');
select v.ok(public.waiver_signed('00000000-0000-0000-0000-0000000000d1', null), 'signing covers the PackPass waiver');
select v.ok(not public.waiver_signed('00000000-0000-0000-0000-0000000000d1', 'northside'), 'but not a partner''s');
select v.ok((select public.sign_waiver((select pp from v.ids), 'Someone Else')) = (select signed_at from waiver_signatures where waiver_id = (select pp from v.ids)), 'signing again keeps the first signature');
select v.ok((select signed_name from waiver_signatures where waiver_id = (select pp from v.ids)) = 'Sid Signer', 'with the first name');

select v.as_user('00000000-0000-0000-0000-0000000000d2');
select v.ok((select count(*) from waiver_signatures) = 0, 'members only see their own signatures');
select v.ok(not public.waiver_signed('00000000-0000-0000-0000-0000000000d2', null), 'and sign for themselves');

reset role;
-- A new version needs a new signature.
update waivers set active = false where partner_id is null;
insert into waivers (partner_id, version, title, body) values (null, 2, 'PackPass waiver', 'Version two.');
select v.ok(not public.waiver_signed('00000000-0000-0000-0000-0000000000d1', null), 'a new version asks again');

-- ---- Booking checks the waivers (…_booking_waivers.sql) -------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d3', 'booker@waiver.co', '{"name":"Bo Booker"}'),
  ('00000000-0000-0000-0000-0000000000d4', 'owner@southfork.co', '{"name":"Ona Owner"}'),
  ('00000000-0000-0000-0000-0000000000d5', 'coach@southfork.co', '{"name":"Cal Coach"}');
select public.seed_demo_member('00000000-0000-0000-0000-0000000000d3');
select public.link_partner_staff('owner@southfork.co', 'southfork', 'owner');
select public.link_partner_staff('coach@southfork.co', 'southfork', 'trainer');
create table v.b as select
  (select id from dogs where owner_id = '00000000-0000-0000-0000-0000000000d3' and name = 'Juno') juno,
  (select id from sessions where class_id = 'sniff-space' and starts_at > now() + interval '1 day' order by starts_at limit 1) s1,
  (select id from sessions where class_id = 'sniff-space' and starts_at > now() + interval '1 day' order by starts_at offset 1 limit 1) s2,
  (select id from sessions where class_id = 'sniff-space' and starts_at > now() + interval '1 day' order by starts_at offset 2 limit 1) s3,
  (select id from waivers where partner_id is null and active) pp;
grant select on v.b to authenticated;

set role authenticated;
select v.as_user('00000000-0000-0000-0000-0000000000d3');
select v.expect_error($$select public.book_session((select s1 from v.b), (select juno from v.b))$$, 'waiver');
select v.ok(public.booking_block((select juno from v.b), (select s1 from v.b)) is null, 'the waiver doesn''t lock the class itself');
select public.sign_waiver((select pp from v.b), 'Bo Booker');
select public.book_session((select s1 from v.b), (select juno from v.b));
select v.ok(exists (select 1 from bookings where session_id = (select s1 from v.b)), 'with the PackPass waiver signed, a partner with no waiver books');

-- The owner writes a waiver; trainers can't.
select v.as_user('00000000-0000-0000-0000-0000000000d5');
select v.expect_error($$select public.partner_save_waiver('South Fork waiver', '{}', 'Rules.', null)$$, 'not_owner');
select v.as_user('00000000-0000-0000-0000-0000000000d4');
select v.expect_error($$select public.partner_save_waiver(' ', '{}', 'Rules.', null)$$, 'waiver_title');
select v.expect_error($$select public.partner_save_waiver('South Fork waiver', '{}', '  ', null)$$, 'waiver_empty');
select v.expect_error($$select public.partner_save_waiver('South Fork waiver', '{}', null, 'ridgeline/w.pdf')$$, 'bad_file');
select v.expect_error($$select public.partner_save_waiver('South Fork waiver', '{a,b,c,d}', 'Rules.', null)$$, 'bad_summary');
select public.partner_save_waiver('South Fork waiver', '{"You stay with your dog.", " ", "Leash on arrival."}', 'South Fork rules.', null);
select v.ok((select summary from waivers where partner_id = 'southfork' and active) = '{"You stay with your dog.","Leash on arrival."}', 'blank points are dropped');
select v.ok(public.partner_waiver_signatures() = 0, 'no one has signed it yet');
insert into storage.objects (bucket_id, name) values ('waivers', 'southfork/waiver.pdf');
select v.expect_error($$insert into storage.objects (bucket_id, name) values ('waivers', 'ridgeline/waiver.pdf')$$, 'row-level security');

select v.as_user('00000000-0000-0000-0000-0000000000d5');
select v.expect_error($$insert into storage.objects (bucket_id, name) values ('waivers', 'southfork/coach.pdf')$$, 'row-level security');

select v.as_user('00000000-0000-0000-0000-0000000000d3');
select v.expect_error($$select public.book_session((select s2 from v.b), (select juno from v.b))$$, 'partner_waiver');
select public.sign_waiver((select id from waivers where partner_id = 'southfork' and active), 'Bo Booker');
select public.book_session((select s2 from v.b), (select juno from v.b));
select v.ok(exists (select 1 from bookings where session_id = (select s2 from v.b)), 'signing the partner''s waiver books');

-- A change is a new version: members sign again. The PDF version keeps the text optional.
select v.as_user('00000000-0000-0000-0000-0000000000d4');
select v.ok(public.partner_waiver_signatures() = 1, 'the owner sees how many signed');
select public.partner_save_waiver('South Fork waiver', '{}', null, 'southfork/waiver.pdf');
select v.ok((select version from waivers where partner_id = 'southfork' and active) = 2, 'saving starts version 2');
select v.ok((select count(*) from waivers where partner_id = 'southfork' and active) = 1, 'one live version');
select v.as_user('00000000-0000-0000-0000-0000000000d3');
select v.expect_error($$select public.book_session((select s3 from v.b), (select juno from v.b))$$, 'partner_waiver');

-- Removing it stops asking.
select v.as_user('00000000-0000-0000-0000-0000000000d4');
select public.partner_remove_waiver();
select v.as_user('00000000-0000-0000-0000-0000000000d3');
select public.book_session((select s3 from v.b), (select juno from v.b));
select v.ok(exists (select 1 from bookings where session_id = (select s3 from v.b)), 'with the waiver removed, booking needs no signature');

reset role;

drop schema v cascade;
