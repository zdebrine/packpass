# Multiple dogs per member

Owners can keep every dog in one PackPass account: add a dog from the Dog tab, switch between dogs, and book,
hold, waitlist and track each dog on its own records. Credits stay with the account.

## 1. What the audit found

**Database: already one-to-many.** `dogs.owner_id` has no uniqueness, and every per-dog table (`vaccinations`,
`clearances`, `dog_paths`, `dog_path_steps`, `assessments`, `held_spots`, `waitlist`, `vet_record_reviews`)
hangs off `dog_id`. Every member RPC takes the dog (`book_session(p_dog)`, `hold_sessions`, `join_waitlist`,
`my_paths(p_dog)`, …) and checks `owner_id = auth.uid()`. RLS (`owns_dog`) and Storage (`<member>/<dog>/…`)
are per dog. `bookings_one_live` is unique on `(session_id, dog_id)`, so two dogs can share a session and each
takes a spot. The partner dashboard lists bookings, so two dogs from one owner show as two roster rows.

**One gap on the server: notification links.** Notifications that open a dog's screen don't say which dog:

| Function | Link today |
| --- | --- |
| `record_assessment` (clearance earned, held spots released) | `/clearance-earned`, `/goal/calm-around-dogs` |
| `partner_record_result` (assessment "not yet") | `/passport/<type>` |
| `advance_paths` (path step done) | `/goal/<path>` |
| `admin_decide_vet_record` (records approved / denied) | `/vaccines`, `/onboarding/records-denied` |
| `rewind_paths` matches the path-step notification by its link | `/goal/<path>` |

**The member app is where "one dog" lives.** The store keeps one set of per-dog fields for "the main dog"
(`dogs[0]`): `vaccines`, `vaccineRecord`, `social`, `socialExpired`, `socialClearanceId`, `herdingAt`,
`activePaths`, `clearanceRecords`, `paths`, `pendingPlan` (holds). `live.loadMember()` filters every per-dog
query to `dogs[0]` and throws the other dogs' rows away. Consequences:

- The booking sheet's dog picker (in the designs) books the second dog against the first dog's vaccines and
  clearances, so the app can offer a booking the server then refuses, or hide one it would allow.
- The Dog tab's switcher only says "Otis has no Passport yet".
- `saveVaccines` always writes to `dogs[0]`.
- Records Denied, Clearance earned, Passport, goals, Log, the Athlete Card stats and Today's held month only
  ever show the first dog. `useUnseenRecordDenial` only watches the first dog.
- Missed class shows the first dog's name whichever dog missed.
- There is no way to add a dog after onboarding (01e even says "You can add more dogs later").
- Sample mode has Otis in `dogs`, but no records for him.

Untouched by this change: credits and plans (`profiles`), Stripe, the website, the partner dashboard, and
the area ("Trains near"), which stays an account setting read from the first dog.

## 2. Decisions (defaults picked, flag any you want changed)

1. **Pricing stays per account.** Credits live on the profile and are shared by all the owner's dogs; each
   dog's booking costs the class's credits. Nothing in the code or the pivot spec prices per dog, so there is
   no per-dog fee or plan. A second dog doesn't get its own sign-up credits.
2. **One active dog.** The app is about one dog at a time, as now. The Dog tab's switcher (already in the
   designs) picks it; Today, Log, Passport, goals, vaccines and Book follow it. The choice is remembered on
   the device. The booking sheet keeps its own dog picker (also in the designs) and checks the rules for the
   dog picked there.
3. **Adding a dog reuses onboarding 01e to 01j** (photo, details, play style, traits, Athlete Card, the
   dog's month), started from an "Add a dog" chip at the end of the Dog tab's switcher. Owner name, email
   and area are kept. Back out on step 1 and nothing is saved. The new dog becomes the active dog.
4. **Up next on Today shows the soonest booking for any dog**, with the dog's name when there are two or
   more, so a second dog's class isn't hidden. Everything else on Today is the active dog's.
5. **Each dog's held month shows on Today** (one card per dog with holds), since holds release on their own.
6. **No limit on dogs per account**, and removing a dog isn't in this change (the account's Delete account
   still removes all of them).

## 3. Changes

### Database: `supabase/migrations/20261011000100_multi_dog.sql`

- `dog_href(path, dog)` gives `<path>?dog=<dog id>`.
- `record_assessment`, `partner_record_result`, `advance_paths` and `admin_decide_vet_record` are redefined
  as they are now, with links built by `dog_href`.
- `rewind_paths` takes back a path-step notification whether its link has the dog or not (notifications
  sent before this migration don't).
- No data changes. Old notifications keep their links; the app opens them for the active dog, as today.

### Member app

- **Store (`src/store/app.ts`).** `activeDogId`, and `dogRecords`: each dog's records (`DogRecord`: Social
  stage and expiry, clearance id and rows, Herding partners, active paths, vaccines, vet record, holds). The
  existing flat fields stay as the active dog's working copy, so screens keep reading `s.vaccines` and the
  like. `selectDog(id)` saves the working copy back and loads the other dog's (and its training paths in live
  mode). `startAddDog()` / `cancelAddDog()` / `addingDog` drive the add-a-dog flow; `finishOnboarding()`
  creates the dog, saves its photo, vaccines and record, and selects it. `ruleContextFor(state, dogId)` and
  `useRulesFor(dogId)` give any dog's booking rules; booking, holds and waitlist in sample mode use the
  booked dog's rules. `useDog()` returns the active dog. `useUnseenRecordDenial()` checks every dog.
  Persisted state goes to v6: the active dog is the first dog, and the old single "seen denial" becomes a
  list.
- **Live API (`src/api/live.ts`).** `loadMember()` returns `records` for every dog instead of dropping all
  but the first.
- **Routing (`src/app/_layout.tsx`).** A `dog` search param (from a notification link) selects that dog.
- **Screens.** Dog tab: the switcher switches, plus "Add a dog". Booking sheet: starts on the active dog (or
  `?dog=`), rules follow the picked dog. Today: Up next across dogs with the dog's name, a held-month card
  per dog. Missed class: the dog that missed. Clearance, goals and stats use the active dog's Log entries
  only. 01e to 01j: "Add a dog" copy, step 1 can back out, 01j counts what the account has left in credits.
- **Sample mode.** Otis gets his own records (Social cleared, vaccines current) so switching to him shows a
  real Passport; a sample dog added in the app starts with no records.

## 4. Migrating existing single-dog accounts

Nothing to move: every account already stores its dog the way a multi-dog account does.

- **Server:** the migration only replaces functions; it runs in one transaction and changes no rows.
- **Phones:** on first launch after the update, the persisted store migrates v5 to v6: the active dog is
  the account's first (oldest) dog, which is the dog the app already showed, and a denied record that was
  already seen stays seen. Live mode reloads all records from the server on launch anyway.
- **Behaviour for one-dog accounts is unchanged**: the switcher shows one dog plus "Add a dog", and
  notification links with `?dog=` select the dog that's already active.

Rollout: apply the migration (SQL editor or MCP, as with the others), then ship the app. Old app builds
ignore the `?dog=` part of a link, so the order doesn't matter.

## 5. Tests

- `supabase/tests/multi_dog.test.sql`: one owner, two dogs. Each dog's own clearances and vaccines decide
  what it can book; both dogs can book the same session (two spots, credits charged twice from the shared
  balance); cancelling one leaves the other; holds and the waitlist are per dog; another member can't book
  or hold with these dogs; every dog-screen notification link names the right dog; undoing a check-in still
  takes back the path-step notification, with or without the dog in the link.
- `apps/member/e2e/live/member-flow.ts`: adds a second dog through the store (`startAddDog` →
  `finishOnboarding`) with its own vaccines, record and photo, checks the first dog's records are untouched,
  switches between them, and books the second dog against its own rules.
- `e2e/tests/member.spec.ts`: adds a dog from the Dog tab's switcher and switches back.
