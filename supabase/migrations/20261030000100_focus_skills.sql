-- PackPass › Working on (07k). The owner edits what a dog is working on: picked skills are added (source
-- 'owner') or brought back, and skills left out are marked removed so traits and paths don't add them again.
create function public.set_focus_skills(p_dog uuid, p_skills text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.owns_dog(p_dog) then raise exception 'not_found'; end if;
  if exists (select 1 from unnest(coalesce(p_skills, '{}')) s where not exists (select 1 from public.skills k where k.id = s)) then raise exception 'bad_skill'; end if;
  insert into public.dog_focus_skills (dog_id, skill_id, source)
  select p_dog, s, 'owner' from unnest(coalesce(p_skills, '{}')) s
  on conflict (dog_id, skill_id) do update set removed_at = null;
  update public.dog_focus_skills set removed_at = now()
  where dog_id = p_dog and removed_at is null and not (skill_id = any (coalesce(p_skills, '{}')));
end $$;
revoke execute on function public.set_focus_skills from public, anon;
grant execute on function public.set_focus_skills to authenticated;
