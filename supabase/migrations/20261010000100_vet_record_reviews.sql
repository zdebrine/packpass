-- PackPass › Vet records: members upload one vet record per dog (vaccines.tsx, during onboarding or later) with the
-- three expiry dates. PackPass checks the record against the dates and approves it (the vaccination rows become
-- verified) or denies it with a reason, which the member sees on the app's Records Denied screen.
-- A new upload or a changed date clears the decision, so the record waits for review again.

create table public.vet_record_reviews (
  dog_id uuid primary key references public.dogs (id) on delete cascade,
  status text not null check (status in ('approved', 'denied')),
  reason text,
  document_path text,              -- the file that was decided on
  decided_at timestamptz not null default now(),
  decided_by uuid references auth.users (id) on delete set null,
  check (status = 'approved' or length(trim(coalesce(reason, ''))) >= 3)
);
alter table public.vet_record_reviews enable row level security;
create policy "vet_record_reviews: read own" on public.vet_record_reviews for select to authenticated using (public.owns_dog(dog_id));

-- Members change their rows directly (RLS keeps verified false); any new file or date sends it back for review.
create function public.vaccinations_reset_review() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.vet_record_reviews where dog_id = new.dog_id;
  return new;
end $$;
revoke execute on function public.vaccinations_reset_review from public, anon, authenticated;

create trigger vaccinations_reset_review_insert after insert on public.vaccinations
for each row execute function public.vaccinations_reset_review();
create trigger vaccinations_reset_review_update after update of expires_on, document_path on public.vaccinations
for each row when (old.expires_on is distinct from new.expires_on or old.document_path is distinct from new.document_path)
execute function public.vaccinations_reset_review();

-- Admins open the files.
create policy "vaccine docs: admin read" on storage.objects for select to authenticated
  using (bucket_id = 'vaccine-docs' and public.is_packpass_admin());

-- Records waiting for a decision (a file uploaded, not all three verified, not denied), oldest upload first,
-- then the last 30 days of decisions.
create function public.admin_vet_records()
returns table (dog_id uuid, dog_name text, breed text, mixed boolean, owner_name text, email text,
               document_path text, uploaded_at timestamptz, vaccines jsonb, status text, reason text, decided_at timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  perform public.admin_check();
  return query
  with recs as (
    select v.dog_id, max(v.document_path) document_path, bool_and(v.verified) and count(*) >= 3 all_verified,
           jsonb_agg(jsonb_build_object('type', v.type, 'expires_on', v.expires_on, 'verified', v.verified) order by v.type) vaccines
    from public.vaccinations v group by v.dog_id
  )
  select d.id, d.name, d.breed, d.mixed, nullif(pr.name, ''), u.email::text, r.document_path,
         -- Uploads are stored as <member>/<dog>/<epoch ms>-<name>.
         to_timestamp(nullif(substring(split_part(r.document_path, '/', 3) from '^(\d+)-'), '')::bigint / 1000.0),
         r.vaccines,
         case when rv.status is not null then rv.status else 'pending' end, rv.reason, rv.decided_at
  from recs r join public.dogs d on d.id = r.dog_id join auth.users u on u.id = d.owner_id
  left join public.profiles pr on pr.id = d.owner_id
  left join public.vet_record_reviews rv on rv.dog_id = r.dog_id
  where r.document_path is not null
    and ((rv.status is null and not r.all_verified) or rv.decided_at > now() - interval '30 days')
  order by rv.status is not null, 8 nulls last, rv.decided_at desc;
end $$;

-- Approve: all three vaccinations become verified. Deny: needs a reason, which the member sees; the rows stay
-- unverified and the member is told. Either way the member gets a notification.
create function public.admin_decide_vet_record(p_dog uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  dog public.dogs;
  path text;
begin
  perform public.admin_check();
  select * into dog from public.dogs where id = p_dog;
  if not found then raise exception 'not_found'; end if;
  select max(document_path) into path from public.vaccinations where dog_id = p_dog;
  if path is null then raise exception 'not_found'; end if;
  if not p_approve and length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'needs_reason'; end if;
  if p_approve and (select count(*) from public.vaccinations where dog_id = p_dog) < 3 then raise exception 'incomplete'; end if;

  update public.vaccinations set verified = p_approve where dog_id = p_dog;
  insert into public.vet_record_reviews (dog_id, status, reason, document_path, decided_at, decided_by)
  values (p_dog, case when p_approve then 'approved' else 'denied' end, case when p_approve then null else trim(p_reason) end, path, now(), auth.uid())
  on conflict (dog_id) do update set status = excluded.status, reason = excluded.reason, document_path = excluded.document_path,
                                      decided_at = excluded.decided_at, decided_by = excluded.decided_by;

  insert into public.notifications (member_id, category, kind, title, body, href)
  values (dog.owner_id, 'clearances',
          case when p_approve then 'records_approved' else 'records_denied' end,
          case when p_approve then dog.name || '''s vet records are approved' else dog.name || '''s vet records need another look' end,
          case when p_approve then 'PackPass checked the vaccine record. Partners see it was checked.' else trim(p_reason) end,
          case when p_approve then '/vaccines' else '/onboarding/records-denied' end);
end $$;

revoke execute on function public.admin_vet_records, public.admin_decide_vet_record from public, anon;
grant execute on function public.admin_vet_records, public.admin_decide_vet_record to authenticated;

-- Both decisions are pushed (same list as PUSH_KINDS in supabase/functions/send-push/push.ts).
create or replace function public.push_kind(k text) returns boolean language sql immutable set search_path = public as $$
  select k in ('hold_expiring', 'holds_released', 'clearance_earned', 'waitlist_booked', 'waitlist_open', 'waitlist_missed',
               'session_cancelled', 'session_note', 'assessment_result', 'path_step', 'records_approved', 'records_denied')
$$;
