-- "Trainers for this" on a goal (10): each path names the trainer specialties that suit it, and the app
-- lists trainers with those specialties (set on the partner dashboard's Trainers page) or who teach one
-- of the path's classes.

alter table public.training_paths add column specialties text[] not null default '{}';

update public.training_paths set specialties = '{Reactivity,Separation,Behaviorist}' where id = 'calm-around-dogs';
update public.training_paths set specialties = '{"Leash skills",Recall,"Puppy foundations"}' where id = 'loose-leash-walking';

-- Starting specialties for the launch trainers, from their credentials. Only where the partner hasn't
-- set any, so nothing they've chosen is overwritten.
update public.trainers t set specialties = v.specialties
from (values
  ('maren', '{Herding,Recall}'::text[]),
  ('dev', '{"Fitness and conditioning",Recall}'::text[]),
  ('ana', '{Reactivity,Recall,"Leash skills"}'::text[]),
  ('sam', '{Reactivity,Separation}'::text[]),
  ('lena', '{"Puppy foundations"}'::text[])
) v(id, specialties)
where t.id = v.id and t.specialties = '{}';
