# PackPass: Pivot Design Spec

Oct 1, 2026 · @Zak

## Summary

PackPass becomes an Austin-only membership for drop-in enrichment and skill classes, matched to each dog. Grooming, daycare and boarding come out of every surface. The stress test (Oct 1) returned PIVOT: credits fail where owners stay loyal to one provider (training courses, grooming, boarding) and work where variety is the point (sport, scent, play, skill drop-ins).

The current Barkly designs are about 70% reusable. The design system, Passport and Athlete Card, trait-based onboarding, Social clearance, assessments and the partner dashboard all carry over. What changes is the promise on every screen:

- **From:** one membership for classes, training and grooming.
- **To:** the membership that keeps your dog busy, matched to what your dog actually needs.

Three things the design must now make obvious: variety is the product (a balanced week across sport, scent, play and skills), matching is the hook (describe your dog once, get the right classes and specialists), and Austin is the whole market for now.

## What exists today

The Claude Design project "Pack Member App screens built" has four files on the Pack Athletic Club design system: Barkly Website, Pack Member App (20 screens), Pack Partner Dashboard (9 screens) and Pack Partner Onboarding (welcome plus 5 steps). Most of the damage is in category lists, plan copy and the clearance set, not in layout.

| Surface | Keep | Change | Cut |
| --- | --- | --- | --- |
| Brand and design system | Pitch, Chalk, Turf, Agility, Kennel Red tokens; Big Shoulders Display and Instrument Sans; candid sport photography | Name: the site says Barkly, the app says Pack, the plan says PackPass. Pick one (see Positioning) | Grooming photo tile (wall.jpg as Grooming) |
| Website, owner page | Hero layout, How it works, Passport section, plans block, FAQ, app CTAs | Hero line and eyebrow, class grid, partner cards, plan names and prices, quotes, FAQ answers, add Austin framing and a matching section | "Classes, training and grooming", The Groom Room card, "weekly class plus grooming" plan copy, grooming quote |
| Website, partner page | Lead-gated earnings, $9.50 per credit payout explainer, calculator, controls grid, requirements, partner FAQ | Eyebrow and subhead to "fill open spots"; business types | Groomers and Daycares from eyebrow and business-type picker |
| Owner app onboarding (01a to 01j) | Account, dog basics, details, play style, traits picker, Athlete Card reveal | Starting plan becomes "Juno's week": a balanced weekly mix plus any training path | Interests chips for Grooming and Daycare |
| Owner app core (02 to 08) | Today, Book list and map, class detail, booking sheet, Log, Dog profile, Athlete Card flip | Book categories, recommended rail logic, Log balance bar becomes the hero | Groom, Care and Stay categories; overnight boarding and daycare rows |
| Clearances and paths (09 to 11) | Social clearance (transfers across partners), Herding (stays at partner), assessment result screen, training path screen | Path endings: no path ends in a Boarding clearance | Boarding clearance, Handling clearance (grooming), Comfortable alone path as a Boarding gate |
| Partner onboarding | Welcome, 5-step flow, credentials upload, payouts step, review timeline | Partner types, services list, side-panel copy that mentions grooming and care | Grooming salon, Daycare and boarding types; Grooming, Daycare, Drop-off options |
| Partner dashboard | Overview, Schedule, Classes, Roster, Session notes, Assessments, Locations, Earnings, Trainer profile | Add fill-rate by session and "open spots to PackPass" control; assessment types | Boarding and Handling clearances from the clearance picker |

## Positioning, name and copy

Use PackPass as the working name everywhere and retire Barkly. One name across site, app and partner tools; "Pack" stays as the in-app short form ("Your Pack"). Barkly is also generic enough to collide with existing pet businesses, so it would need a trademark check either way.

**One-liner:** PackPass is the membership that keeps your dog busy, matched to what your dog actually needs.

**Owner problem:** Most dogs need more than a walk. Finding good local classes means scrolling Instagram, calling around and committing to a 6-week course before you know it fits. Owners of reactive or anxious dogs have it worst.

**Partner problem:** Local trainers and sport clubs run on referrals and Google reviews. Open spots in group classes go unsold, and most have no time or budget for paid marketing.

**Voice:** keep the existing spec's voice (dog as athlete, owner as coach, short sentences, one line of personality per screen). Shift emphasis from progress and levels to a full, balanced week.

| Slot | Current | New |
| --- | --- | --- |
| Site eyebrow | Classes · Training · Grooming | Sport · Scent · Play · Skills · Austin |
| Site hero | Every dog is an athlete. | Keep it. It still fits the enrichment direction |
| Hero subhead | Book classes, training and grooming with trainers and gyms near you. | Drop-in agility, scent work, open fields and skill classes across Austin. Tell us about your dog and we'll build their week. |
| Today greeting | Juno is due for a hard day. | Keep, and pair with the week: "Juno is due for a hard day. Scent work would round out her week." |
| Partner hero subhead | ...book classes, training and grooming... | PackPass members fill the open spots in your classes. List the sessions you want filled and get paid for every dog that shows up. |

Copy rules: no em dashes in any copy, no paw-print or bone puns, and no testimonials on the live site until they come from real members (the current quotes from Maya, Daniel and Priya are placeholders and must be labeled as such or removed before launch).

## Membership and credit model

Keep credits and the $9.50 partner payout per credit, but reprice plans so a member who uses every credit still leaves at least 20% margin. The current plans assume grooming and run on credit values that a full-use member can push toward break-even.

Rule for every plan: price per credit must be at least $11.90 (payout $9.50 is then 80% or less of plan revenue at full use). Breakage and rollover caps add margin on top.

| Plan | Price / month | Credits | Price per credit | Payout at full use | Fits |
| --- | --- | --- | --- | --- | --- |
| Founding Pack (test only) | $79 | 6 + 2 bonus in month one | $13.17 (month one $9.88) | 72% (month one 96%) | About 3 drop-ins a month; the cohort in the demand test |
| Starter | $79 | 6 | $13.17 | 72% | 3 group drop-ins a month |
| Regular | $129 | 10 | $12.90 | 74% | A drop-in most weeks plus a skills session |
| Working Dog | $189 | 16 | $11.81 | 80% | High-energy dogs out 3 to 4 times a week |

Session credit costs (partner proposes, PackPass reviews, as the dashboard already does): open play and sniff spaces 1, group sport or scent drop-in 2, small-group skills (reactivity, recall) 2 to 3, private 1:1 with a specialist 3 to 4, behaviorist consult 6 to 8.

This supersedes the stress test's "8 credits for $79" Founding Pack, which would pay out 96% of revenue every month. Keep rollover at one month, capped at one month of credits, free cancel up to 12 hours before, and late cancels and no-shows paid to the partner.

## Website spec

Keep the single-file site with the owner/partner toggle and light/dark themes. The owner page gains a matching section and Austin framing; the partner page mostly loses grooming and care.

### Owner page, top to bottom

1. **Nav:** PackPass wordmark, "Now in Austin" pill, links How it works, Classes, Partners, Plans, FAQ. CTA "Get the app".
2. **Hero:** eyebrow "Sport · Scent · Play · Skills · Austin", keep "Every dog is an athlete.", new subhead (Positioning table). CTAs: Get the app, "Build my dog's week" (scrolls to matching).
3. **New: Matched to your dog.** A three-step mini quiz on the page: energy (Couch to Working dog), up to three traits from the existing trait list, neighborhood. Output: a sample week card (for example "Tue Scent Work I · Thu Open field · Sat Agility drop-in") with credit total. Ends with "Get the app to book it". This is the site's main differentiator.
4. **How it works:** 01 Tell us about your dog, 02 Book a balanced week (drop in to anything, no 6-week commitment), 03 Watch the Passport fill.
5. **Classes grid:** replace the 8 tiles with Agility, Scent work, Sprint and lure, Herding, Open field, Sniff spaces, Recall and focus, Reactive dog drop-ins. Remove Grooming and Obedience-as-a-course.
6. **Partners near you:** Austin neighborhoods (East Austin, Mueller, South Lamar, Cedar Park). Drop The Groom Room; show a sport club, a scent partner and an outdoor field.
7. **Passport:** keep. Add the weekly balance bar (physical, mental, social) next to stamps and levels.
8. **Plans:** Starter, Regular, Working Dog from the credit model. "Most popular" on Regular. Perks: any partner, any discipline; free cancel 12 hours before; one month rollover.
9. **Members:** hidden until real quotes exist. Placeholder state in the design reads "Founding members' words go here."
10. **FAQ:** keep credits, rollover, cancel, vaccines, pause. Add "My dog is reactive. Can we still join?" (yes: reactive-dog drop-ins and 1:1 specialists, filtered by the dog profile) and "Is PackPass outside Austin?" (waitlist by ZIP).
11. **Closing CTA:** "Book your dog's first drop-in this week."

### Partner page changes

- Eyebrow: "Trainers · Sport clubs · Scent instructors · Outdoor spaces".
- Hero: keep "Bring more dogs through your door." with the new subhead.
- Business-type picker in the earnings gate: Trainer, Sport club, Behavior specialist, Outdoor space.
- Values: replace "Members already nearby" with "Fill the spots you'd leave empty" (you choose how many spots open to PackPass per session).
- Payout example: keep "Saturday Agility Foundations, 2 credits, 8 dogs = $152".
- Controls grid: keep all six; rename "Who can book" body to mention Social clearance and level.
- Requirements: keep license, insurance and trainer certification; outdoor-space hosts need insurance and a site photo, no trainer cert.
- Partner quote: placeholder until a real Austin partner says it.
- FAQ: add "Do members become my direct clients?" Answer: yes, anyone can sign up with you directly; PackPass does not restrict it.

## Owner app spec

Keep the four-tab structure (Today, Book, Log, dog-name tab) and the Athlete Card. The new center of gravity is "Juno's week": a recommended mix of sessions that the matching engine builds and the Log scores.

### Onboarding (01a to 01j)

- **01a to 01f:** keep as built (welcome, account, sign in, verify, dog basics, details).
- **01g Play style:** keep energy and sociability. Interests chips become Agility, Scent, Sprint, Herding, Open play, Sniff spaces, Skills. Remove Grooming and Daycare.
- **01h Traits:** keep the grouped trait picker exactly. It now drives two things: which skills sessions and specialists appear, and which group sessions are hidden ("Selective" and "Prefers solo" dogs see small-group and solo first).
- **01i Reveal:** keep the Athlete Card animation.
- **01j Starting plan becomes "Juno's week":** a 7-day strip with 2 to 4 suggested sessions balanced across physical, mental and social, credit total against the plan, "Book this week" (books all available) and "Swap" per item. Any training path from traits (Loose leash walking) shows below as an optional add-on, not the main event.

### Today (02)

- Greeting plus one balance nudge ("Scent work would round out her week").
- Compact Athlete Card with streak.
- Up next with Directions and Check in.
- **This week:** the 7-day strip from onboarding, filled or suggested per day.
- Credits left ("5 of 10 left, resets Nov 1").

### Book (03, 04)

- Replace category tabs Train, Play, Groom, Care, Stay with **Sport, Scent, Play, Skills**. Privates live inside Skills, filtered by the dog's traits.
- Keep day strip, list/map toggle, card anatomy (photo, title, partner, distance, time, length, credits, spots left).
- Add a "Fits Juno" filter on by default (energy, sociability, clearances, age).
- Remove the overnight boarding, daycare, bath and nail trim rows and the Boarding assessment row.

### Class detail and booking sheet (05, 06)

Keep as built, including the "needs assessment" state for Herding on Livestock and the out-of-credits state. Add one line under the key facts: "Adds to Juno's week: mental" (or physical, social).

### Log (07)

Promote the weekly balance bar to the top of the screen, then the month heatmap, then history and milestones. Drop "Handling cleared" from the milestone list; keep "Social cleared".

### Dog profile, clearances, paths, assessment (08 to 11)

- Clearances shown: Social (transfers to every partner, 12 months) and discipline ratings that stay with a partner (Herding). Remove Boarding and Handling.
- Training path (10): keep the stepped layout and trainer list. Rename the example to "Calm around dogs", ending in a Social clearance and access to group sport.
- Assessment result (11): keep the cleared / not yet split; example becomes a Social assessment.

### States to design

Empty week (new member), week fully booked, week over budget (suggestions exceed credits), class full with waitlist, out of credits, vaccine missing, Social clearance expired.

## Partner view spec

The partner tools are the strongest part of the current design and need trimming, not rebuilding. The one new idea: partners open specific spots to PackPass and see how many of those spots got filled, because "fill your empty spots" is the whole pitch.

### Onboarding (P0 to P6)

- **P0 Welcome:** eyebrow "Trainers · Sport clubs · Scent instructors · Outdoor spaces"; new subhead; values become Fill open spots, Bookings run themselves, $9.50 per credit.
- **P2 Business types:** Independent trainer, Training facility, Dog sport club, Behavior specialist, Outdoor space. Remove Grooming salon and Daycare and boarding.
- **P3 Services:** Agility, Scent work, Sprint and lure, Herding, Dock diving, Open play, Fitness and conditioning, Recall, Reactivity, Puppy foundations, Behavior consult. Remove Grooming and Daycare. Formats: Group drop-in, Small group, Private, Open session. Remove Drop-off.
- **P4 Credentials:** keep. Outdoor-space hosts skip trainer certification.
- **P5 Payouts and P6 Submitted:** keep. Side-panel line for P3 changes from "training, sport, grooming and care" to "sport, scent, play and skills".

### Dashboard (01 to 09)

- **01 Overview:** keep the four stat tiles; rename "Fill rate" to "PackPass spots filled" (filled ÷ spots opened to PackPass). Keep "Needs attention" items.
- **02 Schedule:** add a per-session control "Spots open to PackPass" (0 to capacity) beside capacity, waitlist and auto-promote.
- **03 Classes:** keep the editor and credit review. Types stay Class, Private, Assessment. Clearance picker options become None, Social, Herding (assessed here). Remove Boarding and Handling.
- **04 Roster, 05 Session notes, 06 Locations, 08 Trainer profile:** keep as built. Session notes now also tag the balance category (physical, mental, social) the session counted toward.
- **07 Earnings:** keep by week, by class and payout history. Add "New dogs this month" (first visit to this partner) since new clients are the second half of the partner value.
- **09 Assessments:** keep rubric flow. Remove Boarding assessment; Social rubric stays the template.

## Data model and business rules

The existing Pack Athletic Club data model (Supabase, Stripe, Expo) holds up. Changes are additive except the clearance enum.

| Table | Change |
| --- | --- |
| partners | type enum: trainer, facility, sport\_club, behavior\_specialist, outdoor\_space (remove groomer, daycare\_boarding) |
| class\_types | add balance\_category (physical, mental, social); discipline enum: agility, scent, sprint, herding, dock, open\_play, sniff, skills, behavior |
| sessions | add packpass\_spots (int, 0 to capacity) |
| dogs | add traits (text\[\]), keep energy\_level, sociability |
| clearances | type enum: social, herding (remove boarding, handling); scope: network or partner |
| weekly\_plans (new) | dog\_id, week\_start, suggested\_session\_ids, booked\_session\_ids, balance (physical/mental/social counts) |
| bookings | unchanged; keep credits\_charged and statuses |

Rules the UI must reflect:

- A booking needs current vaccines and any clearance the class requires.
- Group sessions hide for dogs whose sociability or traits rule them out; Skills and Privates surface instead.
- Weekly plan suggestions never exceed remaining credits; over budget shows the cheapest balanced alternative.
- Partners are paid $9.50 per credit redeemed, including late cancels and no-shows, on the 1st.
- Members may book any partner directly outside PackPass; the app does not block or penalize it.

## Test first, build later

The stress test said no app until cold strangers pay. So the design work splits: update the designs now (they double as deck visuals and partner pitch material), but ship only a one-page site and a payment link for the Founding Pack test.

**Needed for the test (2 to 5 weeks):**

- [ ] Owner landing page: hero, "Matched to your dog" quiz, classes grid, named Austin partners, Founding Pack offer, Stripe payment link
- [ ] One-page partner term sheet: spots per week, $9.50 per credit, weekly payout by Zak during the test
- [ ] Manual fulfillment: booking by text and a shared calendar, Passport kept in a spreadsheet

**After the test passes (25+ paid members at $60 CAC or less, 60%+ booking two or more partners in 60 days):**

- [ ] Update the four design files per this spec
- [ ] Build the owner app (Expo) starting with onboarding, Juno's week, Book and booking sheet
- [ ] Partner dashboard v1: Schedule with PackPass spots, Roster, Earnings

**Open questions:**

- Final name: PackPass, Pack, or something else after a trademark check?
- Is $79 for 6 credits (3 drop-ins) compelling against a $139 PetSmart course, or does the test need $99 for 8?
- Will outdoor-space hosts (Sniffspot-style yards) join, or is Sniffspot already the default for that slot in Austin?
- Who are the first 15 Austin providers to pitch for the supply test?
