# Pack Athletic Club: Member App Design and Tech Spec

## 1. Product summary

Pack Athletic Club is a membership for dogs. One monthly plan gives a dog access to classes and open sessions at partner gyms, trainers, and outdoor spaces across the city. Members book herding, scent work, hide and seek, sprints, agility, behavioral training, and free roam sessions from one app. Premium classes cost extra credits.

The product should feel like a lifelong athletic membership, not a booking tool. Every dog has an athlete profile that grows from puppyhood to senior years, with a training history, discipline levels, and milestones that accumulate over its life.

**First mockup scope:** member mobile app (iOS first). Browse, book, and dog profile. Partner and admin tools are out of scope for this pass.

**Primary user:** an owner of a high-energy or under-stimulated dog, 25 to 45, who already pays for their own gym and wants the same structure for their dog.

**Primary job:** "Find something good for my dog to do today, book it in under a minute, and see that it is adding up to something."

## 2. Brand direction

**Positioning:** premium athletic club for dogs. Think the confidence and restraint of a high-end gym, grounded in the real world of dog sport: agility courses, herding fields, chalk-lined turf, leather leads.

**Voice:** direct, confident, warm toward the dog. Treat the dog as the athlete and the owner as the coach. Short sentences, sentence case, no puns on every screen (one well-placed line of personality per screen at most).

Examples:
- Home greeting: "Juno is due for a hard day."
- Empty schedule: "Nothing booked this week. Pick a class to keep Juno's streak going."
- Booking confirmed: "Booked. Herding Fundamentals, Thursday 7:30 am."
- Error: "This class is full. Join the waitlist or pick another time."

**Name usage:** "Pack Athletic Club" in full on splash and marketing. "Pack" in-app and in copy ("Your Pack membership"). Monogram: "PAC" set in the display face inside a rounded shield or tag shape, like a dog tag.

## 3. Design tokens

### Color

| Token | Hex | Use |
|---|---|---|
| Pitch | #16322A | Primary dark surface, headers, athlete card background, primary buttons |
| Chalk | #F5F6F2 | App background, text on Pitch |
| Turf | #3F6B4F | Secondary surfaces, selected states, progress fills |
| Slate | #6B7570 | Secondary text, dividers, inactive icons |
| Agility | #F2C230 | Signal color only: streaks, live availability, primary booking CTA highlight, milestone moments |
| Kennel Red | #C4452F | Errors, cancellations, "last spot" warnings only |

Rules: Agility yellow appears at most once or twice per screen. Most screens are Chalk with Pitch type. Pitch is used for the hero moments (athlete card, class detail header, booking confirmation).

### Typography

- **Display:** Big Shoulders Display (Google Fonts). Condensed, stadium-signage feel. Used for dog names, class titles, big stats, and the athlete card. Weights 700 and 800. Tight tracking (-1%).
- **Text:** Instrument Sans (Google Fonts). Used for all body, UI labels, buttons, and metadata. Weights 400, 500, 600.
- Sentence case everywhere. No all-caps labels. Numbers in the display face should use tabular figures.

Type scale (mobile, pt): 48 / 34 / 24 / 18 / 16 / 14 / 12. Body at 16 with 1.45 line height.

### Shape, space, depth

- 8 pt spacing grid. Screen side margins 20.
- Radius varies by hierarchy: athlete card 20, class cards 14, chips and buttons fully rounded (pill), inputs 10. Do not use one radius on everything.
- Depth comes from color (Pitch on Chalk) rather than shadows. Shadows only on the floating bottom sheet and the athlete card.
- Graphic motif: thin chalk lines (1 px, Chalk at 40% on Pitch, or Slate at 25% on Chalk) that echo field markings. Used sparingly as a background texture on the athlete card and class detail header, never as dividers between list items.

### Photography and iconography

- Real, candid dog photography: dogs mid-sprint, mid-turn, focused on a task. Natural light, slightly desaturated, no studio backdrops, no costumes.
- Icons: 2 px stroke, rounded caps, one custom icon per discipline (herding, scent, sprint, agility, behavior, free roam).

## 4. Signature element: the Athlete Card

This is the one bold element. Everything else stays quiet.

A vertical card, roughly the proportion of a trading card, Pitch background with faint chalk field lines. Contains:
- Dog photo (cutout or tightly cropped portrait), top half
- Dog name in Big Shoulders Display 48
- Breed, age, and life stage ("Border Collie, 3 yrs, Prime")
- "Member since 2026"
- Three lifetime stats in display numerals: sessions, hours active, disciplines trained
- Current streak with an Agility yellow indicator

Tap to flip: the back shows discipline levels (for example Herding Level 2, Scent Level 1) as horizontal progress bars in Turf.

The card appears on Home (compact) and Profile (full). It should feel collectible, like something the owner would screenshot and share.

## 5. Membership model (for UI content)

- **Tiers:** Starter (6 credits/month), Athlete (12 credits/month), Unlimited Open Play plus 10 credits/month.
- **Credits:** standard classes 1 to 2 credits, premium classes (herding with livestock, private behavioral sessions) 3 to 5 credits. Free roam sessions 1 credit or included in Unlimited.
- **Top-ups:** extra credit packs purchasable in-app.
- **Lifetime hook:** life stage tracks (Puppy, Prime, Senior) that change recommended programming as the dog ages. Senior track surfaces low-impact classes like swim, scent work, and slow walks.

## 6. Navigation

Bottom tab bar, four tabs:
1. **Today** (home)
2. **Book** (discover and schedule)
3. **Log** (lifetime activity)
4. **Juno** (dog profile; the tab label is the dog's name, with a small avatar. Multi-dog households get a switcher.)

Account, membership, and payment live under a settings icon on the profile tab.

## 7. Screens for the mockup

### 7.1 Onboarding (4 steps, a real sequence so step progress is shown)
1. Welcome: full-bleed photo of a dog mid-sprint, logo, "Every dog is an athlete." Buttons: "Get started", "Log in".
2. Build your athlete: dog name, photo upload, breed (searchable), birthday, weight.
3. Energy and temperament: energy level slider (Couch to Working dog), dog sociability (Loves dogs, Selective, Prefers solo), notes for trainers.
4. Pick a plan: three tier cards, Athlete tier preselected. Vaccination upload noted as required before first booking.

End state: the Athlete Card animates in with the dog's name and "Member since 2026". This is the one orchestrated motion moment in onboarding.

### 7.2 Today (home)
- Greeting line using the dog's name and a recommendation ("Juno is due for a hard day.")
- Compact Athlete Card with streak
- "Up next": the next booked session with time, location, and a map thumbnail; buttons "Directions" and "Check in"
- "Recommended for Juno": horizontal scroll of 3 to 4 class cards based on energy level, life stage, and recent activity balance
- Credits remaining this month, shown plainly ("7 of 12 credits left, resets Oct 1")

### 7.3 Book (discover)
- Search bar and a day strip (7 days, today selected)
- Discipline filter chips: All, Herding, Scent, Sprint, Agility, Behavior, Free roam
- Toggle between list and map view
- Class cards: photo, class title in display face, partner name, neighborhood and distance, time, duration, credit cost, spots left. Premium classes marked with a small "Premium" tag in Turf, not gold or sparkles.
- Map view: pins for partner locations, bottom sheet with that location's classes for the selected day

### 7.4 Class detail
- Pitch header with photo, class title, discipline icon, credit cost
- Key facts row: duration, intensity (1 to 5), group size, suitable for (energy levels, sociability)
- What happens in the session (3 to 4 sentences)
- Trainer card: photo, name, credentials, rating
- Location card with map and parking note
- Requirements: vaccines, age minimum, leash rules
- Sticky bottom CTA: "Book for 2 credits"

### 7.5 Booking flow (bottom sheet)
- Time slot selection if multiple times
- Dog selector (multi-dog households)
- Credit summary, with "Buy more credits" if short
- "Confirm booking" button, then confirmation state: "Booked. Herding Fundamentals, Thursday 7:30 am." with "Add to calendar" and "Done"

### 7.6 Log (lifetime activity)
- Month calendar heatmap in Turf shades showing active days
- Weekly balance bar: share of physical, mental, and social work, so owners see if a dog is only doing sprints and no scent work
- Session history list: class, date, trainer, trainer note ("Great recall today, work on waiting at the gate")
- Milestones row: "First herding class", "25 sessions", "1 year with Pack". Unlocked milestones get an Agility yellow badge.

### 7.7 Dog profile
- Full Athlete Card with flip interaction
- Discipline levels
- Health and records: vaccination status with expiry dates, vet contact
- Temperament and trainer notes
- Life stage indicator with what changes at the next stage

### 7.8 Membership (under settings)
- Current tier, renewal date, credits used and remaining
- Upgrade and downgrade options
- Credit packs
- Payment method, billing history, pause membership

## 8. Key states to include in the mockup

- Empty Today (new member, nothing booked)
- Class full with waitlist option
- Out of credits when booking
- Vaccination record missing before first booking
- Check-in confirmation on arrival (QR or geofence)

## 9. Tech spec

### Stack
- **App:** React Native with Expo (iOS first, Android from the same codebase), Expo Router, TypeScript
- **Backend:** Supabase (Postgres, Auth, Storage for dog photos and vaccine documents, Row Level Security, Edge Functions)
- **Payments:** Stripe Billing for subscription tiers, Stripe Checkout or Payment Sheet for credit packs, webhooks to a Supabase Edge Function that updates credit balances
- **Maps:** Mapbox for list and map discovery, partner location pins
- **Notifications:** Expo Push for booking reminders, waitlist openings, streak nudges
- **Check-in:** QR code at partner locations, with geofence as a later enhancement
- **Analytics:** PostHog for funnels (onboarding completion, first booking, weekly active dogs)

### Core data model
- `members`: id, name, email, phone, stripe_customer_id, tier, credits_balance, credits_reset_at
- `dogs`: id, member_id, name, breed, birthday, weight, energy_level, sociability, life_stage, photo_url, member_since
- `vaccinations`: id, dog_id, type, expires_at, document_url, verified
- `partners`: id, name, type (gym, trainer, outdoor space), address, lat, lng, rating
- `trainers`: id, partner_id, name, bio, credentials, photo_url
- `class_types`: id, name, discipline, intensity, is_premium, default_credit_cost, requirements
- `sessions`: id, class_type_id, partner_id, trainer_id, starts_at, duration_min, capacity, credit_cost
- `bookings`: id, session_id, dog_id, member_id, status (booked, waitlisted, checked_in, cancelled, no_show), credits_charged
- `session_notes`: id, booking_id, trainer_id, note, skills_tagged
- `discipline_progress`: dog_id, discipline, level, sessions_count
- `milestones`: id, dog_id, type, achieved_at
- `credit_ledger`: id, member_id, delta, reason (monthly grant, booking, refund, purchase), created_at

### Business rules to reflect in the UI
- Cancellation window: free cancel up to 12 hours before; late cancel forfeits credits
- Credits reset monthly; unused credits do not roll over (or roll over up to a cap, to be decided)
- A booking requires current vaccination records for that dog
- Sociability filters out group classes that do not fit ("Selective" dogs see small-group and solo sessions first)

## 10. What to avoid
- Cartoon paw prints, bone icons, and pun-heavy copy
- Pastel pet-store palettes
- Gamification that feels childish (confetti on every action); save celebration for real milestones
- Identical rounded cards stacked on every screen; vary layout between discovery, detail, and log

## 11. Prompt to paste into Claude Design

Design a high-fidelity iOS mobile app mockup for Pack Athletic Club, a premium athletic membership for dogs where owners book classes (herding, scent work, sprints, agility, behavior training, free roam) at partner gyms, trainers, and outdoor spaces using monthly credits. Follow the attached spec for brand, color tokens (Pitch #16322A, Chalk #F5F6F2, Turf #3F6B4F, Slate #6B7570, Agility #F2C230, Kennel Red #C4452F), type (Big Shoulders Display and Instrument Sans), and screens. Make the Athlete Card the signature element. Show these screens: onboarding final step with the Athlete Card reveal, Today, Book in list view, Book in map view, Class detail, Booking confirmation sheet, Log, and Dog profile. Use real-feeling content for a dog named Juno, a 3-year-old Border Collie, member since 2026, on the Athlete plan with 7 of 12 credits left.
