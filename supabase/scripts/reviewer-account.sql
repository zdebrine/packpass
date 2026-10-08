-- App Store and Google Play reviewer account: a member with a dog that can book any class.
--
-- 1. Supabase › Authentication › Users › Add user › Create new user: the reviewer email and a password,
--    with "Auto Confirm User" on (so no sign-up code is needed).
-- 2. Put that email on the line below and run this file in the SQL editor. Running it again is safe: it
--    tops the account back up to 10 credits and renews the vaccines and clearance, without adding a second dog.
-- 3. Put the email and password in App Store Connect › App Review Information, and in Play Console ›
--    App content › App access.
do $$
declare
  reviewer_email text := 'appreview@example.com';  -- change to the reviewer email from step 1
  uid uuid;
  dog uuid;
  top_up int;
  assessor record;
begin
  select id into uid from auth.users where lower(email) = lower(reviewer_email);
  if uid is null then raise exception 'No account for %: add the user first (step 1).', reviewer_email; end if;

  update public.profiles set name = 'App Review' where id = uid;

  select id into dog from public.dogs where owner_id = uid order by created_at limit 1;
  if dog is null then
    insert into public.dogs (owner_id, name, sex, breed, birth_month, birth_year, weight_lb, fixed, energy, sociability, interests, traits, area)
    values (uid, 'Scout', 'female', 'Australian Shepherd', 4, 2022, 42, true, 'high', 'loves_dogs', '{Agility,Scent}', '{pulls}', 'Austin · Central')
    returning id into dog;
  end if;

  -- All three vaccines current for the next year, as partners would see them.
  delete from public.vaccinations where dog_id = dog;
  insert into public.vaccinations (dog_id, type, expires_on, verified)
  select dog, v, (now() + interval '1 year')::date, true from unnest(enum_range(null::public.vaccine_type)) v;

  -- A network Social clearance, so group classes book without the assessment first. It's recorded against a
  -- partner that runs the Social assessment, as a real one would be.
  select c.partner_id, coalesce(t.name, p.name) as name into assessor
  from public.class_types c join public.partners p on p.id = c.partner_id left join public.trainers t on t.id = c.trainer_id
  where c.grants = 'social' and c.status = 'live' order by c.id limit 1;
  if assessor.partner_id is null then raise exception 'No live Social assessment class to record the clearance against.'; end if;
  delete from public.clearances where dog_id = dog and type = 'social';
  insert into public.clearances (dog_id, type, scope, partner_id, assessed_on, expires_on, assessor, strengths, quote, seen_at)
  values (dog, 'social', 'network', assessor.partner_id, current_date, (now() + interval '1 year')::date, assessor.name,
          '{Reads other dogs well}', 'Ready for group classes.', now());

  -- Back to 10 credits, recorded in the ledger like any adjustment.
  select 10 - credits_balance into top_up from public.profiles where id = uid;
  if top_up <> 0 then
    insert into public.credit_ledger (member_id, delta, reason) values (uid, top_up, 'adjustment');
    update public.profiles set credits_balance = 10 where id = uid;
  end if;
end $$;
