-- Booking checks the waivers (Scheduling flow, block-waiver): the PackPass waiver, then the partner's own
-- waiver on the member's first booking there. Signing happens in the booking sheet, so these block booking a
-- class and joining its waitlist, not the classes the member can see. Spots the waitlist books on its own
-- (book_as) aren't checked again: the member signed to join it.
--
-- Partners write their waiver as pasted text, a PDF in the waivers bucket, or both, plus up to three short
-- points the booking sheet shows ("Barkwise waiver, in short"). Saving a change starts a new version, which
-- every member signs again on their next booking there.

alter table public.waivers add column summary text[] not null default '{}'
  check (cardinality(summary) <= 3);

-- 'waiver' or 'partner_waiver' when the member still has to sign one for this session's partner, else null.
create function public.waiver_block(p_member uuid, p_session uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when not public.waiver_signed(p_member, null) then 'waiver'
    when not public.waiver_signed(p_member, c.partner_id) then 'partner_waiver'
  end
  from public.sessions s join public.class_types c on c.id = s.class_id
  where s.id = p_session
$$;
revoke execute on function public.waiver_block from public, anon, authenticated;

create or replace function public.book_session(p_session uuid, p_dog uuid)
returns public.bookings language plpgsql security definer set search_path = public as $$
declare
  block text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  -- The dog's own blocks come first (book_as checks them again), as in the app.
  if exists (select 1 from public.dogs where id = p_dog and owner_id = auth.uid())
     and exists (select 1 from public.sessions where id = p_session) then
    block := coalesce(public.booking_block(p_dog, p_session), public.waiver_block(auth.uid(), p_session));
    if block is not null then raise exception '%', block; end if;
  end if;
  return public.book_as(auth.uid(), p_session, p_dog);
end $$;

create or replace function public.join_waitlist(p_dog uuid, p_session uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  s public.sessions;
  block text;
  w public.waitlist;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from public.dogs where id = p_dog and owner_id = me) then raise exception 'not_your_dog'; end if;
  select * into s from public.sessions where id = p_session for update;
  if not found then raise exception 'not_found'; end if;
  block := coalesce(public.booking_block(p_dog, p_session), public.waiver_block(me, p_session));
  if block is not null then raise exception '%', block; end if;
  if not s.waitlist_open then raise exception 'waitlist_closed'; end if;
  if exists (select 1 from public.bookings where session_id = p_session and dog_id = p_dog and status <> 'cancelled') then
    raise exception 'already_booked';
  end if;
  if exists (select 1 from public.waitlist where session_id = p_session and dog_id = p_dog and status = 'waiting') then
    raise exception 'already_waiting';
  end if;
  if s.spots_left > 0 then raise exception 'not_full'; end if;
  if (select credits_balance from public.profiles where id = me)
     < (select credits from public.class_types where id = s.class_id) then
    raise exception 'credits';
  end if;
  insert into public.waitlist (session_id, dog_id, member_id) values (p_session, p_dog, me) returning * into w;
  return (select count(*) from public.waitlist x where x.session_id = p_session and x.status = 'waiting' and x.created_at <= w.created_at);
end $$;

-- ---- The partner's waiver (owners) ----------------------------------------------------------------

-- Waiver PDFs: `<partner id>/<random>.pdf`, private. Members read them signed in; owners manage their own.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('waivers', 'waivers', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy "waivers: read signed in" on storage.objects for select to authenticated
  using (bucket_id = 'waivers');
create policy "waivers: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'waivers' and (storage.foldername(name))[1] = public.my_partner()
              and exists (select 1 from public.partner_staff where user_id = auth.uid() and role = 'owner'));
create policy "waivers: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'waivers' and (storage.foldername(name))[1] = public.my_partner()
         and exists (select 1 from public.partner_staff where user_id = auth.uid() and role = 'owner'));

-- Saves the partner's waiver as a new version (members sign it again). Text, a PDF in the partner's folder, or
-- both. Returns the new waiver's id.
create function public.partner_save_waiver(p_title text, p_summary text[], p_body text, p_pdf_path text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me text := public.owner_partner();
  v_title text := trim(coalesce(p_title, ''));
  v_body text := nullif(trim(coalesce(p_body, '')), '');
  v_pdf text := nullif(trim(coalesce(p_pdf_path, '')), '');
  v_summary text[] := array(select trim(x) from unnest(coalesce(p_summary, '{}')) x where trim(x) <> '');
  v_version int;
  v_id uuid;
begin
  if length(v_title) < 2 or length(v_title) > 120 then raise exception 'waiver_title'; end if;
  if v_body is null and v_pdf is null then raise exception 'waiver_empty'; end if;
  if length(v_body) > 20000 then raise exception 'waiver_too_long'; end if;
  if v_pdf is not null and (v_pdf not like me || '/%' or v_pdf like '%..%') then raise exception 'bad_file'; end if;
  if cardinality(v_summary) > 3 or exists (select 1 from unnest(v_summary) x where length(x) > 140) then
    raise exception 'bad_summary';
  end if;
  select coalesce(max(version), 0) + 1 into v_version from public.waivers where partner_id = me;
  update public.waivers set active = false where partner_id = me and active;
  insert into public.waivers (partner_id, version, title, summary, body, pdf_path)
  values (me, v_version, v_title, v_summary, v_body, v_pdf) returning id into v_id;
  return v_id;
end $$;

-- Stops asking members to sign the partner's waiver. Past signatures stay on record.
create function public.partner_remove_waiver()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.waivers set active = false where partner_id = public.owner_partner() and active;
end $$;

-- How many members signed the partner's current waiver (signatures are private to each member).
create function public.partner_waiver_signatures()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.waiver_signatures s
  join public.waivers w on w.id = s.waiver_id
  where w.active and w.partner_id = public.staff_partner()
$$;

revoke execute on function public.partner_save_waiver, public.partner_remove_waiver, public.partner_waiver_signatures from public, anon;
grant execute on function public.partner_save_waiver, public.partner_remove_waiver, public.partner_waiver_signatures to authenticated;

update public.waivers set summary = array[
  'Your dog is healthy and has current Rabies, DHPP and Bordetella vaccines.',
  'You''re responsible for your dog, and a trainer can end a session if it isn''t safe.',
  'You accept the risks of training and play, for you and your dog.'
] where partner_id is null and active;
