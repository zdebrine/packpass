-- PackPass › Staff: an admin takes an account off a partner's team (someone left, or was linked to the wrong
-- partner). The account stays, as a member account. Owners do the same for their own team on Team.

create function public.admin_unlink_staff(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_check();
  delete from public.partner_staff where user_id = p_user;
  if not found then raise exception 'not_found'; end if;
end $$;
revoke execute on function public.admin_unlink_staff from public, anon;
grant execute on function public.admin_unlink_staff to authenticated;
