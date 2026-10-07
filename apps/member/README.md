# PackPass member app

One Expo (React Native) codebase for iOS, Android and web. It implements the 24 screens in
`project/Pack Member App.dc.html` on the Pack Athletic Club v2 design system. See `docs/TECH_SPEC.md`
for the stack, the decisions behind it, and what v1 leaves out.

It runs in one of two modes:

- **Live** (default): `.env` points at the hosted Supabase project `packpass`. The app signs up, signs in,
  books and checks in against it, on the real clock. See `supabase/README.md`.
- **Sample data**: put `EXPO_PUBLIC_SUPABASE_URL=` and `EXPO_PUBLIC_SUPABASE_KEY=` (both empty) in `.env.local`.
  Juno, a 3-year-old Border Collie on the Regular plan, with the clock fixed at Tuesday, Sep 29 2026, 9:41 am,
  the moment the designs show. Nothing leaves the device, and Settings › Preview states moves through the
  designs' states. After changing env files, start or export with `--clear`; Metro caches env values.
  On a phone it also registers for push (hold reminders, clearances; `src/lib/push.ts`). That needs
  `eas init` and a development build, since Expo Go and the web don't receive remote pushes.

Both modes apply the same booking rules (`src/lib/booking.ts` mirrors the database functions):
group classes need a Social clearance unless they're a step on the dog's training path, Herding is assessed
per partner, vaccines must be current on the day, plus spots, credits and the 12-hour cancel window.

## Run it

```bash
cd apps/member
npm install
npx expo start          # press i (iOS simulator), a (Android), w (web), or scan with Expo Go
npm run typecheck
npm run export:web      # static web build in dist/
```

In sample mode, sign in with any email and a password of 8 or more characters, or go through "Create
account" for the full onboarding (any 6-digit code verifies). In live mode those go to Supabase Auth.

## Seeing every state

The design file had a Tweaks panel. Here those states are in the Dog tab › gear › **Preview states**:

- **Pass re-check:** Juno passes the Social re-check. The bell on Today gets a dot, and the notification
  opens the Clearance earned celebration, which flips her Passport from "Working on it" to "Cleared".
- **Social clearance expired**, **Behaviorist note on the path**, **Credits: set to 1** (out-of-credits
  booking sheet), **Clear upcoming bookings** (empty Today), **Reset sample data**, **Sign out**.

Juno starts on step 2 of Calm around dogs, so group classes show "Needs Social" until she passes the
re-check; path sessions (Small-group play, privates) book straight away. Herding on Livestock shows the
"needs assessment" state, and anything after Oct 14 is blocked until her Bordetella is updated on the
vaccines screen (Dog tab › Health and care › Update).

01j leads with a Social assessment for dogs without one: "Book these" books week 1 and holds the group
sessions (spots reserved, no credits; stored on the server in live mode). Today's "Rest of Juno's month" card
books them once she passes (Settings › Preview states › Pass re-check).

## Store builds

`eas.json` has three profiles. Builds use the committed `.env`, so every store build runs on the live PackPass
project; sample data is for `npx expo start` with an empty `.env.local` only.

- `development`: an iOS simulator build and an Android APK, for trying native features (camera, push, calendar).
- `preview`: an internal build for real phones (registered iPhones, or an APK to sideload).
- `production`: App Store and Play Store. Build numbers count up on their own (`appVersionSource: remote`).

```sh
npx eas-cli login
npx eas-cli build --profile production --platform all
npx eas-cli submit --profile production --platform ios      # TestFlight
npx eas-cli submit --profile production --platform android  # Play internal testing, as a draft
```

The first build asks to create the EAS project and the Apple and Google signing credentials; let EAS manage them.
On live builds the Apple and Google sign-in buttons and the Book map are hidden until they are built for real
accounts; members sign in with email. Settings › Plan and credits opens Stripe's billing portal for the card on
file and receipts (plans themselves are changed in the app).

The icon, Android adaptive icon, splash mark and favicon in `assets/` are an interim "PP" mark made by
`python3 scripts/make-icons.py`; replace the PNGs (same names and sizes) when there's a designed logo.

Crash reports go to Sentry once `EXPO_PUBLIC_SENTRY_DSN` is set in `.env` (empty means off; reports carry the
account id only). Source map upload is off in `eas.json` (`SENTRY_DISABLE_AUTO_UPLOAD`); to turn it on, add the
Sentry organization and project to the `@sentry/react-native` plugin in `app.json`, put `SENTRY_AUTH_TOKEN` in
the EAS project's secrets, and remove that line.

## Layout

- `src/app` routes (Expo Router), `src/ds` design system components, `src/theme` tokens,
  `src/data` sample data and the swappable catalog, `src/lib` booking and date rules, `src/store` app state,
  `src/api` the Supabase client and live-mode calls.
- `scripts/gen-seed.mjs` writes `supabase/seed.sql` from the sample data, so both modes show the same catalog.
- `e2e/live/run.sh` runs the store and API code against the database through PostgREST (see `supabase/README.md`).
- `assets/fonts` holds Archivo at the design's widths, generated by `scripts/make-fonts.py`.

## Notes

- `babel.config.js` turns on `unstable_transformImportMeta`, because zustand's ESM build uses `import.meta`,
  which the web bundle can't parse otherwise.
- The QR scanner needs a development build or Expo Go with camera permission. On web it needs HTTPS.
