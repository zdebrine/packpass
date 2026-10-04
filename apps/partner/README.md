# PackPass Partner

The web dashboard for trainers and facilities, built from `project/Pack Partner Dashboard.dc.html`.
Vite, React and TypeScript, with the design system's CSS (`src/ds`) and the same Supabase project as the
member app. All times show in Austin time (America/Chicago), whatever the browser's time zone.

```bash
npm install
npm run dev        # http://localhost:5174
npm run build      # type-checks, then builds to dist/
```

`.env` points at the hosted project. To use another one (a local stack, say), put `VITE_SUPABASE_URL` and
`VITE_SUPABASE_KEY` in `.env.local`.

## Accounts

Live at **https://packpass-partner.vercel.app** (Vercel project `packpass-partner`, root `apps/partner`; every push
to the branch redeploys).

Staff sign in with an ordinary Supabase account linked to a partner. Owners add their own trainers and
co-owners on **Team**: an email that already has a PackPass account joins straight away; anyone else chooses
**Create an account** on the sign-in page with that email, confirms the 6-digit code, and lands on the
dashboard. There's no invite email yet, so Team gives the owner a message to send. An account PackPass invited
from Supabase sets its password with Set or reset password and the code from the invite email. Anyone else
who signs in sees "This account isn't linked to a partner yet."

New partners apply from the sign-in page (**Apply to partner with PackPass**, from
`project/Pack Partner Onboarding.dc.html`): create an account, then business, services, credentials (uploads)
and payouts (rate card and legal name; bank and tax details wait for Stripe Connect). Any signed-in account
that isn't on a team sees the same welcome, its draft, or where its application is up to. PackPass admins
review on **PackPass › Applications** (which also lists leads from the website's earnings form): approving creates the partner and opens its dashboard for the
applicant (add the map location on Partners); Ask for changes sends it back with a note.

Owners see everything. Trainers don't see Earnings or Team (the Overview shows check-ins instead of earnings).

PackPass admins link a partner's first owner on **PackPass › Staff** (the person creates an account first), and can remove any staff account there. Admins
also get **Review** (set credit costs and put new classes live) and **Partners** (add and edit partners and
trainers). An admin who isn't staff at a partner sees only those pages. To make someone an admin, in the
Supabase SQL editor:

```sql
insert into public.packpass_admins (user_id) select id from auth.users where email = 'them@example.com';
```

## Pages

| Page | What it does |
| --- | --- |
| Overview | Today's sessions, the week in numbers, and what needs attention: notes and results due, full sessions with the waitlist closed, vaccine problems among today's dogs. |
| Schedule | The week grid. A session's panel sets capacity, PackPass spots, waitlist, auto-promote and the weekly repeat, or cancels it (bookings refunded, owners told). Add session, and Block dates for weather or holidays. |
| Classes | Edit a class: name, discipline, format, who it suits, clearance, requirements, cover photo. Changing what the price is based on sends a live class to PackPass for a credit review. New class walks through four steps and sends the class for review; it can be scheduled once it's live. |
| Roster | Each session's dogs, with vaccine status, the vet record, clearances and the last note. Check dogs in by hand, mark vaccines checked, and show the check-in QR and code. |
| Session notes | A short note per dog after each session, sent to the owner's training log. |
| Assessments | Score the rubric, then clear the dog or record "not yet" (optionally starting a training path). The Passport updates and the owner is told. |
| Locations | Arrival notes (parking, where to meet) and today's check-in codes. |
| Earnings | Credits redeemed by month and by class at the partner's rate, and a CSV statement. |
| Trainers | Each trainer's bio, specialties and whether they take private sessions. |
| Team | Owners only: who can open the dashboard, invites waiting to be accepted, and adding or removing people. |
| PackPass › Review, Applications, Partners, Staff | Admins only: credit costs for new and repriced classes, partner applications, partners and trainers, staff accounts. |

## Waiting on keys

- **Payouts.** "Set up payouts" explains that Stripe isn't open yet; earnings are recorded and held. With
  Stripe Connect keys, the button starts onboarding and `partners.payout_status` tracks it.
- **Uploading cover photos** shows a note for now; classes pick from the photo library in `public/photos`.
