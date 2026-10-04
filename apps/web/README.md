# PackPass website

The public site, built from `project/PackPass Website.dc.html`: **For owners** at `/` (light) and **Partner with
us** at `/partners` (dark). Vite, React and TypeScript with the design system's CSS (`src/ds`, copied from the
partner dashboard) and the same photos.

```bash
npm install
npm run dev        # http://localhost:5175
npm run build      # type-checks, then builds to dist/
```

`.env` holds public values only: the Supabase URL and publishable key, the dashboard URL (Apply to partner opens
`<dashboard>/?apply=1`; Sign in goes to the dashboard) and the app store links. Leave `VITE_IOS_URL` and
`VITE_ANDROID_URL` empty until the app is listed; the download buttons then read "coming soon".

## What's live

- **Partners near you** and **Matched to your dog** read the catalog signed out (partners, live classes and
  upcoming sessions are public). Partners near you shows three partners with their next open session. The quiz
  follows the design's rules (energy sets how much, traits add skills work, at most 16 credits) using real
  classes, and the neighborhood (the app's "Trains near" areas) sets the distances. If the catalog can't load,
  both fall back to a copy of the launch catalog.
- **The earnings gate** on the partner page saves a lead (`submit_partner_lead`, anyone may call it; nobody can
  read leads back except PackPass admins, on PackPass › Applications in the dashboard). Once submitted, the
  calculator stays open in that browser. The design's "We'll email a copy" is left out until emails send.

## Left out on purpose

- Owner testimonials and the partner quote: the design marks both as placeholders hidden on the live site.
- Plan buttons and "Get the app" scroll to the download section; there's no web sign-up (members join in the app).

## Hosting

A second Vercel project with root `apps/web` (framework Vite, output `dist`; `vercel.json` rewrites every path to
`index.html`). No environment variables are needed on Vercel: `.env` is committed and holds public values only.
