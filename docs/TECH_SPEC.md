# PackPass member app: tech spec

Source of truth for the UI: `project/Pack Member App.dc.html` (24 screens) and the Pack Athletic Club v2 design system in `project/_ds/…`. Product rules come from `project/uploads/pack-athletic-club-spec.md` and the newer `PackPass Pivot Design Spec.md`. Where the two specs disagree, the pivot spec wins (monthly plans, no grooming, clearance enum = social, herding).

## 1. Recommendation: one Expo codebase for iOS, Android and web

| Option | Native apps | Web | Code shared | Verdict |
| --- | --- | --- | --- | --- |
| **Expo (React Native) + Expo Router + react-native-web** | Yes, App Store and Play | Yes, static export or server output from the same routes | ~95% | **Recommended** |
| Next.js web + separate Expo app (monorepo, shared logic) | Yes | Best SEO and SSR | Logic only, UI twice | Twice the UI work. Only worth it if the member app needs SEO, which it doesn't; the marketing site already exists as its own design |
| PWA only (Next.js or Vite) | No store presence, weak push on iOS, no native camera feel | Yes | 100% | Fails "standalone mobile app" |
| Capacitor wrapping a web app | Yes, as a webview | Yes | 100% | Webview scroll, sheets and blur feel off next to this photo-heavy, motion-led design |

Why Expo fits this design specifically:
- The original spec already chose Expo + Supabase + Stripe, so the backend plan carries over unchanged.
- Expo Router gives file-based routes that are also real URLs on web (`/class/herding-fundamentals`, `/passport/social`), so links shared from the app open on the web.
- Every native need in the design has an Expo module that also runs on web: `expo-blur` (glass capsules), `expo-linear-gradient` (scrims), `expo-image` (photo-first screens), `expo-camera` (QR check-in), `expo-haptics`, `expo-notifications`, `react-native-reanimated` (word cycle, card flip, clearance celebration).

### Web layout
The designs are 390pt phone screens. On web, v1 renders the same mobile layout in a centered column (max 480px) on a neutral ground, which is how ClassPass and Life Time ship their web booking flows. A responsive desktop layout needs its own design pass and is out of scope for v1.

## 2. Stack

| Concern | Choice |
| --- | --- |
| App framework | Expo SDK 54, React Native 0.81, React 19, TypeScript strict |
| Routing | Expo Router v6 (typed routes), tabs plus stack plus form-sheet modals |
| Styling | `StyleSheet` with a typed theme object generated from the design tokens (light and dark). No CSS-in-JS runtime. |
| Fonts | Geist (`@expo-google-fonts/geist`) and Archivo **static instances generated from the variable font** at width 112 / weight 800 (display) and width 125 / weight 600 and 700 (wide caps). React Native can't set `font-variation-settings`, so the widths are baked into separate font files. |
| Icons | `lucide-react-native` (the same Lucide set the design uses, 2px stroke) on `react-native-svg` |
| Images | `expo-image` with blurhash placeholders |
| Glass, scrims | `expo-blur` (`BlurView`, intensity matched to 20px blur), `expo-linear-gradient` |
| Motion | `react-native-reanimated` 4: word cycle (3.4s, 800ms slide), photo crossfade (1100ms), card flip (520ms), clearance ring draw and badge pop, press scale 0.97 at 140ms |
| Sheets | Expo Router `presentation: 'formSheet'` on native; a custom bottom sheet on web |
| State | One Zustand store (`src/store/app.ts`). Sample mode persists it with AsyncStorage / localStorage; live mode loads it from Supabase (`src/api/live.ts`) and refreshes after every write. Screens read the catalog from `src/data/catalog.ts`, which live mode replaces with database rows. |
| Forms | Controlled inputs plus `zod` validation (email, 8-character password, 6-digit code) |
| Backend (phase 2) | Supabase: Postgres, Auth (email OTP, Apple, Google), Storage (dog photos, vaccine docs), RLS, Edge Functions |
| Payments (phase 2) | Stripe Billing for plans, Stripe Payment Sheet for credit packs. Dog classes are real-world services, so App Store in-app purchase rules don't apply; Stripe is allowed on iOS. |
| Maps (phase 2) | `react-native-maps` on native plus a Mapbox GL web component, behind one `<Map>` wrapper. v1 redraws the design's map placeholder. |
| Push | Expo Push through `expo-notifications`. Built: hold reminders, released holds, new clearances, waitlist bookings and openings (`supabase/functions/send-push`). Later: booking reminders, session notes |
| QR check-in | `expo-camera` barcode scanning on iOS and Android, and on web where the browser supports camera scanning (HTTPS only). Fallback: a 4-digit code entry, which the design already has as "Enter code instead". |
| Analytics (phase 2) | PostHog (onboarding completion, first booking, monthly active dogs) |
| Quality | `tsc --noEmit` (strict) in v1. Planned: ESLint (`expo lint`), Jest for `src/lib`, Playwright against the web build. |
| Delivery | EAS Build and Submit for stores, EAS Update for OTA fixes, `expo export -p web` to Vercel |

## 3. Repo layout

```
apps/member/                  Expo app (iOS, Android, web)
  src/app/                    Expo Router routes
    (auth)/welcome.tsx        01a
    (auth)/sign-up.tsx        01b
    (auth)/sign-in.tsx        01c
    (auth)/verify.tsx         01d
    onboarding/dog.tsx        01e  Step 1 of 5    (/onboarding/…, so it can't collide with the Dog tab)
    onboarding/details.tsx    01f  Step 2
    onboarding/play.tsx       01g  Step 3
    onboarding/traits.tsx     01h  Step 4 (also the Passport's "Edit traits", ?edit=1)
    onboarding/reveal.tsx     01i  Step 5, Athlete Card reveal
    onboarding/month.tsx      01j  Juno's month
    (tabs)/index.tsx          02 Today
    (tabs)/book.tsx           03 Book list + 04 map (toggle)
    (tabs)/log.tsx            07 Log
    (tabs)/dog.tsx            08 Dog profile / Passport
    class/[id].tsx            05 Class detail (id = session id, e.g. herding-fundamentals.2.0730)
    book/[sessionId].tsx      06 Booking sheet
    passport/[type].tsx       09 Clearance detail (social | herding)
    goal/[id].tsx             10 Goal detail
    assessment/[id].tsx       11 Assessment result
    notifications.tsx         12
    clearance-earned.tsx      13 (full-screen modal)
    check-in/scan.tsx         14 (full-screen modal)
    check-in/done.tsx         15
    settings.tsx              Appearance + "Preview states" (the design file's Tweaks panel)
  src/theme/                  tokens.ts (from colors/typography/spacing.css), ThemeProvider, ThemeScope
  src/ds/                     Text, Icon, Press, Glass/Photo/Gradient, Button/Chip/Tag/Pill, ClassCard, AthleteCard, layout pieces
  src/features/               onboarding parts, book ClassRow, passport styles, MapSketch, QrArt
  src/data/                   types.ts, fixtures.ts (Juno, Otis, partners, classes, a 7-day schedule), passport.ts (derived state)
  src/lib/                    booking.ts (eligibility, lookups), dates.ts (fixed clock, cancel window), directions, notice
  src/store/app.ts            Zustand store: draft, credits, bookings, Social stage, read notifications, preview toggles
  assets/fonts                Archivo static instances (generated, see §2), assets/photos
docs/TECH_SPEC.md
project/                      Claude Design export (reference only, not shipped)
```

`apps/web` is the public website (owners and partner pages, see `apps/web/README.md`). `apps/partner` is the partner dashboard (desktop web): a Vite + React app on the same Supabase project, using the design system's CSS directly rather than the React Native port. See `apps/partner/README.md`. Shared `packages/` (types, API client) can come later if the two apps start duplicating more than the colour and type tokens.

## 4. Design system port

| DS piece | Port |
| --- | --- |
| Tokens (`colors.css` light and dark, type scale, radii 12/20/28/32/pill, spacing, motion) | `src/theme/tokens.ts`, one typed object per theme. Screens set `theme="dark"` locally like the design's `data-theme` (onboarding, 13, 14, 15 are dark). |
| `.pk-display-*`, `.pk-wide`, `.pk-title/heading/body/label/caption` | `<Text variant="displayXl" />` etc. Wide caps uppercase the source string at render time. |
| Button (primary, signal, quiet, glass · md 52 / sm 40 · wide · block) | `Pressable` with Reanimated press scale 0.97, hover opacity 0.88 on web, disabled 40% |
| Chip (selected, glass) | `Pressable`, 38 tall, pill |
| Tag (neutral, premium, signal, warning, glass) | View + wide-caps text, 24 tall |
| ClassCard (tile 260×320, row with 88 thumb and credits) | Same props: `image, discipline, premium, title, partner, place, time, duration, credits, spotsLeft`, including "Full. Waitlist open" / "Last spot" copy |
| AthleteCard (full 320×460 with glass stats; compact) | Same props; `shadow-card` on iOS and web, `elevation` on Android |
| PhotoTile | Ported for completeness; not used by the 24 screens |

Rules kept from the DS guide: agility yellow at most twice per screen, no borders except the tab bar hairline, text on photos only over a scrim, glass only over photos.

## 5. Data model (client types, matching the Supabase schema to come)

Taken from the original spec plus the pivot changes:

- `Member` (name, email, plan: starter 6, regular 10, working 16, creditsBalance, creditsResetAt)
- `Dog` (name, photo, sex, breed, mixed, birthday, weightLb, fixed, energy: couch, medium, high, working, sociability: loves, selective, solo, interests[], traits[], area)
- `Vaccination` (type, expiresAt, status: current, dueSoon, expired)
- `Partner` (type: trainer, facility, sport_club, behavior_specialist, outdoor_space; address, distance, rating)
- `Trainer`, `ClassType` (discipline, category: sport, scent, play, skills; balanceCategory: physical, mental, social; sessionType: class, private, assessment; requiresClearance; grantsClearance)
- `Session` (startsAt, durationMin, capacity, spotsLeft, creditCost, packpassSpots)
- `Booking` (status: booked, waitlisted, checked_in, cancelled, no_show; creditsCharged)
- `Clearance` (type: social, herding; scope: network or partner; status: cleared, expired, working, needs; issuedBy, assessedAt, expiresAt, notes)
- `Goal` / `PathStep` (training paths such as "Calm around dogs", 4 steps, final step grants Social)
- `Assessment` (outcome cleared / not yet, strengths[], workingOn[], quote)
- `SessionNote`, `Milestone`, `Notification` (category: clearances, bookings, notes; unread)
- `MonthlyPlan` (replaces the pivot spec's `weekly_plans`: dogId, month, suggested and booked sessions, balance counts)

Business rules in `src/lib`, unit tested:
- Booking needs current vaccines and any clearance the class requires; otherwise the class shows "Needs assessment" and the CTA becomes "Book assessment".
- Free cancel until 12 hours before. Copy: "Free cancellation until Wednesday 7:30 pm".
- Credits reset on the 1st; booking shows "5 of 10 left after booking"; too few credits shows "You have 1 credit left" with "Buy more credits" and "Pick a 1-credit class".
- Monthly plan suggestions never exceed remaining credits (01j: 8 of 10 on Regular, "2 credits left for anything").
- "Fits Juno" filter hides group sessions that the dog's sociability or traits rule out.

## 6. Screen notes that affect implementation

- **01a** cycles six endings ("an athlete." … "a scent detective.") every 3.4s with an 800ms slide-in and a 1100ms photo crossfade (sprint, leap, hurdle, tunnel, weave, grass).
- **01d** is a six-box code input backed by one hidden `TextInput` (paste and SMS autofill work).
- **01i** animates the Athlete Card in (1100ms rise, rotateX 24°, scale 0.9 to 1).
- **02 Today** has a 440 hero with a sheet overlapping by 28px with 32px top corners, plus a bell with an unread dot that opens 12.
- **03/04** are one route with a List/Map segmented toggle; the Sport, Scent, Play, Skills segment and the type filters actually filter.
- **05 / 06**: the CTA keeps its name through the flow: "Book for 2 credits", then "Confirm booking", then "Booked."
- **08** card flips on tap (rotateY, 520ms) to the discipline levels on pitch green.
- **13** draws the agility ring (stroke-dashoffset 415 to 0, 900ms), pops the badge, pulses two rings, then staggers the headline. It plays once on arrival, and the share button uses the native share sheet.
- **14** uses the live camera on device; on web or with no permission, it shows the design's blurred still with the code entry.
- Status bar: the real device status bar replaces the drawn "9:41" bar (light content on photo and dark screens).

## 7. Phasing

1. **v1 (done):** the Expo app with all 24 screens on sample data, running on iOS, Android and web.
2. **v2 (done, hosted on Supabase `packpass`):** Supabase schema, row level security, storage buckets and booking functions in
   `supabase/`, tested on Postgres (100 SQL checks) and end to end through PostgREST (57 checks). The app runs
   against it when `EXPO_PUBLIC_SUPABASE_*` is set: email sign-up with the 6-digit code, sign-in, the dog
   created from onboarding, vaccines, booking, plan booking, cancelling, check-in, the clearance flow and
   notifications, hold reminders, push registration, the waitlist, password reset and dog photos. The app uses the hosted project by default; see `supabase/README.md` for how it
   was set up and the dashboard steps left (code email templates, SMTP).
3. **v3:** the partner dashboard (done: schedules, rosters and check-in, vet records, notes, assessment
   results, classes, earnings, owners managing their own team, partner applications and their review; payouts wait on Stripe Connect). Still to come: Apple and Google sign-in, Stripe
   plans, credit packs and partner payouts, push delivery switched on (EAS project, dev build), a real map,
   and PostHog. The member app's Log now shows real sessions, partner notes and assessment results.

## 8. Decisions and known gaps

Decided with the product owner: Expo universal app; centered phone layout on web; the starting month leads
with a Social assessment for dogs without one; cancelling lives on the booking detail screen; Juno's Social clearance
shows "Working on it" until the member opens the Clearance earned screen (13), then "Cleared"; group classes
need Social except sessions on the dog's own training path; "Book these" books real sessions; held spots
release 24 hours before the session, and members are reminded a day before that; Supabase is the hosted `packpass` project (us-east-1).

- **Sample timeline.** Sample mode's clock is fixed at Tue Sep 29 2026, 9:41 am. Juno starts at step 2 of Calm
  around dogs. Settings › Preview states › "Pass re-check" stands in for the partner recording the re-check.
- **Starting month for dogs without Social.** 01j leads with a Social assessment (week 1), plus a solo
  session. Both book with "Book these". Group sessions later in the month show "Opens after the assessment"
  and are held on the server (`held_spots`): each hold reserves the spot without charging credits, follows
  the member to any device, and releases itself 24 hours before the session or when the assessment comes back
  "not yet". Once the dog is cleared, Today's "Rest of Juno's month" card books them in one tap (credits are
  charged then), or "Let these spots go" releases them. Rows blocked for another reason (vaccines, full) are reported, not held. Dogs that already have Social
  get the month from the design.
- **Hold reminders.** `remind_expiring_holds` (hourly, pg_cron) sends one notification per dog when its holds
  are within a day of releasing, so 48 hours before the first session: "Book Juno's held sessions" if the dog
  is cleared, otherwise that the spots are going back and why. Today's card shows the same thing. On phones,
  the month screen asks for notification permission right after holding spots (the moment it clearly helps),
  and the device re-links silently on later sign-ins. Sign-out unlinks it. The `send-push` Edge Function sends
  `hold_expiring`, `holds_released` and `clearance_earned` notifications through Expo; bookings the member just
  made aren't pushed. Delivery is untested end to end: it needs an EAS project id, a hosted project with the
  Database Webhook, and a development build (Expo Go and the web don't receive remote pushes).
- **Vaccines.** Bookings need Rabies, DHPP and Bordetella current on the day. Members enter expiry months on
  the vaccines screen and attach the vet record: one photo or PDF for all three (up to 10 MB), in the private
  `vaccine-docs` bucket. Records are unverified until a partner or PackPass checks them (`verified`). Changing a
  date or the record makes it unverified again; saving unchanged dates keeps the check. A record picked during
  onboarding uploads when the dog is saved.
- **Waitlist.** A full session's footer (class detail and booking sheet) offers "Join the waitlist". Every rule
  but "full" applies when joining, including credits. When a spot opens (a cancellation or a released hold) more
  than 12 hours before the start, the first dog in line is booked automatically and charged, and the member is
  notified (and pushed); they can still cancel for free. Inside 12 hours nothing books itself: everyone waiting
  is told once, and the first to book gets it. If the first member can't book any more (credits, vaccines), they
  are skipped and told why. Sample mode puts you 3rd in line; Settings › Preview states › "Open a spot" plays the
  cancellation.
- **Add to calendar** (booking sheet) opens the phone's own "new event" sheet, filled in, with no calendar
  permission; the web downloads an .ics file with a one-hour alert.
- **Forgot password** (from sign-in) emails a 6-digit code, then takes the code and a new password and signs in.
  Not in the designs; built from the sign-in and verify screens' parts. Supabase's emails are set to send codes
  (`supabase/templates`), which the hosted project needs too.
- **Re-check** on an expired Social clearance books the next Social re-check (2 credits; the design said 1).
- **Dog photos.** Added in onboarding (01e) or from "Change photo" under the Athlete Card on the Dog tab (not in
  the designs). The photo is cropped to the card's 4:5 (by the picker on phones, centre-cropped on the web,
  where the picker can't crop) and resized to 1080 px JPEG (~150 KB). Live mode uploads it to the private
  `dog-photos` bucket under `<member>/<dog>/`, stores the path on the dog, deletes the previous photo and shows
  it through week-long signed URLs cached by path. A dog without a photo shows its initial. Sample mode keeps
  the photo on the device.
- **Distances** are measured from the area picked in onboarding ("Trains near", saved on the dog), or from
  anywhere the member picks in Settings › Distances from: another area, or "My location" (when-in-use
  permission, a recent fix is enough). The Today pill shows which and opens that setting. Sample mode keeps the
  designs' distances until the member picks somewhere.
- **Settings** in the live app is Account, Appearance, Distances from and Sign out; Preview states is sample mode only.
  Account (not in the designs): edit the name, see the email, change the password (8+ characters), and Delete
  account, a screen listing what goes (Passport, Log, upcoming bookings, credits) with a two-step confirmation.
  It deletes the dogs' photos and vet records from Storage, then calls `delete_my_account()`, signs out and
  returns to Welcome. Changing the email sends a 6-digit code to the new address and, with Supabase's secure
  email change (the default), one to the current address; the app asks for each in turn.
- **Today's hero** shows the member's dog (a field photo until they add one).
- **Live-mode gaps:** the plan is always Regular; Apple and Google sign-in and buying credits show a message.
- **Cancelling** lives on the class detail screen (05) when the session is booked: "Cancel booking" under
  Check in, then an inline confirmation that says whether the credits come back (free until 12 hours before;
  the spot always goes back). The designs don't draw it; it reuses the footer's existing buttons.
- **Otis** appears in the dog switcher and booking sheet; sample mode checks the rules against Juno's records.
- **Web QR scanning** in expo-camera loads jsQR from cdn.jsdelivr.net at runtime. The 4-digit code works without it.
- **Glass on Android** uses expo-blur's experimental blur; older devices fall back to a translucent fill.

## 9. Open questions

- None right now. (Auth email goes through Resend; setup steps are in `supabase/README.md`.)
