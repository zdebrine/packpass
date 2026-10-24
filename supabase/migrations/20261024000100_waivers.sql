-- Waivers (PackPass Scheduling Flow Update §1: paperwork once, not per booking).
-- PackPass has one waiver (partner_id null) that covers every class booked through PackPass. A partner can add its
-- own, as pasted text, a PDF, or both. Members sign each one once: the PackPass waiver from Ready to book (onboarding
-- or the Dog tab), a partner's on the first booking there. Publishing a new version makes a new row, so everyone
-- signs again; old rows stay for the signatures that point at them.
-- DRAFT: the PackPass waiver below follows the membership terms (apps/web/src/content/legal.ts). Have a lawyer read it.

create table public.waivers (
  id uuid primary key default gen_random_uuid(),
  partner_id text references public.partners (id) on delete cascade,
  version int not null default 1 check (version >= 1),
  title text not null check (length(trim(title)) between 2 and 120),
  body text check (body is null or length(body) <= 20000),
  pdf_path text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (body is not null or pdf_path is not null)
);
-- One live waiver per partner, and one for PackPass.
create unique index waivers_one_active on public.waivers (coalesce(partner_id, '')) where active;
alter table public.waivers enable row level security;
create policy "waivers: read" on public.waivers for select to authenticated using (true);
revoke insert, update, delete on public.waivers from anon, authenticated;

create table public.waiver_signatures (
  member_id uuid not null references public.profiles (id) on delete cascade,
  waiver_id uuid not null references public.waivers (id) on delete cascade,
  signed_name text not null check (length(trim(signed_name)) between 2 and 120),
  signed_at timestamptz not null default now(),
  primary key (member_id, waiver_id)
);
alter table public.waiver_signatures enable row level security;
create policy "waiver_signatures: read own" on public.waiver_signatures for select to authenticated using (member_id = auth.uid());
revoke insert, update, delete on public.waiver_signatures from anon, authenticated;

-- Signs a live waiver with the member's typed name. Signing again keeps the first signature.
create function public.sign_waiver(p_waiver uuid, p_name text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_at timestamptz;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if length(v_name) < 2 or length(v_name) > 120 then raise exception 'bad_name'; end if;
  if not exists (select 1 from public.waivers where id = p_waiver and active) then raise exception 'not_found'; end if;
  insert into public.waiver_signatures (member_id, waiver_id, signed_name) values (me, p_waiver, v_name)
  on conflict (member_id, waiver_id) do nothing;
  select signed_at into v_at from public.waiver_signatures where member_id = me and waiver_id = p_waiver;
  return v_at;
end $$;
revoke execute on function public.sign_waiver from public, anon;
grant execute on function public.sign_waiver to authenticated;

-- Has this member signed the live waiver for a partner (null: PackPass's)? True when there is none to sign.
create function public.waiver_signed(p_member uuid, p_partner text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from public.waivers w
    where w.active and w.partner_id is not distinct from p_partner
      and not exists (select 1 from public.waiver_signatures s where s.waiver_id = w.id and s.member_id = p_member)
  )
$$;
revoke execute on function public.waiver_signed from public, anon;
grant execute on function public.waiver_signed to authenticated;

insert into public.waivers (partner_id, title, body) values (null, 'PackPass waiver', $w$
Dog training and dog sports involve physical activity and contact with other dogs and people. Risks include bites, scratches, falls, strains and other injuries, illness passed between dogs, lost or escaped dogs, and, rarely, serious injury or death, to your dog or to you.

By signing, you confirm that:

1. Your dog is in good health and has current Rabies, DHPP and Bordetella vaccines.
2. You will tell the trainer about anything that affects your dog's safety or other dogs' safety, such as illness, injury, heat, or a change in behavior.
3. You are responsible for your dog's behavior, and for any injury or damage your dog causes to people, other dogs or property.
4. A trainer can end a session for your dog if they think it isn't safe.
5. You choose to take part, and you accept these risks for yourself and your dog. To the fullest extent the law allows, you release PackPass and its team from claims arising from your or your dog's participation in sessions booked through PackPass, except claims caused by our gross negligence or willful misconduct.

This waiver covers every class you book through PackPass, for every dog on your account. Some partners have their own waiver, which PackPass asks you to sign once, on your first booking there.
$w$);
