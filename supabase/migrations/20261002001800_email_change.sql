-- Changing email (Settings › Account): Supabase Auth changes auth.users once the member enters the code
-- sent to the new address. The profile keeps a copy of the email, so it follows. (If the new address has
-- a partner team invite waiting, accept_partner_invite adds the account to that team too.)

create function public.sync_profile_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set email = new.email where id = new.id and email is distinct from new.email;
  return new;
end $$;
revoke execute on function public.sync_profile_email from public, anon, authenticated;

create trigger on_auth_user_email_changed after update of email on auth.users
for each row when (old.email is distinct from new.email)
execute function public.sync_profile_email();
