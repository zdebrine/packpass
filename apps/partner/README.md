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

Staff sign in with an ordinary Supabase account that PackPass has linked to a partner. Anyone else who signs
in sees "This account isn't linked to a partner yet." To link one, in the Supabase SQL editor:

```sql
select public.link_partner_staff('maren@example.com', 'ridgeline', 'owner', 'maren');
-- email, partner id, 'owner' or 'trainer', and their trainer profile (or null)
```

The account has to exist first (sign up in the member app, or Auth › Users › Add user).

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

## Waiting on keys

- **Payouts.** "Set up payouts" explains that Stripe isn't open yet; earnings are recorded and held. With
  Stripe Connect keys, the button starts onboarding and `partners.payout_status` tracks it.
- **Uploading cover photos** shows a note for now; classes pick from the photo library in `public/photos`.
