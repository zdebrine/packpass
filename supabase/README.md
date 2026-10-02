# PackPass Supabase

Schema, security rules and booking logic for the member app. Nothing here is deployed yet: it runs on a
local Supabase stack, and the same migrations can be pushed to a hosted project when one is created.

## Contents

- `migrations/…_schema.sql` — tables and enums from the data model in `docs/TECH_SPEC.md` §5, plus the
  sign-up trigger that gives each new member a profile on Regular with 10 credits.
- `migrations/…_rls_and_storage.sql` — row level security (members only see their own rows; the catalog is
  read-only; credits, bookings and clearances can't be written directly) and the `dog-photos` and
  `vaccine-docs` storage buckets, scoped to `<user id>/…` folders.
- `migrations/…_booking_functions.sql` — the rules, as functions the app calls with `supabase.rpc()`:
  - `book_session`, `book_sessions` (01j "Book these"), `cancel_booking` (free until 12 hours before),
    `check_in` (partner QR or 4-digit code, from an hour before the start), `see_clearance`,
    `mark_notifications_read`, `start_path`.
  - `booking_block` explains why a dog can't book: `needs_social` (group classes need a Social clearance,
    except sessions on the dog's own training path), `needs_herding` (Herding is assessed per partner),
    `vaccines` (Rabies, DHPP and Bordetella current on the day), `started`.
  - Service role only: `record_assessment` (partner dashboard; a pass grants the clearance, completes the
    path and notifies the owner) and `grant_monthly_credits` (run daily with pg_cron; rollover capped at one
    month of credits).
- `seed.sql` — generated from the app's sample data (`npm run gen:seed` in `apps/member`): 5 partners,
  17 classes, 2 training paths and 4 weeks of sessions. `select public.seed_demo_member('<user id>')` gives a
  signed-up account Juno's Passport as the designs show it.

## Run it locally

```bash
supabase start                 # needs Docker; applies migrations and seed.sql
cp apps/member/.env.example apps/member/.env.local   # paste the API URL and anon key it prints
cd apps/member && npx expo start
```

Sign-up sends a 6-digit code (Inbucket at http://127.0.0.1:54324 shows the email locally).

## Tests

- `supabase/tests/run-local.sh` — applies everything to a scratch database on plain Postgres (with a small
  shim for `auth` and `storage`) and runs `booking.test.sql`: 42 checks covering each rule, credits, RLS and
  storage policies. `PGHOST=… PGPORT=… PGUSER=postgres supabase/tests/run-local.sh`
- `apps/member/e2e/live/run.sh` — runs the app's real store and API code against the same database through
  PostgREST, with a stand-in for Supabase Auth: 24 checks from sign-up to sign-in again.

## Deploying

When a hosted project exists: `supabase link --project-ref <ref>` then `supabase db push`. Don't run
`seed.sql` against production; load real partners and schedules from the partner dashboard instead.
