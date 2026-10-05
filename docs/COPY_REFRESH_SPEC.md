# PackPass Copy Refresh: Tech Spec

Oct 5, 2026 · @Zak · Source: [PackPass Landing Page Copy Review](https://claude.ai/code/artifact/e0e79e20-d32f-4c0d-b8df-d462ec8f03af)

## Summary

The website, member app and partner tools move from "every dog is an athlete" to **"make your dog a good hang."** Variety and matching stay as the mechanism; the promise becomes a dog that is easier to live with and bring places. Partner surfaces lead with control and dog quality, then money.

This spec turns the copy review into code changes across:

- `apps/web` (marketing site, owner and partner pages)
- `apps/member` (Expo app: welcome, onboarding, month, traits)
- `apps/partner` (apply flow, roster, assessments)
- `supabase` (trait catalog and data migration)

Work is split into 7 phases. Each phase is one PR and ships on its own. Phases 1 and 2 must land before 4 and 5 (they share the trait catalog). Phase 7's paid path turns on when a Stripe Payment Link URL is set.

## Copy rules (apply to every string in this spec)

- No em dashes anywhere. Use periods, commas or parentheses.
- No paw or bone puns.
- Promise progress, never a fix: "work on", "get easier", "calmer". Never "fixed", "cured", "guaranteed".
- Never make the owner the problem. The dog is bored, under-exercised, or never got the right class.
- No claims we can't back pre-launch: no "most popular", no testimonials, no member counts.
- Only claim enforcement that the booking functions actually enforce (see Phase 3, "Who can book").

## Phase 1: Trait catalog with stable ids (Supabase)

### Problem

`dogs.traits` is `text[]` holding display labels ("Pulls on the leash"). Labels are hardcoded in three places that must stay in sync:

- `apps/member/src/data/fixtures.ts` (`TRAIT_GROUPS`, `PLAN_GOALS`)
- `apps/member/src/api/live.ts` (`TRAIT_PATHS` keyed by label)
- `apps/web/src/pages/Owners.tsx` (`TRAITS` and `has('...')` checks in `Match`)

Renaming any label breaks path routing and the web sample month, and orphans existing rows.

### Change

New migration `supabase/migrations/20261005000100_trait_catalog.sql`:

```sql
create table public.traits (
  id text primary key,
  label text not null,          -- owner-facing, in owner voice
  partner_label text not null,  -- plain, clinical, shown to trainers
  grp text not null,            -- 'dogs' | 'people' | 'walks' | 'home' | 'special'
  sort int not null,
  path_id text references public.training_paths(id),  -- training path started at sign-up, if any
  legacy_label text unique      -- old label, for the backfill only
);
alter table public.traits enable row level security;
create policy traits_read on public.traits for select to anon, authenticated using (true);
```

Seed rows (same migration):

| id | label (owner) | partner_label | grp | path_id | legacy_label |
| --- | --- | --- | --- | --- | --- |
| rough_play | Plays too rough | Plays too rough | dogs | | Plays too rough |
| nervous_dogs | Nervous around new dogs | Nervous with new dogs | dogs | calm-around-dogs | Nervous with new dogs |
| guards | Guards food or toys | Resource guards | dogs | | Guards food or toys |
| shy_people | Shy with strangers | Nervous with strangers | people | | Nervous with strangers |
| jumps | Greets everyone by jumping | Jumps up on people | people | | Jumps up on people |
| barks_visitors | Barks at every doorbell | Barks at visitors | people | | Barks at visitors |
| pulls | Pulls like a sled dog | Pulls on the leash | walks | loose-leash-walking | Pulls on the leash |
| leash_reactive | Loses it at dogs on walks | Leash reactive (lunges or barks at dogs) | walks | calm-around-dogs | Lunges or barks at dogs on walks |
| chases | Chases bikes and cars | Chases bikes or cars | walks | | Chases bikes or cars |
| recall | Selective hearing at the park | Weak recall | walks | | Slow to come when called |
| settle_public | Can't settle in public | Struggles to settle in public | walks | | (new) |
| alone | Struggles when left alone | Separation stress | home | | Struggles when left alone |
| bored_chewing | Bored and chewing at home | Chews or digs when alone | home | | Chews or digs when alone |
| crate | Hard to settle in a crate | Hard to settle in a crate | home | | Hard to settle in a crate |
| none | None of these | None listed | special | | None of these |
| not_sure | Not sure yet | Owner not sure | special | | Not sure yet |

Backfill in the same migration:

```sql
update public.dogs d
set traits = coalesce((
  select array_agg(coalesce(t.id, x) order by o)
  from unnest(d.traits) with ordinality as u(x, o)
  left join public.traits t on t.legacy_label = x
), '{}');
```

Unknown strings (e.g. "Barks at bikes" from the e2e test) are kept as-is so nothing is lost. Apps must render an unknown id by showing the raw string.

Also update:

- `supabase/seed.sql`: `'{"Pulls on the leash","Nervous with new dogs"}'` becomes `'{"pulls","nervous_dogs"}'`.
- `apps/member/e2e/live/member-flow.ts` lines ~150 to 152: use `['pulls', 'Barks at bikes']` and expect `'pulls,Barks at bikes'`.

### Drop-off flag on classes

Owners stay with their dog for every session except drop-off classes. There is no field for this today.

Same migration (or `20261005000200_drop_off.sql`):

```sql
alter table public.class_types add column drop_off boolean not null default false;
```

- Expose `drop_off` everywhere `class_types` is selected for members and partners (member `live.ts` loaders, partner `api.ts`, `partner_save_class` payload and function).
- Update `partner_save_class` to accept and store `drop_off`.
- Assessments and privates can never be drop-off: enforce with `check (not drop_off or session_type = 'class')`.

### Acceptance

- Migration runs clean on a fresh db and on a db with seed data; `supabase/tests/run-local.sh` passes.
- Every existing `dogs.traits` value that matches a legacy label is now an id.
- `select * from traits` works with the anon key.

## Phase 2: Shared trait and discipline constants in the apps

There is no shared package in the repo, so each app gets a small module that reads the catalog with a hardcoded fallback (same pattern as `apps/web/src/lib/catalog.ts`).

### Trait module

- `apps/web/src/lib/traits.ts`, `apps/member/src/data/traits.ts`, `apps/partner/src/lib/traits.ts`.
- Each exports `FALLBACK_TRAITS` (the seed table above), a `useTraits()` hook (or a loader in the member store) that reads `traits` from Supabase and falls back on error, and `traitLabel(id, audience: 'owner' | 'partner')` that returns the raw string for unknown ids.

### Discipline payoff lines

A one-line "why this class" keyed by `discipline` (values already used in `class_types.discipline`). Same constant in `apps/web/src/lib/payoffs.ts` and `apps/member/src/data/payoffs.ts`:

| discipline | payoff |
| --- | --- |
| Agility | Builds focus and confidence |
| Scent | Tires the brain fast |
| Sprint | For dogs who need to really run |
| Herding | A job for dogs bred to have one |
| Open play | Room to run off leash |
| Play | Burns energy with good-fit dogs |
| Sniff | A quiet, private space to decompress |
| Skills | Work on the stuff that's hard |
| Fitness | Strength and stamina, done right |
| Assessment | Unlocks group classes at every partner |

Unknown discipline returns `null` and the UI hides the line. Check `supabase/catalog.sql` for any discipline not listed and add a line for it.

## Phase 3: Website, owner page (`apps/web/src/pages/Owners.tsx`)

### Hero

- Add `const HERO_VARIANT: 'static' | 'rotating' = 'static'` at the top of the file so both versions can be tested.
- Eyebrow: `Sport · Scent · Play · Skills · Austin` becomes `Dog classes matched to your dog · Austin`.
- `static`: H1 is `Make your dog a good hang.` Photos keep cross-fading behind it; the word animation is off.
- `rotating`: H1 line 1 `A dog who's`, line 2 rotates through `easy on a patio.` / `chill around other dogs.` / `back when you call.` / `tired by dinner.` / `welcome anywhere.` Pair photos in `HERO` in that order: `dog_chilling_with_owner_on_porch`, `dogs_meeting_on_leash`, `dog_being_patient`, `dog_and_owner_chilling`, `dog_chilling_in_car` (the Phase 7 photo set). Update alt text to match each photo.
- Subhead: `Drop-in classes across Austin, picked for your dog's energy and quirks. Burn the energy, work on the pulling, and take them everywhere.`
- Secondary CTA: `Build my dog's month` becomes `Match my dog`.
- Photography: the Phase 7 photo set added the calm-dog-on-a-patio shot (`dog_chilling_with_owner_on_porch`), which now leads the hero.

### Matched to your dog (`Match`)

- Heading: `Tell us what your dog's like. We'll build the month.` (eyebrow stays `Matched to your dog`).
- Energy chips display labels, keyed by the `energy_level` enum value:

| key | label |
| --- | --- |
| couch | Couch potato |
| medium | Up for anything |
| high | Needs a job |
| working | Never stops |

- Trait chips: render these ids from the trait module, in this order: `nervous_dogs`, `rough_play`, `pulls`, `recall`, `jumps`, `barks_visitors`, `settle_public`, `bored_chewing`. Keep the max of 3. Default selection `['nervous_dogs']`, default energy `high`.
- Replace every `has('<label>')` with id checks. Routing rules (ids from the class catalog):
  - `nervous_dogs` or `rough_play` swaps play for `calm-private` (unchanged logic).
  - `pulls`, `recall`, `jumps`, `barks_visitors` add `focus-recall` (unchanged logic).
  - `settle_public` (new) adds `focus-recall` and `sniff-space`.
  - `bored_chewing` (new) adds `scent-work`.
  - Keep the 16-credit cap and the pop-until-under-cap loop.
- Each result row: under the title, show the discipline payoff in quotes in place of the current balance word, e.g. `Northside · "Tires the brain fast" · 2.1 mi`. Keep the balance word if the payoff is null.
- Result CTA: `Get the app to book it` becomes `Book this month in the app`.

### How it works

- Heading: `One membership. The right classes for your dog. No 6-week commitment.`
- Steps:
  1. `Tell us about your dog` / `Energy, quirks, the stuff that makes walks hard. We match classes and certified trainers to fit.`
  2. `Mix it up week to week` / `Agility one week, scent work the next, a 1:1 when you need one. Just drop in.`
  3. `Watch them get easier` / `Trainers leave notes after every session, so you can see the progress and the next trainer picks up where the last one left off.`

### Classes

- Heading: `A different outlet every week.`
- Side copy: `Physical, mental and social work, so your dog comes home tired in the good way. Every session shows its level, spots left and credits before you book.`
- Each tile gets a second line under the label (add a `.pk-tile-sub` style or reuse caption styling, white at 85% on the scrim):

| tile | sub line |
| --- | --- |
| Agility | Builds focus and confidence |
| Scent work | Tires the brain fast |
| Sprint and lure | For dogs who need to really run |
| Herding | A job for dogs bred to have one |
| Open field | Room to run off leash |
| Sniff spaces | A quiet, private space to decompress |
| Recall and focus | Come when called. The first time. |
| Reactive dog drop-ins | Small groups, lots of space, no judgment |

### Partners near you

- Heading: `Local trainers we'd trust with our own dogs.`
- Add a subhead paragraph: `Every lead trainer is certified (CPDT-KA, KPA or IAABC). Every partner is licensed and insured.` This matches the partner application requirements in `apps/partner/src/apply/Apply.tsx`.

### Dog Passport

- Heading: `One profile. Every trainer on the same page.`
- Body: `Juno's vaccines, temperament and trainer notes travel with her. No re-explaining her quirks at every new place, and you can see what's actually working.`
- Rows, in this order:
  1. `MessageSquareText` icon, `Trainer notes after every class`, `"Held a down-stay with two dogs passing. Big win."`
  2. `TrendingUp`, `Levels set by trainers`, `Agility Level 3, Scent Work Level 1` (unchanged)
  3. `Flame`, `Weekly streaks`, `Book once a week to keep it going` (unchanged)
- Drop the `Stamp` row.

### Plans

- `PLANS` fit lines:
  - Starter: `A regular outlet for a mostly chill dog. About 3 classes a month.`
  - Regular: `A class most weeks, plus a session on the stuff that's hard.`
  - Working Dog: `For dogs who are never tired. Out about twice a week.`
- Tag on Regular: `Most popular` becomes `Best fit for most dogs`.
- Bullets: `Any partner, any class` · `Free cancel up to 12 hours before` · `Unused credits roll over` · `Pause or cancel anytime`.

### FAQ (`OWNER_FAQ`, in this order)

1. How do credits work? (unchanged)
2. **My dog is reactive. Can we still join?** `Yes. Tell us in your dog's profile and you'll only see sessions that fit: reactive-dog drop-ins with small groups and plenty of space, and 1:1s with behavior specialists. Nobody puts your dog in a busy group class.`
3. **How is this different from daycare?** (new) `Daycare is a day of free play in a big group. PackPass sessions are short and structured, with a trainer or a purpose, and picked for what your dog needs.`
4. **Does this replace a trainer?** (new) `It gives you access to lots of them. Drop in to group classes, book a 1:1 with a specialist when something needs work, and keep it all in one profile.`
5. **What if a class isn't a good fit?** (new) `Tell us in the app. We'll adjust your dog's matches, and the trainer's notes help steer the next pick.`
6. **Do I stay with my dog?** (new) `Yes, for most sessions. Some classes are drop-off, where you leave your dog with the trainer. Those are marked before you book.`
7. Do unused credits roll over? (unchanged)
8. Can I cancel a booking? (unchanged)
9. What does my dog need to join? (unchanged)
10. Can I pause or cancel my plan? (unchanged)
11. Is PackPass outside Austin? (unchanged)

Note for answer 2: verify that the Book tab filters by traits as described. If it does not, change the second sentence to `Filter to reactive-dog drop-ins and 1:1s with behavior specialists.` until it does.

### Final CTA, footer, meta

- Final CTA H2: `Book your dog's first class this week.` Add a line under it, above the store buttons: `No 6-week commitment. Pause or cancel anytime.`
- `Site.tsx` footer tagline: `Drop-in dog classes across Austin, matched to your dog.`
- `Site.tsx` owner `document.title`: `PackPass · Dog classes in Austin, matched to your dog`.
- `apps/web/index.html`: same `<title>`; meta description and og:description: `Drop-in dog training, agility, scent work and reactive-dog classes across Austin. Tell us about your dog and we'll match the right classes. No 6-week commitment.`

### Acceptance

- `npm run typecheck` and `npm run build` pass in `apps/web`.
- Every chip combination in `Match` produces a month at or under 16 credits with no runtime errors (test all 4 energies with 0, 1 and 3 traits).
- A search of `apps/web/src` for the em dash character (U+2014) returns nothing.

## Phase 4: Website, partner page (`apps/web/src/pages/Partners.tsx`)

### Hero

- Eyebrow: `Trainers · Sport clubs · Behavior specialists · Outdoor spaces`
- H1: `Fill the empty spots in your classes.`
- Subhead: `Vetted local dogs, matched to your classes, for the spots you'd otherwise leave empty. You set the rules. We handle booking and pay you every month.`
- `values` cards:
  1. `Users`, `Fill the spots you'd leave empty`, `You choose how many spots open to PackPass per session.`
  2. `ShieldCheck`, `You choose who books`, `Require vaccines and a Social clearance. Every dog arrives with a profile and trainer notes.`
  3. `Banknote`, `Paid monthly, no chasing`, `A set rate per credit, no-shows included, on the 1st.`

### Payouts: open, not gated

Restructure `Earnings()`:

- The "How payouts work" section always renders, never blurred.
- The `Gate` overlay covers only the `#earnings` calculator section.
- Payouts heading: `Found money for spots that earn $0 today.` Add a muted paragraph under it: `$9.50 per credit, so $19 a dog for a typical 2-credit class. No listing fee, no ad spend, and you're paid for no-shows.`
- Example strip: `Example: Saturday Agility Foundations, 2 credits, 3 PackPass dogs` and `2 × 3 × $9.50 = $57`.
- Gate copy: heading `See what your schedule could earn.`, body `Tell us about your business and we'll open the calculator.`, keep fields, button `See my earnings`. The business-type chips stay as they are.

### Calculator

- Label `Dogs per session` becomes `PackPass dogs per session`.
- Default `dogs` 8 becomes 3. Keep range 1 to 16.
- Footnote: `Estimate at $9.50 per credit and 4.33 weeks a month. Actual payouts depend on bookings and attendance. On top of what your direct clients already pay you.`

### New section after the calculator: drop-ins become clients

```
eyebrow: Grow your client list
title:   Today's drop-in. Tomorrow's private client.
body:    Members try your class with zero risk. When their dog needs more, they can book privates
         or courses with you directly. PackPass never restricts it and never takes a cut of your
         direct business.
```

Simple layout: `Heading` plus one paragraph, same width as other section intros. Section id `clients`.

### What you control

- Heading stays `Your space. Your rules.`
- Card order and copy:
  1. `ShieldCheck`, `Who can book`, `Require a Social clearance or a Herding rating. Dogs without it can't book. Add level or age notes members see before booking.`
  2. `Users`, `Capacity` (unchanged)
  3. `Calendar`, `Schedule` (unchanged)
  4. `Coins`, `Credits per session` (unchanged)
  5. `Clock`, `Cancellation window` (unchanged)
  6. `CalendarCheck`, `Bookings run themselves`, `Rosters, waitlists, reminders and dog profiles in one dashboard.`
  7. `UserPlus`, `Your team` (unchanged)
- Why the "Who can book" wording: the booking functions only block on `needs_social`, `needs_herding` and `vaccines`. Level and age are free-text requirements, not enforced. Do not claim they are.

### Getting started

- Heading `Five steps to your first booking.` becomes `Apply in 10 minutes. Go live in about 2 days.` (the list has six items).

### Partner FAQ (`PARTNER_FAQ`, in this order)

1. **What kind of dogs will show up?** (new) `Dogs with a complete profile: vaccine records on file, temperament traits, and notes from past trainers. You can require a Social clearance, and dogs without one can't book.`
2. **Will this undercut my prices?** (new) `No. Members book with credits, not a discount on your rate. Your public prices stay the same, and you only open the spots you want filled.`
3. **Do members become my direct clients?** `Yes, and we hope they do. Anyone can book privates or courses with you directly. PackPass doesn't restrict it.`
4. What does it cost to list? (unchanged)
5. Who sets the credit cost of a session? (unchanged)
6. Can I keep my existing clients? (unchanged)
7. When do I get paid? (unchanged)
8. What happens when a member no-shows? (unchanged)
9. How long does approval take? (unchanged)

### Nav

`Site.tsx` partner links: `Payouts` (#payouts), `Earnings` (#earnings), `Clients` (#clients), `Requirements` (#requirements), `FAQ` (#partner-faq). Partner `document.title`: `Partner with PackPass · Fill your empty spots`.

### Final CTA

Unchanged: `Your next regulars are already nearby.`

### Acceptance

- Payout rate is readable with JavaScript running and no form submitted.
- Submitting the gate still calls `submit_partner_lead` and unlocks the calculator; the unlock persists via the existing `packpass-earnings` localStorage key.
- Default calculator shows $1,482 a month (6 sessions, 3 dogs, 2 credits).

## Phase 5: Member app (`apps/member`)

### Welcome (`src/app/(auth)/welcome.tsx`)

- H1 becomes static two lines: `Make your dog` / `a good hang.` Keep `numberOfLines={1}` per line and the 34px style. Photos keep cross-fading (keep `HERO_WORDS` photo order, drop the words, or rename it `HERO_PHOTOS`).
- Accessibility label: `Make your dog a good hang.`
- Subhead: `Drop-in classes across Austin, picked for your dog's energy and quirks.`
- Tags: `Agility` · `Scent work` · `Reactive-friendly` · `1:1 trainers` · `Open play`.

### Energy labels (`src/data/fixtures.ts`, `src/app/onboarding/play.tsx`, `src/api/live.ts`)

- Store the enum key (`couch` | `medium` | `high` | `working`) in `OnboardingDraft.energy`, not the label. Delete the `ENERGY` label-to-key map in `live.ts` and write the key directly.
- Display labels and notes:

| key | label | note |
| --- | --- | --- |
| couch | Couch potato | Happy with a walk and a nap. |
| medium | Up for anything | One good outing a day. |
| high | Needs a job | Needs a hard session most days. |
| working | Never stops | Bred for a job. Needs work for body and brain. |

- Update every reader of `d.energy` (e.g. `onboarding/month.tsx` line ~143 builds `"a working dog"` / `"high energy dog"` from the label). New sentence: `Five sessions over the next 4 weeks, picked for a dog who ${energyPhrase} and ${socialPhrase}.` with `energyPhrase`: couch `likes a slower pace`, medium `is up for anything`, high `needs a job`, working `never stops`.
- Default draft in `src/store/app.ts` line ~53: `energy: 'working'`.

### Traits (`src/app/onboarding/traits.tsx`, `src/data/fixtures.ts`, `src/api/live.ts`, `src/app/(tabs)/dog.tsx`)

- `TRAIT_GROUPS` becomes generated from the trait catalog, grouped by `grp` with these headings: dogs `Around dogs`, people `Around people`, walks `Out and about`, home `At home`, special `Or`. Chips show `label`, store `id`.
- `TRAIT_SPECIAL` becomes ids `['none', 'not_sure']`.
- `TRAIT_PATHS` in `live.ts` is replaced by `traits.path_id` from the catalog (fallback: `nervous_dogs` and `leash_reactive` to `calm-around-dogs`, `pulls` to `loose-leash-walking`). Dedupe path ids before calling `start_path` so a dog with both `nervous_dogs` and `leash_reactive` starts `calm-around-dogs` once (`start_path` upserts on `(dog_id, path_id)`, so a duplicate call is harmless but wasteful).
- `PLAN_GOALS` keys by path instead of trait: show a goal when any selected trait maps to its path (`calm-around-dogs` covers `nervous_dogs` and `leash_reactive`). The caption shows the first matching trait's owner label. The "Optional add-on · {trait}" caption in `onboarding/month.tsx` shows the owner label.
- Intro lede in `traits.tsx`: `No judgment. Every dog has a thing or two. This helps us point you to the right trainers.`
- Dog tab trait list (`(tabs)/dog.tsx` ~line 210 to 218) renders owner labels via `traitLabel`.
- Default draft traits in `store/app.ts` line ~57: `['pulls', 'nervous_dogs']`.

### Juno's month (`src/app/onboarding/month.tsx`)

- Under each row's class title, replace `${partner} · ${credits} · ${balance}` with `${partner} · ${credits}` and add a second caption line with the discipline payoff in quotes when one exists.
- Header lede stays as built in "Energy labels" above.

### Class detail and booking: drop-off (`src/app/class/[id].tsx`, `src/app/book/[sessionId].tsx`, `src/data/types.ts`)

- Add `dropOff: boolean` to the class type and map it in `live.ts` and fixtures (all fixtures `false`).
- Class detail: near the `suits` block, show a line. `drop_off = false`: `You stay with your dog.` `drop_off = true`: tag `Drop-off` plus `Leave your dog with the trainer. Pick up at the end.`
- Booking sheet: for drop-off classes, add the same tag next to the credit cost so it's seen before confirming.
- Class cards in Book and Today: show a small `Drop-off` tag when true. No tag otherwise.

### Today and Passport

- No copy change to `Juno is due for a hard day.`; it fits the tone.
- `(tabs)/log.tsx`: trainer notes already show. No change.

### Acceptance

- Fresh onboarding in sample mode and live mode writes ids to `dogs.traits` and keys to `dogs.energy`, starts the same paths as before for `pulls` and `nervous_dogs`, and starts `calm-around-dogs` for `leash_reactive`.
- A drop-off class shows the Drop-off tag on its card, detail page and booking sheet; other classes show `You stay with your dog.` on detail.
- An existing dog with a legacy string that has no catalog row renders that string unchanged.
- `npm run typecheck` and lint pass; the live e2e flow passes with the updated expectations.

## Phase 6: Partner dashboard and apply flow (`apps/partner`)

### Apply welcome (`src/apply/Apply.tsx`, `ApplyWelcome`)

Mirror the website partner hero so a trainer who clicks "Apply" sees the same promise:

- Eyebrow: `Trainers · Sport clubs · Behavior specialists · Outdoor spaces`
- H1: `Fill the empty spots in your classes.`
- Subhead: same as Phase 4 hero.
- `values`: same three cards as Phase 4 hero, except card 3 keeps the rate visible: `Banknote`, `$9.50 per credit`, `No-shows included, paid on the 1st. On top of what your direct clients pay you.`

### Apply step 5, payouts

- Section title `Get paid for every booking.` stays.
- Rate box sub-line: `Members spend 1 to 4 credits per session, so a typical 2-credit class pays $19 a dog. Payouts go out on the 1st of each month. Rates are set by PackPass.`

### Roster and assessments (`src/pages/Roster.tsx`, `src/pages/Assessments.tsx`)

- Trait lines render `partner_label` via `traitLabel(id, 'partner')`. Trainers see clinical wording ("Leash reactive"), owners see their own ("Loses it at dogs on walks").
- Roster line ~137: `From owner · ${d.traits.map(t => traitLabel(t, 'partner')).join(' · ')}`.
- Hide the `none` and `not_sure` ids from partner views.

### Class form: drop-off toggle (`src/lib/classForm.ts`, `src/pages/classParts.tsx`, `src/pages/NewClass.tsx`, `src/pages/Classes.tsx`)

- Add `dropOff: boolean` to the form state (default `false`), read it from the class in the form-from-class mapper, and send `drop_off` in the `partner_save_class` payload.
- On the "Who it's for" step, for `type === 'class'` only: a toggle labeled `Drop-off class` with helper text `Owners leave their dog with you for the session. Leave off if owners stay.` Hide it for privates and assessments.
- Review step and the Classes list: show `Drop-off` as a tag when true.

### Class form energy labels (`src/lib/classForm.ts`, `src/pages/Roster.tsx`)

- No change. Partners keep the plain labels (Couch, Medium, High, Working dog). Owner-voice energy labels are member-facing only.

### Acceptance

- A dog with `{pulls, leash_reactive, none}` shows `From owner · Pulls on the leash · Leash reactive (lunges or barks at dogs)` on the roster.
- Saving a class with the toggle on persists `drop_off = true` and the member app shows it on next load.
- Apply welcome and the website partner page show identical H1, subhead and value cards 1 and 2.

## Phase 7: Website prerender and launch CTA

### Prerender (do now)

Fetching the live site returns only the `<head>`; the body is client-rendered. Link previews, many SEO tools and AI search see no copy.

- Add `apps/web/src/entry-server.tsx` that renders `<Site/>` routes with `StaticRouter` from `react-router` via `renderToString`.
- Add a build step: `vite build --ssr src/entry-server.tsx --outDir dist-ssr`, then `scripts/prerender.mjs` renders `/` and `/partners` and injects the HTML into `dist/index.html` and `dist/partners/index.html` (inside `#root`).
- Switch `main.tsx` to `hydrateRoot`.
- Guard anything browser-only: `useCatalog` already falls back; `matchMedia`, `localStorage` and `setInterval` are inside effects or try/catch. Verify `Gate` initial state (`unlockedBefore`) is read in an effect, not during render, to avoid a hydration mismatch.
- Update `vercel.json` rewrites so `/partners` serves `partners/index.html`.
- Acceptance: `curl -s <preview-url>/ | grep "good hang"` and `curl -s <preview-url>/partners | grep "Fill the empty spots"` both match.

### Pre-launch CTA (build now: the app is not in the stores)

Every store button on the owner page is a dead end today. Replace them with a founding-member signup, behind `VITE_APP_LIVE` (default `false`; `true` brings back `StoreButtons` unchanged).

**Primary path, paid (if `VITE_FOUNDING_PACK_URL` is set):** the pivot spec's demand test is a Founding Pack ($79, 6 credits plus 2 bonus in month one) sold through a Stripe Payment Link. The button opens that URL with `?prefilled_email=` when the visitor typed an email.

**Fallback path, free (always available):** a waitlist form.

Data (`supabase/migrations/20261005000300_owner_waitlist.sql`, modeled on `20261002002100_partner_leads.sql`):

```sql
create table public.owner_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  zip text not null,
  energy public.energy_level,
  traits text[] not null default '{}',
  plan public.plan_tier,
  created_at timestamptz not null default now(),
  unique (email)
);
-- RLS on, no direct access. Insert only through the RPC.
create function public.submit_owner_waitlist(p_email text, p_zip text, p_energy text, p_traits text[], p_plan text) ...
```

The RPC upserts on email (re-submitting updates ZIP, energy, traits, plan) and is granted to `anon`.

Website changes (`apps/web`):

- Lift `energy` and `traits` state from `Match` up into `Owners` so the signup form can prefill them. Add `plan` state set by the plan cards' buttons.
- New component `FoundingSignup` in `#get`, replacing `StoreButtons` in the final CTA panel:
  - H2: `Join the founding pack.`
  - Line: `Austin's first members get 2 bonus credits in month one. No 6-week commitment. Pause or cancel anytime.`
  - Fields: `Email`, `ZIP code`, plus a read-only summary chip row of the dog's energy and traits from the matcher (with a `Change` link that scrolls to `#match`).
  - Button: `Claim my founding spot` (paid path) or `Join the waitlist` (free path).
  - Success state: `You're in. We'll email you when booking opens near you.`
  - Validation and error copy: reuse the partner `Gate` patterns (`Enter a valid email.`, `Enter a 5-digit ZIP code.`).
  - Non-Austin ZIPs (outside 786xx and 787xx) still submit; the success line becomes `You're on the list. We'll tell you when PackPass opens near you.`
- Hero: replace `StoreButtons` with a primary button `Join the founding pack` linking to `#get`. Keep `Match my dog` beside it.
- Matcher result CTA: `Book this month in the app` becomes `Save this month` linking to `#get`.
- Plan cards: `Choose Regular` etc. set `plan` and scroll to `#get`.
- Nav button: `Get the app` becomes `Join the founding pack`.
- Final CTA H2 from Phase 3 (`Book your dog's first class this week.`) is used only when `VITE_APP_LIVE=true`.

Acceptance:

- With `VITE_APP_LIVE` unset, no store button renders anywhere on the site.
- Submitting the form writes one `owner_waitlist` row with the matcher's energy and trait ids and the chosen plan; submitting again with the same email updates that row.
- With `VITE_FOUNDING_PACK_URL` set, the button opens the Payment Link and still records the waitlist row first.

## Also fix

- `project/uploads/PackPass Pivot Design Spec.md` says Working Dog fits "3 to 4 times a week". 16 credits buys about 8 two-credit classes, so "about twice a week" (the site's wording) is correct. Update the spec.

## Decisions (Oct 5, 2026)

1. Web hero ships `static` (`Make your dog a good hang.`).
2. `leash_reactive` starts the `calm-around-dogs` path.
3. The app is not in the stores yet. Phase 7 pre-launch CTA is in scope; `VITE_APP_LIVE` defaults to `false`.
4. Owners stay with their dog except in drop-off classes. Adds the `drop_off` flag (Phases 1, 5, 6) and the owner FAQ answer (Phase 3).
5. Confirmed: PackPass takes no cut of a partner's direct business. The Phase 4 clients section ships as written.

Still open: whether to sell the Founding Pack through a Stripe Payment Link now (set `VITE_FOUNDING_PACK_URL`) or run the free waitlist first. The code supports both.
