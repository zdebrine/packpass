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
- `migrations/…_held_spots.sql` — holds for the rest of a starting month (01j) while a dog waits on its
  Social assessment: `hold_sessions` reserves spots without charging credits (every rule but Social still
  applies), `book_held` books them once the dog is cleared, `release_holds` gives them back. Holds release
  24 hours before the session (`release_expired_holds`, run every 15 minutes by pg_cron) and when the
  assessment comes back "not yet".
- `migrations/…_hold_reminders_and_push.sql` — `remind_expiring_holds` (run hourly by pg_cron) notifies a
  member once when a dog's holds are within a day of releasing, and `push_tokens` with
  `register_push_token` links a phone's Expo push token to the signed-in member (a device moves to whoever
  signs in on it; members can only read and delete their own).
- `functions/send-push` — Edge Function that sends `hold_expiring`, `holds_released` and `clearance_earned`
  notifications to the member's phones through the Expo push API, and forgets devices Expo reports as gone.
  The logic is in `push.ts`, tested with `node --test supabase/functions/send-push/push.test.ts`.
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
  shim for `auth` and `storage`) and runs `booking.test.sql`: 71 checks covering each rule, credits, holds and reminders,
  RLS and storage policies. `PGHOST=… PGPORT=… PGUSER=postgres supabase/tests/run-local.sh`
- `apps/member/e2e/live/run.sh` — runs the app's real store and API code against the same database through
  PostgREST, with a stand-in for Supabase Auth: 35 checks from sign-up to sign-in again.

## Deploying

When a hosted project exists: `supabase link --project-ref <ref>` then `supabase db push`. Don't run
`seed.sql` against production; load real partners and schedules from the partner dashboard instead.

Then switch on the scheduled jobs and push:

```sql
select cron.schedule('holds', '*/15 * * * *', 'select public.release_expired_holds()');
select cron.schedule('hold-reminders', '0 * * * *', 'select public.remind_expiring_holds()');
select cron.schedule('credits', '5 0 * * *', 'select public.grant_monthly_credits()');
```

1. `supabase secrets set PUSH_WEBHOOK_SECRET=<random>` (and `EXPO_ACCESS_TOKEN` if Expo push security is on),
   then `supabase functions deploy send-push --no-verify-jwt`.
2. Dashboard › Database › Webhooks: on INSERT into `public.notifications`, POST to the `send-push` function
   URL with the header `x-webhook-secret: <the same secret>`.
3. In `apps/member`, run `eas init` (writes the project id the app needs for push tokens) and build with
   `eas build --profile development`. Expo Go and the web app don't receive remote pushes; reminders still
   appear in the app's notifications there.
