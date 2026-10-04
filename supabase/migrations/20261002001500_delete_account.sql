-- Deleting an account from the app (Settings › Delete account; the App Store requires it). Upcoming
-- bookings and held spots go back on sale first (the waitlist then fills them as usual), then the auth
-- user is deleted, which removes the profile, dogs, bookings, notes, clearances and everything else
-- that belongs to the member (every table cascades from it). The app removes the member's files in
-- Storage before calling this, since Storage files can only be deleted through the Storage API.
-- Past bookings go too, so a partner's earnings for sessions this member attended drop with them;
-- partner payouts will be recorded separately once Stripe is in.

create function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not_signed_in'; end if;
  -- Off the waitlists first, so a spot given back here isn't handed to this member's own waiting dog.
  update public.waitlist set status = 'left', closed_at = now() where member_id = me and status = 'waiting';

  with upcoming as (
    select b.session_id, count(*) n from public.bookings b join public.sessions s on s.id = b.session_id
    where b.member_id = me and b.status = 'booked' and s.starts_at > now() and s.cancelled_at is null
    group by b.session_id
  )
  update public.sessions s set spots_left = s.spots_left + upcoming.n from upcoming where s.id = upcoming.session_id;

  with held as (
    update public.held_spots set status = 'released', closed_at = now()
    where member_id = me and status = 'held'
    returning session_id
  ), per as (select session_id, count(*) n from held group by session_id)
  update public.sessions s set spots_left = s.spots_left + per.n from per where s.id = per.session_id;

  delete from auth.users where id = me;
end $$;
revoke execute on function public.delete_my_account from public, anon;
grant execute on function public.delete_my_account to authenticated;
