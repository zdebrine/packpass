-- Founding-pack signups from the website's owner page, for PackPass admins on PackPass › Applications (next to
-- the partner leads). Every signup, newest first: the list is small until the app is in the stores.

create function public.admin_owner_waitlist()
returns table (id uuid, email text, zip text, energy text, traits text[], plan text, created_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_check();
  return query
  select w.id, w.email, w.zip, w.energy::text, w.traits, w.plan::text, w.created_at, w.updated_at
  from public.owner_waitlist w order by w.created_at desc;
end $$;
revoke execute on function public.admin_owner_waitlist from public, anon;
grant execute on function public.admin_owner_waitlist to authenticated;
