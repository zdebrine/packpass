-- PackPass › Learn (v3 phase 5, member screens 16 and 17): training videos from Pack trainers for the days at home.
--   * PackPass uploads each video (an MP4) and its poster to the private `learn` bucket from Admin › Learn, with a
--     title, summary, category, trainer, chapters, what you'll need and the skills it helps. A video is a draft
--     until it's published.
--   * The whole tab sits behind the `learn` flag (Zak, 2026-10-24): off, PackPass admins only (to try it in the
--     app), or everyone. Members can't read videos or their files while it's off for them.
--   * video_watches keeps where each member got to, whether they finished, and the videos they saved.

-- ---- The flag ------------------------------------------------------------------------------------------------

create table public.app_flags (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_flags enable row level security;
insert into public.app_flags (key, value) values ('learn', 'off') on conflict (key) do nothing;

-- Whether the signed-in member sees Learn.
create function public.learn_enabled() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and case (select value from public.app_flags where key = 'learn')
    when 'everyone' then true
    when 'admins' then public.is_packpass_admin()
    else false end
$$;
revoke execute on function public.learn_enabled from public, anon;
grant execute on function public.learn_enabled to authenticated;

-- ---- Videos --------------------------------------------------------------------------------------------------

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 3 and 120),
  summary text not null default '' check (length(summary) <= 600),
  -- "Enrichment", "Recall": the chips on the library.
  category text not null check (length(category) between 2 and 24),
  -- Who teaches it. Null: PackPass.
  trainer_id text references public.trainers (id) on delete set null,
  -- `videos/<file>.mp4` in the learn bucket.
  video_path text not null check (video_path like 'videos/%' and video_path not like '%..%'),
  -- A photo library key, or `posters/<file>` in the learn bucket.
  poster text not null check (poster !~ '/' or (poster like 'posters/%' and poster not like '%..%')),
  duration_s int not null check (duration_s between 1 and 14400),
  -- [{"at": 105, "title": "Find it: treats around the room"}], in order.
  chapters jsonb not null default '[]' check (jsonb_typeof(chapters) = 'array' and jsonb_array_length(chapters) <= 20),
  needs text[] not null default '{}' check (cardinality(needs) <= 8),
  -- skills.id: "Picked for {dog}" matches these to what the dog is working on, and homework links to them.
  skills text[] not null default '{}',
  -- Null: a draft only PackPass sees.
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index videos_published on public.videos (published_at desc) where published_at is not null;
alter table public.videos enable row level security;
create policy "videos: members read published, admins read all" on public.videos for select to authenticated
  using ((published_at is not null and public.learn_enabled()) or public.is_packpass_admin());
grant select on public.videos to authenticated;

create table public.video_watches (
  member_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  -- Seconds in, for Continue watching.
  position_s int not null default 0 check (position_s >= 0),
  finished_at timestamptz,
  saved boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (member_id, video_id)
);
create index on public.video_watches (video_id);
alter table public.video_watches enable row level security;
create policy "video_watches: read own" on public.video_watches for select to authenticated using (member_id = (select auth.uid()));
grant select on public.video_watches to authenticated;

-- ---- Files ---------------------------------------------------------------------------------------------------

-- Private: members get signed URLs while Learn is on for them. No size limit of its own, so the project's upload
-- limit applies (Storage settings).
insert into storage.buckets (id, name, public, allowed_mime_types)
values ('learn', 'learn', false, array['video/mp4', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "learn: read while on, admins always" on storage.objects for select to authenticated
  using (bucket_id = 'learn' and (public.learn_enabled() or public.is_packpass_admin()));
create policy "learn: admins upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'learn' and public.is_packpass_admin());
create policy "learn: admins update" on storage.objects for update to authenticated
  using (bucket_id = 'learn' and public.is_packpass_admin());
create policy "learn: admins delete" on storage.objects for delete to authenticated
  using (bucket_id = 'learn' and public.is_packpass_admin());

-- ---- Members -------------------------------------------------------------------------------------------------

-- Saves where the member got to (every few seconds while playing, and on leaving). Finishing keeps the first
-- finish time; watching again from the start moves Continue watching back.
create function public.watch_video(p_video uuid, p_position int, p_finished boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v public.videos;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  select * into v from public.videos where id = p_video and published_at is not null;
  if not found or not public.learn_enabled() then raise exception 'not_found'; end if;
  insert into public.video_watches as w (member_id, video_id, position_s, finished_at)
  values (me, p_video, least(greatest(coalesce(p_position, 0), 0), v.duration_s), case when p_finished then now() end)
  on conflict (member_id, video_id) do update
    set position_s = excluded.position_s,
        finished_at = coalesce(w.finished_at, excluded.finished_at),
        updated_at = now();
end $$;

-- The bookmark on the player.
create function public.save_video(p_video uuid, p_saved boolean)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from public.videos where id = p_video and published_at is not null) or not public.learn_enabled() then
    raise exception 'not_found';
  end if;
  insert into public.video_watches as w (member_id, video_id, saved) values (me, p_video, coalesce(p_saved, false))
  on conflict (member_id, video_id) do update set saved = excluded.saved, updated_at = now();
end $$;

revoke execute on function public.watch_video, public.save_video from public, anon;
grant execute on function public.watch_video, public.save_video to authenticated;

-- ---- PackPass › Learn ----------------------------------------------------------------------------------------

-- Every video, drafts too, with how many members started and finished it.
create function public.admin_videos()
returns table (id uuid, title text, summary text, category text, trainer_id text, trainer_name text, partner_name text,
               video_path text, poster text, duration_s int, chapters jsonb, needs text[], skills text[],
               published_at timestamptz, updated_at timestamptz, started int, finished int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_packpass_admin() then raise exception 'not_admin'; end if;
  return query
  select v.id, v.title, v.summary, v.category, v.trainer_id, t.name, p.name, v.video_path, v.poster, v.duration_s, v.chapters,
         v.needs, v.skills, v.published_at, v.updated_at,
         (select count(*)::int from public.video_watches w where w.video_id = v.id),
         (select count(*)::int from public.video_watches w where w.video_id = v.id and w.finished_at is not null)
  from public.videos v
  left join public.trainers t on t.id = v.trainer_id
  left join public.partners p on p.id = t.partner_id
  order by v.published_at desc nulls first, v.created_at desc;
end $$;

-- Chapters: at most 20, each {"at": seconds inside the video, "title": 1 to 80 characters}, sorted by time.
create function public.clean_chapters(p jsonb, p_duration int) returns jsonb
language plpgsql stable set search_path = public as $$
declare
  res jsonb := '[]';
  x jsonb;
  t text;
  at int;
begin
  if p is null then return res; end if;
  if jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > 20 then raise exception 'bad_chapters'; end if;
  for x in select e from jsonb_array_elements(p) e order by (e ->> 'at')::numeric loop
    t := trim(coalesce(x ->> 'title', ''));
    at := (x ->> 'at')::numeric::int;
    if length(t) not between 1 and 80 or at is null or at < 0 or at >= p_duration then raise exception 'bad_chapters'; end if;
    res := res || jsonb_build_array(jsonb_build_object('at', at, 'title', t));
  end loop;
  return res;
end $$;
revoke execute on function public.clean_chapters from public, anon, authenticated;

-- Adds (p_id null) or updates a video. Publishing stamps the time it went out (it stays put when edited);
-- unpublishing makes it a draft again. Returns its id.
create function public.admin_save_video(p_id uuid, p_title text, p_summary text, p_category text, p_trainer text,
                                        p_video_path text, p_poster text, p_duration_s int, p_chapters jsonb,
                                        p_needs text[], p_skills text[], p_published boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_title text := trim(coalesce(p_title, ''));
  v_category text := trim(coalesce(p_category, ''));
  v_needs text[] := array(select trim(x) from unnest(coalesce(p_needs, '{}')) x where trim(x) <> '');
  v_skills text[] := array(select distinct x from unnest(coalesce(p_skills, '{}')) x);
  v_chapters jsonb;
  vid uuid;
begin
  if not public.is_packpass_admin() then raise exception 'not_admin'; end if;
  if length(v_title) not between 3 and 120 then raise exception 'bad_video_title'; end if;
  if length(v_category) not between 2 and 24 then raise exception 'bad_category'; end if;
  if coalesce(p_duration_s, 0) not between 1 and 14400 then raise exception 'bad_video'; end if;
  if coalesce(p_video_path, '') not like 'videos/%' or p_video_path like '%..%' then raise exception 'bad_video'; end if;
  if coalesce(p_poster, '') = '' or (p_poster ~ '/' and (p_poster not like 'posters/%' or p_poster like '%..%')) then raise exception 'bad_poster'; end if;
  if p_trainer is not null and not exists (select 1 from public.trainers where id = p_trainer) then raise exception 'not_found'; end if;
  if cardinality(v_needs) > 8 or exists (select 1 from unnest(v_needs) x where length(x) > 60) then raise exception 'bad_needs'; end if;
  if exists (select 1 from unnest(v_skills) x where not exists (select 1 from public.skills s where s.id = x)) then raise exception 'bad_skills'; end if;
  v_chapters := public.clean_chapters(coalesce(p_chapters, '[]'), p_duration_s);

  if p_id is null then
    insert into public.videos (title, summary, category, trainer_id, video_path, poster, duration_s, chapters, needs, skills, published_at)
    values (v_title, trim(coalesce(p_summary, '')), v_category, p_trainer, p_video_path, p_poster, p_duration_s, v_chapters, v_needs, v_skills,
            case when p_published then now() end)
    returning id into vid;
  else
    update public.videos set title = v_title, summary = trim(coalesce(p_summary, '')), category = v_category, trainer_id = p_trainer,
      video_path = p_video_path, poster = p_poster, duration_s = p_duration_s, chapters = v_chapters, needs = v_needs, skills = v_skills,
      published_at = case when p_published then coalesce(published_at, now()) end, updated_at = now()
    where id = p_id returning id into vid;
    if vid is null then raise exception 'not_found'; end if;
  end if;
  return vid;
end $$;

-- Deletes a video and everyone's progress on it. The dashboard removes its files.
create function public.admin_delete_video(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_packpass_admin() then raise exception 'not_admin'; end if;
  delete from public.videos where id = p_id;
  if not found then raise exception 'not_found'; end if;
end $$;

-- The flag: 'off', 'admins' or 'everyone'.
create function public.admin_learn_flag() returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_packpass_admin() then raise exception 'not_admin'; end if;
  return coalesce((select value from public.app_flags where key = 'learn'), 'off');
end $$;

create function public.admin_set_learn_flag(p_value text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_packpass_admin() then raise exception 'not_admin'; end if;
  if p_value is null or p_value not in ('off', 'admins', 'everyone') then raise exception 'bad_flag'; end if;
  insert into public.app_flags (key, value) values ('learn', p_value)
  on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;

revoke execute on function public.admin_videos, public.admin_save_video, public.admin_delete_video, public.admin_learn_flag,
  public.admin_set_learn_flag from public, anon;
grant execute on function public.admin_videos, public.admin_save_video, public.admin_delete_video, public.admin_learn_flag,
  public.admin_set_learn_flag to authenticated;
