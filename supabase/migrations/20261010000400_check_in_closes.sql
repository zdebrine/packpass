-- Check-in closes 15 minutes after the start (it used to stay open until the session ended), as the Missed class
-- screen says: "No check-in by 7:45 am". Partners can still check a dog in from the roster afterwards.
-- Same window as CHECK_IN_CLOSES_MIN in apps/member/src/lib/booking.ts.
create or replace function public.check_in(p_booking uuid, p_code text)
returns public.bookings language plpgsql security definer set search_path = public as $$
declare
  b public.bookings;
  s public.sessions;
  code text := p_code;
begin
  select * into b from public.bookings where id = p_booking and member_id = auth.uid() for update;
  if not found then raise exception 'not_found'; end if;
  if b.status = 'checked_in' then return b; end if;
  if b.status <> 'booked' then raise exception 'not_booked'; end if;
  select * into s from public.sessions where id = b.session_id;

  if code like 'packpass:checkin:%' then
    if split_part(code, ':', 3) <> s.id::text then raise exception 'wrong_session'; end if;
    code := split_part(code, ':', 4);
  end if;
  if code is distinct from s.check_in_code then raise exception 'wrong_code'; end if;
  if now() < s.starts_at - interval '60 minutes' then raise exception 'too_early'; end if;
  if now() > s.starts_at + interval '15 minutes' then raise exception 'too_late'; end if;

  update public.bookings set status = 'checked_in', checked_in_at = now() where id = p_booking returning * into b;
  return b;
end $$;
