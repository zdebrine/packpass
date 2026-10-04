-- Undoing a check-in (the partner's roster, e.g. the wrong dog was ticked) takes back the training-path
-- step it completed: the step is no longer done, the path is on that step again, and the "Step done"
-- notification goes (a push already sent can't be recalled). Only the dog's latest step is taken back;
-- if the dog has done later steps since, that progress stands.

create function public.rewind_paths() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  st record;
  total int;
begin
  for st in
    select ds.path_id, ds.position, d.next_step, d.completed_at
    from public.dog_path_steps ds join public.dog_paths d on d.dog_id = ds.dog_id and d.path_id = ds.path_id
    where ds.booking_id = new.id
  loop
    if st.next_step <> st.position + 1 then continue; end if;   -- a later step is done too
    select count(*) into total from public.path_steps where path_id = st.path_id;
    delete from public.dog_path_steps where dog_id = new.dog_id and path_id = st.path_id and position = st.position;
    update public.dog_paths set next_step = st.position, completed_at = null where dog_id = new.dog_id and path_id = st.path_id;
    delete from public.notifications where id = (
      select n.id from public.notifications n join public.training_paths tp on tp.id = st.path_id
      where n.member_id = new.member_id and n.kind = 'path_step' and n.href = '/goal/' || st.path_id
        and n.title = case when st.completed_at is not null then tp.title || ' is complete' else 'Step ' || st.position || ' of ' || total || ' done' end
      order by n.created_at desc limit 1);
  end loop;
  return new;
end $$;
revoke execute on function public.rewind_paths from public, anon, authenticated;

create trigger bookings_rewind_paths after update of status on public.bookings
for each row when (old.status = 'checked_in' and new.status is distinct from 'checked_in')
execute function public.rewind_paths();
