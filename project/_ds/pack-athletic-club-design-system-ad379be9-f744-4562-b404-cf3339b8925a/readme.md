# Pack Athletic Club — Design System (v2)

Pack Athletic Club is a membership for dogs: "ClassPass for dogs". One monthly plan of credits gives a dog access to classes and open sessions (herding, scent work, sprints, agility, behavior, free roam) at partner gyms, trainers and outdoor spaces. **The dog is the athlete; the owner is the coach.**

v2 (Sep 2026) keeps the brand voice and repositions the visuals as a modern fitness club: photo-first, white or near-black grounds, soft big radii, glass capsules over photography, heavy semi-expanded display type. Inspiration supplied by the user: Life Time app (Explore grid, Home hero), Natty Garb site (wide caps over full-bleed photo), ClassPass site (huge heavy type, black pill CTAs).

**Products:** the member mobile app (iOS first). Name usage: "Pack Athletic Club" on splash/marketing; "Pack" in-app.

## Sources
Uploads (no Figma, no repo): `uploads/pack-brand-book.md`, `uploads/pack-athletic-club-spec.md`, `uploads/pack-tokens.json`, `uploads/pack-components.css`, `uploads/pack-components.js` (v1 source bundle, `window.Pack`), plus four inspiration screenshots (`uploads/IMG_3571.png`, `IMG_3572.png`, two `Screenshot 2026-09-29…png`). v2 deliberately departs from the v1 token values in the brand book (fonts, radii, borders, field-line motif).

## Index
- `styles.css` — entry point (imports only)
- `tokens/` — `fonts.css`, `colors.css` (palette, semantic light default, `[data-theme="light"|"dark"]`), `typography.css`, `spacing.css` (space, radius, blur, motion), `base.css` (reset, links, `.pk-display-*`, `.pk-wide`, `.pk-title`, `.pk-body` …)
- `components/pack-components.css` — component classes
- `components/controls/` — Button, Chip, Tag
- `components/cards/` — ClassCard, AthleteCard, PhotoTile
- `guidelines/` — specimen cards (Colors, Type, Spacing, Brand)
- `assets/photos/` — 11 dog photos (Unsplash stand-ins: juno, weave, collie, sprint, wall, tunnel, leap, grass, hurdle, rail, lab)
- `ui_kits/member-app/` — interactive iOS recreation
- `thumbnail.html`, `SKILL.md`

## Components
- **Button** — primary (ink) · signal (agility) · quiet · glass; `size` md/sm; `wide` caps; `icon`; `block`
- **Chip** — `selected` (ink fill), `glass`, `icon`
- **Tag** — neutral · premium · signal · warning · glass (wide caps)
- **ClassCard** — `layout` tile (photo 260×320, text on scrim) or row (thumb + text + credits)
- **AthleteCard** — full photo trading card with glass stats; `compact` row
- **PhotoTile** — photo category tile with bottom-left label

Namespace: `window.PackAthleticClubDesignSystem_ad379b`.
Intentional additions: **PhotoTile** (browse grid tile from the Life Time Explore pattern; not in the v1 source). Button `glass`/`size`/`wide`, Chip `glass`/`icon`, Tag `glass`, ClassCard `layout="row"` are v2 extensions.

---

## CONTENT FUNDAMENTALS
Unchanged from the brand book.
- **Voice:** direct, confident, warm toward the dog. Premium gym restraint, not pet-store cute.
- **Person:** talk about the dog by name; the owner is "you", implied. Pack never says "I".
- **Casing:** sentence case for all copy. v2 exception: *wide caps* (CSS uppercase) for eyebrows, tags, capsules, the wordmark and hero CTAs. Write the source string in sentence case.
- **Sentences:** short, plain verbs, periods not exclamation marks. At most one line of personality per screen.
- **Name things:** name the dog, name the class, say what happens next. An action keeps its name through a flow: "Book for 2 credits" → "Confirm booking" → "Booked."
- **Numbers:** exact. "7 of 12", "Last spot", "Full. Waitlist open", "7:30 am". Middle dot `·` separates meta.
- **No:** emoji, puns, paw/bone imagery, confetti for routine actions.

Examples: "Juno is due for a hard day." · "Nothing booked this week. Pick a class to keep Juno's streak going." · "Booked. Herding Fundamentals, Thursday 7:30 am." · "This class is full. Join the waitlist or pick another time." · "Every dog is an athlete."

## VISUAL FOUNDATIONS
- **Grounds:** light theme is pure white `#FFFFFF` with ink `#0E0F0E`; dark is near-black `#0E0F0E` with `#F4F4F2`. Set `data-theme` on any container.
- **Color:** mostly black, white and bone greys. Agility yellow `#F2C230` is the only signal (booking CTA, streak, today marker, unlocked milestone), **max twice per screen**. Pitch green `#16322A` is now a brand accent (Premium tag, Athlete Card fallback, levels card), not a surface. Turf is secondary data color. Kennel red only for errors, last spot, due-soon.
- **Type:** Archivo 800 at 112 width, −2.5% tracking for display (names, titles, stats); Archivo 600 at 125 width, +8% tracking, uppercase for "wide caps"; Geist 400/500/600 for UI text. Scale: display 64/44/32/22, title 20, heading 17, body 16/23, label 14, caption 12.
- **Photography is the hero.** Full-bleed candid dogs mid-motion, natural light, outdoor. Text sits on photos over a bottom scrim (`--scrim`, 0→62% black) and a top scrim for status-bar legibility. Never text on a raw photo.
- **Glass capsules:** `--glass` white 22% + 20px blur + 1.4 saturate, white text. Only over photography (location pill, avatar, back/share, credit tags, hero CTA).
- **Cards:** filled `surface-raised` (#F3F3F1 / #222322), radius 28, no border, no shadow. Photo tiles radius 20. The Athlete Card is the one card with a shadow (`--shadow-card`).
- **Borders:** effectively none. A single hairline above the tab bar. Separate with space and fills.
- **Radii:** 12 thumbs · 20 tiles · 28 cards · 32 sheets · pill for every tappable control (buttons, chips, search, capsules).
- **Buttons:** 52px pill. Primary is solid ink (black on light, white on dark). Hover: 88% opacity (primary), darker fill (quiet). **Press: scale 0.97.** Disabled 40%.
- **Layout:** 20px gutters, 32px between sections, section titles 20/600 with a round arrow button instead of "See all" links. Home opens on a 500px hero photo; the content sheet overlaps it by 28px with 32px top corners. Sticky booking bar with `--shadow-float`.
- **Motion:** ease-out `cubic-bezier(.2,.8,.2,1)`; 140ms press/chips, 260ms sheets and list fades, 520ms photo scale-on-hover (1.03) and card flip. Celebrate only real milestones.
- **Transparency/blur:** glass capsules and the sheet scrim (40% black) only.
- **Retired from v1:** field-line motif, Big Shoulders Display, Instrument Sans, hairline-bordered cards, chalk off-white ground, pitch-green hero surfaces.

## ICONOGRAPHY
- Outline icons, 2px stroke, rounded caps. **No icon files were supplied**; the kit uses **Lucide** from `https://unpkg.com/lucide-static@0.460.0/icons/<name>.svg`, masked to `currentColor` (substitution, flagged). Custom per-discipline icons are still to be drawn.
- Icons sit in 44px round buttons (glass over photos, `surface-raised` elsewhere). Tab bar: active ink, inactive `ink-faint`; the dog tab uses the dog's photo as avatar.
- No emoji, no unicode glyph icons, no paws or bones.
- **Logo:** the PAC dog-tag monogram is not drawn yet. Set the name in wide caps (`guidelines/wordmark.html`). Do not draw a mark.
