-- Learn videos (migrations/…_learn_videos.sql). Uses its own accounts and runs in a transaction it rolls back.
begin;
create schema lv;
create function lv.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
create function lv.expect_error(q text, want text) returns void language plpgsql as $$
declare got text;
begin
  begin execute q; exception when others then got := sqlerrm; end;
  if got is null or got not like '%' || want || '%' then raise exception 'FAILED: expected error "%" got "%"', want, got; end if;
  raise notice 'ok: rejected with %', want;
end $$;
create function lv.as_user(id text) returns void language sql as $$ select set_config('request.jwt.claim.sub', id, false) $$;
grant usage on schema lv to authenticated;
grant execute on all functions in schema lv to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000001e1', 'lv-member@dog.co', '{"name":"Lia Member"}'),
  ('00000000-0000-0000-0000-0000000001e2', 'lv-admin@packpass.co', '{"name":"Ada Admin"}');
insert into packpass_admins (user_id) values ('00000000-0000-0000-0000-0000000001e2');
create table lv.v (draft uuid, live uuid);
grant select, update on lv.v to authenticated;
insert into lv.v values (null, null);

set role authenticated;

-- Admin › Learn: saving checks every field.
select lv.as_user('00000000-0000-0000-0000-0000000001e2');
select lv.ok(public.admin_learn_flag() = 'off', 'Learn starts off');
select lv.expect_error($$select public.admin_save_video(null, 'Hi', '', 'Recall', null, 'videos/a.mp4', 'dog_chilling', 60, '[]', '{}', '{}', false)$$, 'bad_video_title');
select lv.expect_error($$select public.admin_save_video(null, 'Recall at home', '', 'R', null, 'videos/a.mp4', 'dog_chilling', 60, '[]', '{}', '{}', false)$$, 'bad_category');
select lv.expect_error($$select public.admin_save_video(null, 'Recall at home', '', 'Recall', null, 'dog-photos/a.mp4', 'dog_chilling', 60, '[]', '{}', '{}', false)$$, 'bad_video');
select lv.expect_error($$select public.admin_save_video(null, 'Recall at home', '', 'Recall', null, 'videos/a.mp4', 'partner-media/x.jpg', 60, '[]', '{}', '{}', false)$$, 'bad_poster');
select lv.expect_error($$select public.admin_save_video(null, 'Recall at home', '', 'Recall', null, 'videos/a.mp4', 'dog_chilling', 60, '[{"at": 90, "title": "Too late"}]', '{}', '{}', false)$$, 'bad_chapters');
select lv.expect_error($$select public.admin_save_video(null, 'Recall at home', '', 'Recall', null, 'videos/a.mp4', 'dog_chilling', 60, '[]', '{}', '{flying}', false)$$, 'bad_skills');
select lv.expect_error($$select public.admin_save_video(null, 'Recall at home', '', 'Recall', 'nobody', 'videos/a.mp4', 'dog_chilling', 60, '[]', '{}', '{}', false)$$, 'not_found');

update lv.v set draft = public.admin_save_video(null, ' Recall around distractions ', 'Draft', 'Recall', null, 'videos/draft.mp4', 'dog_chilling', 300, '[]', '{}', '{recall}', false);
update lv.v set live = public.admin_save_video(null, 'Scent games with a muffin tin', 'Five games.', 'Enrichment', 'dev', 'videos/live.mp4', 'posters/live.jpg', 420,
  '[{"at": 250, "title": " Box search "}, {"at": 0, "title": "Set up"}]', '{Small treats, " ", An old towel}', '{enrichment,recall,recall}', true);
select lv.ok((select title = 'Recall around distractions' and published_at is null from public.videos where id = (select draft from lv.v)), 'a draft is saved, trimmed and unpublished');
select lv.ok((select published_at is not null and needs = '{Small treats,An old towel}' and skills = '{enrichment,recall}'
                     and chapters = '[{"at": 0, "title": "Set up"}, {"at": 250, "title": "Box search"}]'::jsonb
              from public.videos where id = (select live from lv.v)), 'a published video has clean needs, skills and sorted chapters');
select lv.ok((select count(*) = 2 and bool_or(trainer_name is not null and partner_name is not null) from public.admin_videos()), 'Admin › Learn lists drafts too, with the trainer');

-- Members: nothing while the flag is off.
select lv.as_user('00000000-0000-0000-0000-0000000001e1');
select lv.ok(not public.learn_enabled(), 'off: Learn is hidden from members');
select lv.ok((select count(*) = 0 from public.videos), 'off: members read no videos');
select lv.expect_error($$select public.watch_video((select live from lv.v), 10)$$, 'not_found');
select lv.expect_error($$select public.admin_videos()$$, 'not_admin');
select lv.expect_error($$select public.admin_set_learn_flag('everyone')$$, 'not_admin');

-- Admins only: the admin sees it in the app, members still don't.
select lv.as_user('00000000-0000-0000-0000-0000000001e2');
select public.admin_set_learn_flag('admins');
select lv.ok(public.learn_enabled(), 'admins: an admin sees Learn');
select lv.as_user('00000000-0000-0000-0000-0000000001e1');
select lv.ok(not public.learn_enabled(), 'admins: a member still doesn''t');

-- Everyone: members read published videos only, and their files.
select lv.as_user('00000000-0000-0000-0000-0000000001e2');
select lv.expect_error($$select public.admin_set_learn_flag('all')$$, 'bad_flag');
select public.admin_set_learn_flag('everyone');
reset role;
insert into storage.objects (bucket_id, name) values ('learn', 'videos/live.mp4');
set role authenticated;
select lv.as_user('00000000-0000-0000-0000-0000000001e1');
select lv.ok(public.learn_enabled(), 'everyone: members see Learn');
select lv.ok((select count(*) = 1 and bool_and(id = (select live from lv.v)) from public.videos), 'members read the published video, not the draft');
select lv.ok((select count(*) = 1 from storage.objects where bucket_id = 'learn'), 'members can read its file');
select lv.expect_error($$insert into storage.objects (bucket_id, name) values ('learn', 'videos/mine.mp4')$$, 'row-level security');

-- Watching: position is capped at the length, finishing keeps its first time, saving is separate.
select public.watch_video((select live from lv.v), 120);
select lv.ok((select position_s = 120 and finished_at is null and not saved from public.video_watches), 'progress is saved');
select public.watch_video((select live from lv.v), 9999, true);
select lv.ok((select position_s = 420 and finished_at is not null from public.video_watches), 'finishing caps the position and marks it finished');
select public.watch_video((select live from lv.v), 30);
select lv.ok((select position_s = 30 and finished_at is not null from public.video_watches), 'watching again keeps the finish');
select public.save_video((select live from lv.v), true);
select lv.ok((select saved and position_s = 30 from public.video_watches), 'saving keeps the position');
select lv.expect_error($$select public.watch_video((select draft from lv.v), 10)$$, 'not_found');
select lv.expect_error($$select public.save_video((select draft from lv.v), true)$$, 'not_found');
select lv.expect_error($$insert into public.video_watches (member_id, video_id) values ('00000000-0000-0000-0000-0000000001e1', (select draft from lv.v))$$, 'video_watches');

-- Unpublishing hides it again; publishing again restamps it. Deleting removes progress.
select lv.as_user('00000000-0000-0000-0000-0000000001e2');
select lv.ok((select started = 1 and finished = 1 from public.admin_videos() where id = (select live from lv.v)), 'Admin › Learn counts who started and finished');
select public.admin_save_video((select live from lv.v), 'Scent games with a muffin tin', 'Five games.', 'Enrichment', 'dev', 'videos/live.mp4', 'posters/live.jpg', 420, '[]', '{}', '{}', false);
select lv.as_user('00000000-0000-0000-0000-0000000001e1');
select lv.ok((select count(*) = 0 from public.videos), 'an unpublished video disappears for members');
select lv.as_user('00000000-0000-0000-0000-0000000001e2');
select public.admin_delete_video((select live from lv.v));
select lv.expect_error($$select public.admin_delete_video((select live from lv.v))$$, 'not_found');
reset role;
select lv.ok((select count(*) = 0 from public.video_watches), 'deleting a video removes everyone''s progress');

rollback;
