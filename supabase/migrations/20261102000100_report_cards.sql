-- PackPass › Roster and report cards (v3 phase 4c, Pack Partner Scheduling roster and report cards, Pack Scheduling
-- 22a and 22b).
--   * the roster marks dogs who didn't come as no-shows once the session has started (partner_mark_no_show)
--   * a report card per dog after class: Focus, Sociability and Skill rated 1 to 3, a one-line note and up to three
--     homework items, sent one dog at a time or for the whole class. The note still lands in session_notes, so the
--     Log, focus skills and the after-class reminder keep working.
--   * homework is a drill from the practice catalog (it opens the drill in the app) or the trainer's own words.
--     Owners tick items off on Today and on the after-class note; a tick logs the practice to the dog's Log and
--     unticking takes it back out.

-- ---- No-shows from the roster ------------------------------------------------------------------------------

-- Marks a dog who didn't come (or undoes it). Only once the session has started; the owner gets the same Missed
-- class notification mark_no_shows sends, and undoing takes it back (unmiss_booking).
create function public.partner_mark_no_show(p_booking uuid, p_undo boolean default false)
returns public.bookings language plpgsql security definer set search_path = public as $$
declare
  b public.bookings;
  r record;
begin
  select bk.*, s.starts_at, c.title, c.cancel_hours, (select d.name from public.dogs d where d.id = bk.dog_id) dog_name into r
  from public.bookings bk join public.sessions s on s.id = bk.session_id join public.class_types c on c.id = s.class_id
  where bk.id = p_booking and c.partner_id = public.staff_partner() for update of bk;
  if not found then raise exception 'not_found'; end if;
  if r.starts_at > now() then raise exception 'too_early'; end if;
  if p_undo then
    if r.status <> 'no_show' then raise exception 'not_no_show'; end if;
    update public.bookings set status = 'booked' where id = p_booking returning * into b;
    return b;
  end if;
  if r.status <> 'booked' then raise exception 'not_booked'; end if;
  update public.bookings set status = 'no_show' where id = p_booking returning * into b;
  insert into public.notifications (member_id, category, kind, title, body, href)
  values (b.member_id, 'bookings', 'class_missed', r.dog_name || ' missed ' || r.title,
          r.dog_name || ' wasn''t checked in, so the ' || case when b.credits_charged = 1 then 'credit was' else b.credits_charged || ' credits were' end
          || ' used. Cancel at least ' || r.cancel_hours || ' hours before and they come back.',
          public.dog_href('/missed/' || b.id, b.dog_id));
  return b;
end $$;
revoke execute on function public.partner_mark_no_show from public, anon;
grant execute on function public.partner_mark_no_show to authenticated;

-- ---- Report cards ------------------------------------------------------------------------------------------

create table public.report_cards (
  booking_id uuid primary key references public.bookings (id) on delete cascade,
  trainer_id text references public.trainers (id) on delete set null,
  focus smallint not null check (focus between 1 and 3),
  sociability smallint not null check (sociability between 1 and 3),
  skill smallint not null check (skill between 1 and 3),
  -- Up to three items: {"text": "Mat at home", "drill": "mat-at-home"}; drill is null for the trainer's own words.
  homework jsonb not null default '[]' check (jsonb_typeof(homework) = 'array' and jsonb_array_length(homework) <= 3),
  sent_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.report_cards enable row level security;
create policy "report_cards: read own" on public.report_cards for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and b.member_id = (select auth.uid())));
grant select on public.report_cards to authenticated;

-- A homework item the owner ticked off, and the practice it logged.
create table public.homework_ticks (
  booking_id uuid not null references public.report_cards (booking_id) on delete cascade,
  item int not null check (item between 0 and 2),
  activity_id uuid not null references public.home_activities (id) on delete cascade,
  ticked_at timestamptz not null default now(),
  primary key (booking_id, item)
);
create index on public.homework_ticks (activity_id);
alter table public.homework_ticks enable row level security;
create policy "homework_ticks: read own" on public.homework_ticks for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and b.member_id = (select auth.uid())));
grant select on public.homework_ticks to authenticated;

-- Drills to offer as homework for a session: the class's own skills first, then what the dogs on it are working on.
create function public.partner_homework_options(p_session uuid)
returns table (drill_id text, title text, minutes int, skill text)
language sql stable security definer set search_path = public as $$
  with s as (
    select ss.id, ss.class_id from public.sessions ss join public.class_types c on c.id = ss.class_id
    where ss.id = p_session and c.partner_id = public.staff_partner()
  ), focus as (
    select f.skill_id, count(*) n from public.dog_focus_skills f
    join public.bookings b on b.dog_id = f.dog_id join s on s.id = b.session_id
    where f.removed_at is null and b.status <> 'cancelled' group by f.skill_id
  )
  select d.id, d.title, d.minutes, k.label
  from s, public.drills d join public.skills k on k.id = d.skill_id
  left join focus on focus.skill_id = k.id
  where d.active and not k.trainer_led
  order by (s.class_id = any (k.class_ids)) desc, coalesce(focus.n, 0) desc,
           case d.level when 'start' then 0 when 'next' then 1 else 2 end, k.sort, d.sort
  limit 8
$$;
revoke execute on function public.partner_homework_options from public, anon;
grant execute on function public.partner_homework_options to authenticated;

-- Every dog on the partner's sessions from the last p_days that have started, with its report card (if sent).
create function public.partner_report_cards(p_days int default 7)
returns table (booking_id uuid, session_id uuid, starts_at timestamptz, class_id text, class_title text, discipline text,
               status public.booking_status, dog_id uuid, dog_name text, breed text, owner_name text, photo_path text,
               note text, skills text[], focus smallint, sociability smallint, skill smallint, homework jsonb, sent_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.id, s.id, s.starts_at, c.id, c.title, c.discipline, b.status, d.id, d.name, d.breed, p.name, d.photo_path,
         n.note, coalesce(n.skills, '{}'), r.focus, r.sociability, r.skill, coalesce(r.homework, '[]'), coalesce(r.sent_at, n.created_at)
  from public.bookings b
  join public.sessions s on s.id = b.session_id
  join public.class_types c on c.id = s.class_id
  join public.dogs d on d.id = b.dog_id
  join public.profiles p on p.id = b.member_id
  left join public.session_notes n on n.booking_id = b.id
  left join public.report_cards r on r.booking_id = b.id
  where c.partner_id = public.staff_partner() and b.status in ('booked', 'checked_in', 'no_show') and s.cancelled_at is null
    and s.starts_at < now() and s.starts_at > now() - make_interval(days => p_days)
  order by s.starts_at desc, d.name
$$;
revoke execute on function public.partner_report_cards from public, anon;
grant execute on function public.partner_report_cards to authenticated;

-- Checks one homework list: at most three items of 2 to 140 characters, each a known drill or the trainer's own words.
create function public.clean_homework(p jsonb) returns jsonb
language plpgsql stable set search_path = public as $$
declare
  res jsonb := '[]';
  x jsonb;
  t text;
  dr text;
begin
  if p is null then return res; end if;
  if jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > 3 then raise exception 'bad_homework'; end if;
  for x in select * from jsonb_array_elements(p) loop
    t := trim(coalesce(x ->> 'text', ''));
    dr := nullif(x ->> 'drill', '');
    if length(t) not between 2 and 140 then raise exception 'bad_homework'; end if;
    if dr is not null and not exists (select 1 from public.drills where id = dr) then raise exception 'bad_homework'; end if;
    res := res || jsonb_build_array(jsonb_build_object('text', t, 'drill', dr));
  end loop;
  return res;
end $$;

-- Sends (or updates) one dog's report card. The note is optional; with one, it's the dog's session note too. The
-- first send tells the owner; sending checks in a dog that wasn't (it was there to be rated).
create function public.partner_send_report_card(p_booking uuid, p_focus int, p_sociability int, p_skill int,
                                                p_note text, p_homework jsonb, p_skills text[] default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare
  me text := public.staff_partner();
  r record;
  trainer text;
  hw jsonb := public.clean_homework(p_homework);
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  is_first boolean;
  nxt timestamptz;
  n int;
begin
  select b.id, b.member_id, b.dog_id, b.session_id, b.status, s.starts_at, d.name dog_name, c.title, c.trainer_id into r
  from public.bookings b join public.sessions s on s.id = b.session_id join public.class_types c on c.id = s.class_id
  join public.dogs d on d.id = b.dog_id
  where b.id = p_booking and c.partner_id = me and b.status <> 'cancelled';
  if not found then raise exception 'not_found'; end if;
  if r.starts_at > now() then raise exception 'too_early'; end if;
  if p_focus not between 1 and 3 or p_sociability not between 1 and 3 or p_skill not between 1 and 3 then raise exception 'bad_rating'; end if;
  if length(v_note) > 280 then raise exception 'bad_note'; end if;
  trainer := coalesce((select trainer_id from public.partner_staff where user_id = auth.uid()), r.trainer_id);
  is_first := not exists (select 1 from public.report_cards where booking_id = p_booking);

  -- A changed homework list starts its ticks over (what was logged stays in the Log).
  delete from public.homework_ticks t using public.report_cards c
  where t.booking_id = p_booking and c.booking_id = p_booking and c.homework is distinct from hw;
  insert into public.report_cards (booking_id, trainer_id, focus, sociability, skill, homework)
  values (p_booking, trainer, p_focus, p_sociability, p_skill, hw)
  on conflict (booking_id) do update set trainer_id = excluded.trainer_id, focus = excluded.focus, sociability = excluded.sociability,
    skill = excluded.skill, homework = excluded.homework, updated_at = now();

  if v_note is not null then
    if exists (select 1 from public.session_notes where booking_id = p_booking) then
      update public.session_notes set note = v_note, skills = coalesce(p_skills, '{}'), trainer_id = trainer where booking_id = p_booking;
    else
      insert into public.session_notes (booking_id, trainer_id, note, skills) values (p_booking, trainer, v_note, coalesce(p_skills, '{}'));
    end if;
  else
    delete from public.session_notes where booking_id = p_booking;
  end if;
  update public.bookings set status = 'checked_in', checked_in_at = coalesce(checked_in_at, r.starts_at)
  where id = p_booking and status in ('booked', 'no_show');

  if is_first then
    n := jsonb_array_length(hw);
    select s.starts_at into nxt from public.bookings b join public.sessions s on s.id = b.session_id
    where b.dog_id = r.dog_id and b.status = 'booked' and s.starts_at > r.starts_at and s.cancelled_at is null
    order by s.starts_at limit 1;
    insert into public.notifications (member_id, category, kind, title, body, href, session_id)
    values (r.member_id, 'notes', 'session_note',
            coalesce((select split_part(name, ' ', 1) from public.trainers where id = trainer), 'Your trainer') || ' left a note for ' || r.dog_name || '.',
            coalesce(v_note || ' ', r.title || ': ratings from today''s class. ')
              || case n when 0 then '' else (array['One homework item', 'Two homework items', 'Three homework items'])[n]
                   || coalesce(' until ' || to_char(nxt at time zone 'America/Chicago', 'FMDay'), '') || '.' end,
            public.dog_href('/after-class/' || p_booking, r.dog_id), r.session_id);
  end if;
end $$;
revoke execute on function public.partner_send_report_card from public, anon;
grant execute on function public.partner_send_report_card to authenticated;

-- ---- The member's side ---------------------------------------------------------------------------------------

-- The member's report cards from the last 60 days, newest first, with what's ticked off. Homework is open until the
-- dog's next class starts (two weeks when nothing is booked).
create function public.my_report_cards()
returns table (booking_id uuid, dog_id uuid, session_id uuid, class_id text, title text, starts_at timestamptz, partner_name text,
               trainer_name text, trainer_role text, trainer_photo text, discipline text, note text,
               focus smallint, sociability smallint, skill smallint, homework jsonb, done int[], open_until timestamptz)
language sql stable security definer set search_path = public as $$
  select b.id, b.dog_id, s.id, c.id, c.title, s.starts_at, pa.name, t.name, t.credential, t.photo_url, c.discipline, n.note,
         r.focus, r.sociability, r.skill, r.homework,
         array(select h.item from public.homework_ticks h where h.booking_id = b.id order by h.item),
         coalesce((select min(s2.starts_at) from public.bookings b2 join public.sessions s2 on s2.id = b2.session_id
                   where b2.dog_id = b.dog_id and b2.status in ('booked', 'checked_in') and s2.starts_at > s.starts_at and s2.cancelled_at is null),
                  s.starts_at + interval '14 days')
  from public.report_cards r
  join public.bookings b on b.id = r.booking_id
  join public.sessions s on s.id = b.session_id
  join public.class_types c on c.id = s.class_id
  join public.partners pa on pa.id = c.partner_id
  left join public.trainers t on t.id = coalesce(r.trainer_id, c.trainer_id)
  left join public.session_notes n on n.booking_id = b.id
  where b.member_id = (select auth.uid()) and s.starts_at > now() - interval '60 days'
  order by s.starts_at desc
$$;
revoke execute on function public.my_report_cards from public, anon;
grant execute on function public.my_report_cards to authenticated;

-- Ticks a homework item off (logging it as practice in the dog's Log) or unticks it (taking that practice back out).
-- A drill logs as that drill; the trainer's own words log as 5 minutes of training. Returns the logged activity.
create function public.tick_homework(p_booking uuid, p_item int, p_done boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r record;
  x jsonb;
  dr public.drills;
  aid uuid;
begin
  select b.member_id, b.dog_id, c.homework into r
  from public.report_cards c join public.bookings b on b.id = c.booking_id
  where c.booking_id = p_booking and b.member_id = me;
  if not found then raise exception 'not_found'; end if;
  x := r.homework -> p_item;
  if x is null then raise exception 'not_found'; end if;
  if not p_done then
    delete from public.home_activities a using public.homework_ticks t
    where t.booking_id = p_booking and t.item = p_item and a.id = t.activity_id;
    return null;
  end if;
  select activity_id into aid from public.homework_ticks where booking_id = p_booking and item = p_item;
  if aid is not null then return aid; end if;
  select * into dr from public.drills where id = x ->> 'drill';
  insert into public.home_activities (member_id, dog_id, kind, done_at, duration_min, balance, skills, drill_id, note)
  values (me, r.dog_id, coalesce(dr.activity, 'train'), now(), coalesce(dr.minutes, 5),
          public.activity_balance(coalesce(dr.activity, 'train')), case when dr.id is null then '{}' else array[dr.skill_id] end, dr.id,
          case when dr.id is null then left(x ->> 'text', 280) end)
  returning id into aid;
  insert into public.homework_ticks (booking_id, item, activity_id) values (p_booking, p_item, aid);
  return aid;
end $$;
revoke execute on function public.tick_homework from public, anon;
grant execute on function public.tick_homework to authenticated;
