-- Partner photo uploads: class covers and trainer photos. Until now both were picked from the bundled photo
-- library (a key like 'dog_chilling'). A partner's own photo is a JPEG in the public partner-media bucket at
-- `<partner id>/<random>.jpg`, and class_types.image / trainers.photo_url hold that path instead of a key; the
-- apps tell the two apart by the slash. A new class's cover is seen in PackPass review with the rest of the
-- class; a trainer photo or a live class's new cover shows at once, and PackPass admins can take one down.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('partner-media', 'partner-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Partner staff manage files in their own partner's folder; admins can also remove them. Reading needs no
-- policy (the bucket is public); the select policy is what lets staff replace and delete their files.
create policy "partner media: read own or admin" on storage.objects for select to authenticated
  using (bucket_id = 'partner-media' and ((storage.foldername(name))[1] = public.my_partner() or public.is_packpass_admin()));
create policy "partner media: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'partner-media' and (storage.foldername(name))[1] = public.my_partner());
create policy "partner media: update own" on storage.objects for update to authenticated
  using (bucket_id = 'partner-media' and (storage.foldername(name))[1] = public.my_partner());
create policy "partner media: delete own or admin" on storage.objects for delete to authenticated
  using (bucket_id = 'partner-media' and ((storage.foldername(name))[1] = public.my_partner() or public.is_packpass_admin()));

-- A stored photo is a library key, or an upload in the row's own partner folder: a partner can't point a class
-- or trainer at another partner's files.
create function public.check_partner_photo() returns trigger
language plpgsql set search_path = public as $$
declare v text := to_jsonb(new) ->> tg_argv[0];  -- the photo column
begin
  if v like '%/%' and (new.partner_id is null or v not like new.partner_id || '/%' or v like '%..%') then
    raise exception 'bad_photo';
  end if;
  return new;
end $$;
create trigger class_types_photo before insert or update of image on public.class_types
  for each row execute function public.check_partner_photo('image');
create trigger trainers_photo before insert or update of photo_url, partner_id on public.trainers
  for each row execute function public.check_partner_photo('photo_url');

-- Staff set a trainer's photo: an upload path, or a library key. Same rule as partner_save_trainer: any staff
-- member of the trainer's partner.
create function public.partner_set_trainer_photo(p_id text, p_photo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(p_photo), '') = '' then raise exception 'bad_photo'; end if;
  update public.trainers set photo_url = trim(p_photo) where id = p_id and partner_id = public.staff_partner();
  if not found then raise exception 'not_found'; end if;
end $$;
revoke execute on function public.partner_set_trainer_photo from public, anon;

-- PackPass takes down an uploaded photo: the class or trainer goes back to the library's default photo (the apps
-- show one for an empty value). The dashboard deletes the file itself.
create function public.admin_remove_photo(p_class text default null, p_trainer text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_packpass_admin() then raise exception 'not_admin'; end if;
  if p_class is not null then update public.class_types set image = null where id = p_class; end if;
  if p_trainer is not null then update public.trainers set photo_url = null where id = p_trainer; end if;
end $$;
revoke execute on function public.admin_remove_photo from public, anon;

-- PackPass › Review lists every uploaded photo in use, newest partner first, so admins can take one down.
create function public.admin_partner_photos()
returns table (kind text, id text, name text, partner_name text, path text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_packpass_admin() then raise exception 'not_admin'; end if;
  return query
    select 'class', c.id, c.title, p.name, c.image from public.class_types c join public.partners p on p.id = c.partner_id where c.image like '%/%'
    union all
    select 'trainer', t.id, t.name, p.name, t.photo_url from public.trainers t join public.partners p on p.id = t.partner_id where t.photo_url like '%/%'
    order by 4, 1, 3;
end $$;
revoke execute on function public.admin_partner_photos from public, anon;
