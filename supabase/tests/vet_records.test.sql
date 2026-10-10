-- PackPass › Vet records (migrations/…_vet_record_reviews.sql). Uses its own accounts.
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
  ('00000000-0000-0000-0000-0000000000c1', 'owner@vet.co', '{"name":"Vera Owner"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'other@vet.co', '{"name":"Otto Other"}'),
  ('00000000-0000-0000-0000-0000000000c9', 'records@packpass.co', '{"name":"Records"}');
insert into packpass_admins (user_id) values ('00000000-0000-0000-0000-0000000000c9');
insert into dogs (owner_id, name, breed) values ('00000000-0000-0000-0000-0000000000c1', 'Pip', 'Corgi');
create table v.ids as select id pip from dogs where owner_id = '00000000-0000-0000-0000-0000000000c1';
grant select on v.ids to authenticated;
insert into storage.objects (bucket_id, name, owner) values
  ('vaccine-docs', '00000000-0000-0000-0000-0000000000c1/' || (select pip from v.ids) || '/1760000000000-record.pdf', '00000000-0000-0000-0000-0000000000c1');

-- The member enters the dates and uploads the record, as the app does.
set role authenticated;
select v.as_user('00000000-0000-0000-0000-0000000000c1');
insert into vaccinations (dog_id, type, expires_on) select pip, t::vaccine_type, current_date + 200 from v.ids, unnest(array['rabies', 'dhpp', 'bordetella']) t;
update vaccinations set document_path = '00000000-0000-0000-0000-0000000000c1/' || (select pip from v.ids) || '/1760000000000-record.pdf';
select v.expect_error($$select * from public.admin_vet_records()$$, 'not_admin');
select v.expect_error($$select public.admin_decide_vet_record((select pip from v.ids), true)$$, 'not_admin');

select v.as_user('00000000-0000-0000-0000-0000000000c9');
select v.ok((select status = 'pending' and email = 'owner@vet.co' and jsonb_array_length(vaccines) = 3 and uploaded_at is not null
             from public.admin_vet_records() where dog_id = (select pip from v.ids)), 'an uploaded record waits for review');
select v.ok((select count(*) from storage.objects where bucket_id = 'vaccine-docs' and name like '%/1760000000000-record.pdf') = 1, 'admins can open the file');
select v.expect_error($$select public.admin_decide_vet_record((select pip from v.ids), false, '')$$, 'needs_reason');
select v.expect_error($$select public.admin_decide_vet_record(gen_random_uuid(), true)$$, 'not_found');
select public.admin_decide_vet_record((select pip from v.ids), false, 'The rabies date on the record is 2025, not 2027.');
select v.ok((select status = 'denied' from public.admin_vet_records() where dog_id = (select pip from v.ids)), 'a denied record shows as decided');

select v.as_user('00000000-0000-0000-0000-0000000000c1');
select v.ok((select status = 'denied' and reason like 'The rabies date%' from vet_record_reviews), 'the member sees the denial and why');
select v.ok((select kind = 'records_denied' and href = '/onboarding/records-denied' from notifications where kind like 'records_%'), 'and gets a notification');
select v.ok(not (select bool_or(verified) from vaccinations), 'denied vaccines stay unchecked');

select v.as_user('00000000-0000-0000-0000-0000000000c2');
select v.ok(not exists (select 1 from vet_record_reviews), 'other members can''t see the review');

-- A new file sends it back for review.
select v.as_user('00000000-0000-0000-0000-0000000000c1');
update vaccinations set document_path = '00000000-0000-0000-0000-0000000000c1/' || (select pip from v.ids) || '/1760000100000-new.pdf';
select v.ok(not exists (select 1 from vet_record_reviews), 'a new upload clears the denial');
select v.as_user('00000000-0000-0000-0000-0000000000c9');
select v.ok((select status = 'pending' from public.admin_vet_records() where dog_id = (select pip from v.ids)), 'and it waits for review again');
select public.admin_decide_vet_record((select pip from v.ids), true);

select v.as_user('00000000-0000-0000-0000-0000000000c1');
select v.ok((select status = 'approved' and reason is null from vet_record_reviews), 'an approved record');
select v.ok((select bool_and(verified) from vaccinations), 'verifies all three vaccines');
-- A changed date sends it back too.
update vaccinations set expires_on = current_date + 300, verified = false where type = 'rabies';
select v.ok(not exists (select 1 from vet_record_reviews), 'a changed date clears the approval');
reset role;
select v.ok(public.push_kind('records_denied') and public.push_kind('records_approved'), 'both decisions are pushed');

drop schema v cascade;
