# Keys and settings

Everything PackPass needs from outside services, where each piece goes, and what's done. Nothing secret goes
in the repo: the apps only carry the Supabase publishable key, which is meant to be public (row level
security protects the data). Secrets live in the service that uses them: Supabase settings, Supabase Vault,
Edge Function secrets, EAS or Vercel.

## Status

| What | Used for | Where it lives | Status |
| --- | --- | --- | --- |
| Supabase URL and publishable key | Both apps talk to the database | `apps/member/.env`, `apps/partner/.env` (public) | Done |
| Push webhook secret and function URL | Database → `send-push` function | Supabase Vault | Done |
| Resend sending domain (DNS records) | Emails come from your domain | Your domain's DNS, verified in Resend | **To do** |
| Resend API key | Supabase sends sign-in emails through Resend | Supabase Auth › SMTP password (set by the script) | **To do** |
| Code-based email templates | Sign-up, reset and invite emails carry a 6-digit code | Supabase Auth › Email Templates (set by the script) | **To do** |
| Supabase personal access token | Lets `setup-auth.mjs` change Auth settings | Your shell only, or the Claude environment | **To do** (setup only) |
| Site URL and redirect URLs | Where any email link lands (codes don't need it) | Supabase Auth › URL Configuration (script: `SITE_URL`) | Can do now: `https://packpass-partner.vercel.app` |
| EAS project | Push tokens, phone builds | `eas init` writes the id into `apps/member/app.json` | To do |
| Apple push key (.p8) / Android FCM key | Push on real phones | EAS credentials (`eas credentials`) | To do, with store accounts |
| Apple Developer and Google Play accounts | TestFlight and store builds | Apple / Google | To do |
| Apple and Google sign-in | The "Continue with Apple/Google" buttons (show "coming soon" now) | Supabase Auth › Providers, plus Apple/Google consoles | Later |
| Stripe keys (test mode) | Plans, credit top-ups, Founding Pack, partner payouts (Connect) | `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as Edge Function secrets. The apps need no Stripe key (payments open Stripe's hosted Checkout) | Done (test mode); see section 3 |
| Maps key | A real map instead of the drawn one | Google Maps or Mapbox key in the app config | Later |
| Vercel project | Hosting the partner dashboard | `packpass-partner` → packpass-partner.vercel.app (Supabase values come from `apps/partner/.env`) | Done |
| Vercel project for the website | Hosting the public site (`apps/web`) | New project, root `apps/web`, no env vars needed (`apps/web/.env` is public) | **To do** |
| App store links | The website's download buttons | `VITE_IOS_URL`, `VITE_ANDROID_URL` in `apps/web/.env` | Later, once listed |

## 1. Email through Resend (do this first)

Sign-up, password reset and partner invites all send a 6-digit code. Until this is done the project uses
Supabase's test sender: links instead of codes, a couple of emails an hour, and only to the Supabase team.

1. **Domain.** In Resend › Domains › Add domain, add the domain you'll send from (for example `packpass.app`).
   Resend lists three or four DNS records (MX, SPF and DKIM TXT). Add them where the domain is registered,
   then press Verify. Verification usually takes minutes, sometimes a few hours.
   No domain yet? Skip to step 3 and run the script with just `SUPABASE_ACCESS_TOKEN`: the code templates go on
   and Supabase's test sender keeps working for you (it only delivers to the project's team, a few an hour).
   Real members need the domain. A subdomain of a domain you already own (like `mail.yourdomain.com`) works too.
2. **Resend API key.** Resend › API Keys › Create. "Full access" lets the setup script check and add the
   domain for you; "Sending access" is enough for the emails themselves.
3. **Supabase access token.** supabase.com/dashboard/account/tokens › Generate new token.
4. **Run the setup script** from the repo root (Node 18 or newer). It sets SMTP, all five templates, 6-digit
   codes for an hour, one email a minute per address and 100 an hour in all, and prints what it set:

   ```bash
   SUPABASE_ACCESS_TOKEN=sbp_… RESEND_API_KEY=re_… MAIL_FROM=hello@packpass.app \
     node supabase/scripts/setup-auth.mjs
   ```

   Add `--dry-run` first to see the settings without changing anything. To have Claude run it instead, add
   `SUPABASE_ACCESS_TOKEN`, `RESEND_API_KEY` and `MAIL_FROM` as environment variables in the cloud
   environment's settings and allow `api.supabase.com` and `api.resend.com` under network access, then start
   a new session.

   Prefer clicking? Resend › Integrations › Supabase fills in the SMTP settings, and the five files in
   `supabase/templates` go into Supabase › Authentication › Email Templates with the subjects listed in
   `supabase/config.toml`.
5. **Try it.** Sign up in the member app with a new email: the code should arrive from your domain within a
   few seconds. For your own account (invited from the dashboard, so it has no password yet), use Forgot
   password in the app or Set or reset password on the partner dashboard.

## 2. Push notifications on phones

1. `cd apps/member && npx eas-cli init` (creates the EAS project and writes its id into `app.json`).
2. With an Apple Developer account: `npx eas-cli credentials` › iOS › Push Notifications, and let EAS create
   the push key. For Android, upload a Firebase (FCM v1) service account key the same way.
3. `npx eas-cli build --profile development` and install the build. Expo Go and the web app don't receive
   remote pushes; the in-app notifications list works everywhere.
4. Only if you turn on Expo's enhanced push security: add `EXPO_ACCESS_TOKEN` as a Supabase Edge Function
   secret (Edge Functions › Secrets).

## 3. Later

- **Apple / Google sign-in:** an Apple Services ID and sign-in key, and Google OAuth client IDs (web, iOS,
  Android), entered in Supabase › Authentication › Providers. The app's buttons then switch on.
- **Stripe** (`supabase/functions/stripe-*`, `migrations/…_stripe.sql`):
  - Secrets: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Supabase › Edge Functions › Secrets. Nothing goes
    in the repo or the apps: members and the website pay on Stripe's hosted Checkout, partners onboard on
    Stripe's hosted Connect pages.
  - Webhook: Stripe › Developers › Webhooks, endpoint
    `https://<ref>.supabase.co/functions/v1/stripe-webhook`, events `payment_intent.succeeded`, `invoice.paid`,
    `customer.subscription.updated`, `customer.subscription.deleted`, `account.updated`.
  - Connect: turn on Connect once in the Stripe dashboard (Connect › Get started) before partners can set up payouts.
  - Plans and prices: created in Stripe on first use (lookup keys `packpass_plan_starter|regular|working`).
  - Payouts run on the 1st (`partner-payouts` cron job). To run them now: `select public.request_partner_payouts();`
    In test mode the Stripe balance needs available funds first: pay a top-up with card `4000 0000 0000 0077`.
  - Founding Pack on the website: set `VITE_FOUNDING_PACK_CHECKOUT=true` (keep it off in production while Stripe is
    in test mode).
  - Going live: swap both secrets for live ones, add a live-mode webhook endpoint, and stop the free monthly
    grant for members without a plan (`grant_monthly_credits`) if launch pricing needs it.
- **Maps:** a Google Maps (or Mapbox) key for real maps on the class and booking screens.
- **Dashboard address:** when you have a domain, add it to the `packpass-partner` Vercel project and use it as
  the Site URL (`SITE_URL=https://… node supabase/scripts/setup-auth.mjs`). Until then
  `SITE_URL=https://packpass-partner.vercel.app` keeps any email link from landing on localhost.
- **Leaked password protection:** Supabase › Authentication › Attack Protection, where your plan offers it.
