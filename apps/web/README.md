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

## Editing copy and photos (Sanity)

The words and photos on both pages live in Sanity, project `17ja5m2z` (dataset `production`), and are edited at
**https://packpass.sanity.studio** in three documents: Site settings, Owners page and Partners page.

- **How it gets to the site.** The build reads the published documents once (`scripts/prerender.mjs` →
  `src/content/sanity.ts`) and bakes them into the prerendered HTML, so search and link previews see the copy and
  no request goes to Sanity from the visitor's browser. Publishing in Sanity calls a Vercel deploy hook, which
  rebuilds the site with the new content.
- **Fallbacks.** `src/content/defaults.ts` holds the same copy. A field left empty in Sanity shows the default.
  If Sanity can't be read during a Vercel build, the build fails and the live site keeps its last good version;
  a local build without network uses the defaults.
- **What isn't in Sanity.** Partner cards, the class list in the matcher and trait names come from the live
  Supabase catalog. Form labels, error messages and the $9.50 payout rate in the calculator stay in code.
- **Changing the fields.** Edit `sanity/schema.js` and the `SiteContent` type in `src/content/defaults.ts`
  together, then deploy the schema (Sanity MCP `deploy_schema`, then `deploy_studio`). The dev server reads Sanity
  live (`localhost:5175` is an allowed CORS origin).

## Left out on purpose

- Owner testimonials and the partner quote: the design marks both as placeholders hidden on the live site.
- Plan buttons and "Get the app" scroll to the download section; there's no web sign-up (members join in the app).

## Hosting

A second Vercel project with root `apps/web` (framework Vite, output `dist`; `vercel.json` rewrites every path to
`index.html`). No environment variables are needed on Vercel: `.env` is committed and holds public values only (the Sanity
project id is public and the dataset is public read-only).
