-- PackPass prices a class at 1-20 credits on Review (admin_set_class already checks 1-20); the table capped it at 8.
alter table public.class_types drop constraint class_types_credits_check;
alter table public.class_types add constraint class_types_credits_check check (credits between 1 and 20);
