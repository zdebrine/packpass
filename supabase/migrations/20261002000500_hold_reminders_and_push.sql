-- Hold reminders and push tokens.
-- Holds release 24 hours before their session. A day before that happens, the member gets one
-- notification per dog: book the held sessions if the dog is cleared, or know that they're going
-- back to other members if it isn't. Notifications reach the phone through the send-push Edge
-- Function (supabase/functions/send-push), which a Database Webhook calls on each insert.

alter table public.held_spots add column reminded_at timestamptz;

-- Reminds members about holds that release within the next 24 hours. Each hold is reminded once.
-- Run hourly by pg_cron:
--   select cron.schedule('hold-reminders', '0 * * * *', 'select public.remind_expiring_holds()')
create function public.remind_expiring_holds()
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  perform public.release_expired_holds();
  for r in
    select h.member_id, h.dog_id, d.name dog_name, count(*) c, min(h.expires_at) first_release,
           public.has_clearance(h.dog_id, 'social', null, current_date) cleared
    from public.held_spots h join public.dogs d on d.id = h.dog_id
    where h.status = 'held' and h.reminded_at is null and h.expires_at <= now() + interval '24 hours'
    group by h.member_id, h.dog_id, d.name
  loop
    insert into public.notifications (member_id, category, kind, title, body, href)
    values (r.member_id, 'bookings', 'hold_expiring',
            case when r.cleared then 'Book ' || r.dog_name || '''s held sessions'
                 else r.dog_name || '''s held spots release soon' end,
            case when r.cleared
                 then case when r.c = 1 then 'A held session goes' else r.c || ' held sessions go' end
                      || ' back to other members within a day unless you book. It''s one tap from Today.'
                 else case when r.c = 1 then 'A held group session goes' else r.c || ' held group sessions go' end
                      || ' back to other members within a day. ' || r.dog_name || ' needs a Social clearance to book them.' end,
            '/');
    update public.held_spots set reminded_at = now()
    where dog_id = r.dog_id and status = 'held' and reminded_at is null and expires_at <= now() + interval '24 hours';
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.remind_expiring_holds from public, anon, authenticated;

-- ---- Push tokens ------------------------------------------------------------------------------

create table public.push_tokens (
  token text primary key,                -- Expo push token: ExponentPushToken[...]
  member_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  seen_at timestamptz not null default now()
);
create index on public.push_tokens (member_id);

alter table public.push_tokens enable row level security;
create policy "push_tokens: read own" on public.push_tokens for select to authenticated using (member_id = auth.uid());
create policy "push_tokens: delete own" on public.push_tokens for delete to authenticated using (member_id = auth.uid());

-- Registers this device for the signed-in member. A device that changes hands (sign out, sign in as
-- someone else) moves to the new member, so pushes never reach the previous one.
create function public.register_push_token(p_token text, p_platform text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_token !~ '^Expo(nent)?PushToken\[.+\]$' then raise exception 'bad_token'; end if;
  insert into public.push_tokens (token, member_id, platform) values (p_token, auth.uid(), p_platform)
  on conflict (token) do update set member_id = excluded.member_id, platform = excluded.platform, seen_at = now();
end $$;
revoke execute on function public.register_push_token from public, anon;
grant execute on function public.register_push_token to authenticated;
