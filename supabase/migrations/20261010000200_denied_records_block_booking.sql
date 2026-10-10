-- A vet record PackPass denied (PackPass › Vet records) stops the dog booking until the member uploads a new one,
-- which clears the denial (vaccinations_reset_review). Same rule as blockFor() in apps/member/src/lib/booking.ts.

create or replace function public.booking_block(p_dog uuid, p_session uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  s public.sessions;
  c public.class_types;
  on_day date;
begin
  select * into s from public.sessions where id = p_session;
  if not found then raise exception 'not_found'; end if;
  select * into c from public.class_types where id = s.class_id;
  on_day := (s.starts_at at time zone 'America/Chicago')::date;

  if s.cancelled_at is not null then return 'cancelled'; end if;
  if s.starts_at <= now() then return 'started'; end if;
  if c.requires = 'herding' and not public.has_clearance(p_dog, 'herding', c.partner_id, on_day) then
    return 'needs_herding';
  end if;
  if c.session_type = 'class' and c.group_size > 1
     and not public.has_clearance(p_dog, 'social', c.partner_id, on_day)
     and not public.on_active_path(p_dog, c.id) then
    return 'needs_social';
  end if;
  if exists (select 1 from public.vet_record_reviews r where r.dog_id = p_dog and r.status = 'denied') then
    return 'records_denied';
  end if;
  if (select count(*) from public.vaccinations v
      where v.dog_id = p_dog and v.expires_on >= on_day) < 3 then
    return 'vaccines';
  end if;
  return null;
end $$;
