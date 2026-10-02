# PackPass Supabase

Schema, security rules and booking logic for the member app. It's deployed to the hosted project
**packpass** (EarlyBird Labs org, us-east-1, ref `qovbpxvpnslsjzunxutk`), which the app uses by default
(`apps/member/.env`), and it runs the same on a local stack for development and tests.

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
- `migrations/…_waitlist.sql` — `join_waitlist`, `leave_waitlist` and `my_waitlist` (place in line). When a
  session gets a spot back, a trigger books the first dog in line (`book_as`, the body of `book_session` for a
  given member) until 12 hours before the start, skipping and telling anyone who can't book any more; inside 12
  hours it tells everyone waiting instead.
- `templates/` — the sign-up and password-reset emails, sending the 6-digit code the app asks for.
- `functions/send-push` — Edge Function that sends `hold_expiring`, `holds_released` and `clearance_earned`
  notifications to the member's phones through the Expo push API, and forgets devices Expo reports as gone.
  The logic is in `push.ts`, tested with `node --test supabase/functions/send-push/push.test.ts`.
- `migrations/…_timetable_and_jobs.sql` — `timetable` (each class's weekly slots) and `extend_schedule`, which
  keeps four weeks of sessions bookable; pg_cron runs it daily with the holds, reminders and monthly-credit jobs.
- `migrations/…_hardening.sql` — fixes from the Supabase advisors: internal functions aren't callable over the
  API, policies evaluate `auth.uid()` once per query, and foreign keys have indexes.
- `migrations/…_push_webhook.sql` — a trigger calls `send-push` (through pg_net) for each notification worth
  pushing, to members with a registered phone. The function URL and a shared secret live in Vault.
- `migrations/…_partner_dashboard.sql` — what `apps/partner` runs on. `partner_staff` ties an account to a
  partner (and, for trainers, their trainer profile); PackPass links accounts with `link_partner_staff` (service
  role only). Every `partner_*` function checks the caller is staff and only touches that partner's classes,
  sessions and the dogs booked into them: the week's sessions, rosters and manual check-in, capacity and
  waitlist switches, adding and cancelling sessions, blocking dates (bookings refunded and owners told),
  session notes, assessment results, checking vaccine records, saving classes (new ones wait in review for
  PackPass to set the credits; changing length, intensity, group size or type on a live class flags a credit
  review), trainer profiles, arrival notes, and earnings at the partner's rate per credit. Staff can open the
  photos and vet records of dogs booked with them. Members no longer see cancelled sessions or classes in review.
- `migrations/…_member_log.sql` — `my_log` for the member app's Log: the dogs' sessions that have run, with the
  trainer's note and any assessment result (strengths, working on, the assessor's words).
- `catalog.sql` — generated: partners, trainers, classes, training paths and the timetable. Loaded into the
  hosted project. Partners now edit their own classes and schedule from the dashboard; new partners and
  trainers are still added here (or in the SQL editor).
- `seed.sql` — local only, generated from the app's sample data (`npm run gen:seed` in `apps/member`): 5 partners,
  17 classes, 2 training paths and 4 weeks of sessions. `select public.seed_demo_member('<user id>')` gives a
  signed-up account Juno's Passport as the designs show it.

## Run it locally

```bash
supabase start                 # needs Docker; applies migrations and seed.sql
cp apps/member/.env.example apps/member/.env.local   # paste the API URL and anon key it prints
cd apps/member && npx expo start
```

Sign-up and password reset send a 6-digit code (Inbucket at http://127.0.0.1:54324 shows the email locally).
To point the app at the local stack, put its URL and publishable key in `apps/member/.env.local`, then start
Expo with `--clear` (Metro caches env values).

## Tests

- `supabase/tests/run-local.sh` — applies everything to a scratch database on plain Postgres (with a small
  shim for `auth` and `storage`) and runs `booking.test.sql` (100 checks: each rule, credits, holds, reminders,
  the waitlist, RLS and storage policies) and `partner.test.sql` (60 checks: staff access, one partner never
  reaching another's data, and each dashboard function). `PGHOST=… PGPORT=… PGUSER=postgres supabase/tests/run-local.sh`
- `apps/member/e2e/live/run.sh` — runs the app's real store and API code against the same database through
  PostgREST, with a stand-in for Supabase Auth and Storage: 59 checks, from sign-up with a dog photo and vet record to a password reset and sign-in again.

## The hosted project

Set up on Oct 2 2026 through the Supabase MCP tools:

- Every migration in `migrations/` is applied. The hosted history records them by name with the time they were
  applied, and the waitlist migration as two parts (`waitlist`, `waitlist_fill`). Before using the CLI there
  (`supabase link --project-ref qovbpxvpnslsjzunxutk`), run `supabase migration repair` so the history matches
  the files. New migrations: apply them the same way, or with `supabase db push` once repaired.
- `member_log` is applied too.
- The partner dashboard migration went on as two parts (`partner_dashboard`, then `partner_set_repeat`). A
  staff journey (sessions, classes, earnings, a new class in review that can't be scheduled yet) was run inside
  the database and rolled back.
- `catalog.sql` is loaded and `select public.extend_schedule()` made the first four weeks of sessions. `seed.sql`
  is not loaded (it's sample spot counts and a demo helper).
- pg_cron jobs: `release-expired-holds` (every 15 min), `hold-reminders` (hourly), `monthly-credits` and
  `extend-schedule` (daily, 06:05 and 06:10 UTC).
- `send-push` is deployed (JWT check off; the trigger's shared secret is checked instead). Vault holds
  `push_function_url` and `push_webhook_secret`. Checked with a call from the database: the right secret gets
  200, a wrong one 403.
- A member journey was run inside the database and rolled back (sign-up, 10 credits, path booking, the Social
  gate, a hold, a cancel and refund, check-in codes hidden), and the advisors are clean apart from the member
  API functions, which check the caller themselves.

### Still to do in the dashboard

1. **Auth › Email Templates:** paste `templates/confirmation.html` into "Confirm signup" and
   `templates/recovery.html` into "Reset password". The defaults send a link; the app asks for a 6-digit code.
2. **Auth › Providers › Email:** check the email OTP length is 6.
3. **Email through Resend.** Supabase's built-in email only reaches members of the EarlyBird Labs team and a few
   messages an hour, so other people can't finish signing up without this.
   1. In Resend, add and verify the sending domain (Domains › Add domain, then the DNS records it lists).
   2. Easiest: Resend › Integrations › Supabase, pick the `packpass` project and the sender
      (for example `PackPass <hello@your-domain>`). It fills in Supabase's SMTP settings for you.
   3. Or by hand, in Supabase › Authentication › Emails › SMTP Settings: host `smtp.resend.com`, port `465`,
      username `resend`, password a Resend API key with sending access, sender name `PackPass`, sender email on
      the verified domain.
   4. Under Authentication › Rate Limits, raise the email limit from the default (it's set low for the built-in
      sender), for example to 100 an hour.
4. **Partner accounts:** have the partner sign up in the member app (or Auth › Users › Add user), then in the
   SQL editor: `select public.link_partner_staff('owner@their-email', 'ridgeline', 'owner', 'maren');`
   (role `owner` or `trainer`; the last argument is their trainer profile, or null).
5. **Auth › Attack Protection:** turn on leaked password protection (the advisors flag it).
6. **Push:** in `apps/member`, run `eas init` (adds the project id push tokens need) and
   `eas build --profile development`. Expo Go and the web app don't receive remote pushes; reminders still
   show in the app's notifications there. If Expo push security is on, add `EXPO_ACCESS_TOKEN` as a function
   secret.
