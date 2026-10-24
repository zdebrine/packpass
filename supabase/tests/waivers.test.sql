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

drop schema v cascade;
