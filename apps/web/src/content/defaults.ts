// The site's words and photos. Sanity (src/content/sanity.ts) overrides any of these at build time; whatever it
// leaves out, or everything if Sanity can't be reached, comes from here. Sanity was seeded from this file.
import type { IconName } from './icons';

export interface Photo { src: string; alt: string; /** CSS object-position, from the hotspot set in Sanity */ position?: string }
export interface Card { title: string; body: string }
export interface IconCard extends Card { icon: IconName }
export interface Faq { question: string; answer: string }
export type PlanKey = 'starter' | 'regular' | 'working';
export interface PlanCopy { key: PlanKey; name: string; price: string; credits: number; fit: string; popular?: boolean }

export interface SiteContent {
  site: { ownerTitle: string; partnerTitle: string; description: string; shareImage: Photo; badge: string; footerTagline: string };
  owners: {
    hero: { variant: 'rotating' | 'static'; lead: string; eyebrow: string; headline: string; body: string; cta: string; matchCta: string; slides: (Photo & { line: string })[] };
    match: { eyebrow: string; title: string };
    how: { eyebrow: string; title: string; steps: Card[] };
    classes: { eyebrow: string; title: string; body: string; tiles: { label: string; sub: string; photo: Photo }[] };
    partners: { eyebrow: string; title: string; body: string };
    passport: {
      eyebrow: string; title: string; body: string; rows: IconCard[];
      dog: { name: string; sub: string; since: string; streak: string; photo: Photo; stats: { value: string; label: string }[] };
    };
    plans: { eyebrow: string; title: string; body: string; popularTag: string; perks: string[]; items: PlanCopy[] };
    faq: { eyebrow: string; rows: Faq[] };
    signup: { photo: Photo; foundingTitle: string; foundingBody: string; liveTitle: string; liveBody: string };
  };
  partners: {
    hero: { eyebrow: string; headline: string; body: string; cta: string; ctaNote: string; photo: Photo; values: IconCard[] };
    payouts: { eyebrow: string; title: string; body: string; steps: IconCard[]; example: string; exampleMath: string };
    calculator: { eyebrow: string; title: string; gateBody: string; note: string };
    clients: { eyebrow: string; title: string; body: string };
    control: { eyebrow: string; title: string; body: string; items: IconCard[] };
    join: { eyebrow: string; title: string; steps: Card[]; required: Card[]; optional: Card[] };
    faq: { eyebrow: string; rows: Faq[] };
    close: { title: string; note: string; photo: Photo };
  };
}

const photo = (key: string, alt = ''): Photo => ({ src: `/photos/${key}.jpg`, alt });
const faq = (rows: [string, string][]): Faq[] => rows.map(([question, answer]) => ({ question, answer }));

export const DEFAULT_CONTENT: SiteContent = {
  site: {
    ownerTitle: 'PackPass · Dog classes in Austin, matched to your dog',
    partnerTitle: 'Partner with PackPass · Fill your empty spots',
    description: 'Drop-in dog training, agility, scent work and reactive-dog classes across Austin. Tell us about your dog and we\'ll match the right classes. No 6-week commitment.',
    shareImage: photo('dog_chilling_with_owner_on_porch'),
    badge: 'Now in Austin',
    footerTagline: 'Drop-in dog classes across Austin, matched to your dog.',
  },
  owners: {
    hero: {
      variant: 'rotating',
      lead: 'The dog you can take',
      eyebrow: 'Dog classes matched to your dog · Austin',
      headline: 'The dog you can take anywhere.',
      body: 'Drop-in classes across Austin, picked for your dog’s energy and quirks. Burn off the extra, work on the hard stuff, and bring them along.',
      cta: 'Join the founding pack',
      matchCta: 'Match my dog',
      // In the rotating variant each photo's `line` follows `lead`. The last one lands on the full headline.
      slides: [
        { ...photo('dog_chilling_with_owner_on_porch', 'Dog lounging beside its owner on a porch'), line: 'to the patio.' },
        { ...photo('dog_sleeping_while_owner_reads', 'Dog asleep on the couch while its owner reads'), line: 'to a friend’s place.' },
        { ...photo('dog_getting_pets_at_park', 'Dog getting pets from its owner at the park'), line: 'off leash.' },
        { ...photo('dog_chilling_in_car', 'Dog riding in the back of a red truck'), line: 'on a road trip.' },
        { ...photo('dog_and_owner_chilling', 'Golden retriever resting in the grass with its owner'), line: 'anywhere.' },
      ],
    },
    match: { eyebrow: 'Matched to your dog', title: 'Tell us what your dog’s like. We’ll build the month.' },
    how: {
      eyebrow: 'How it works',
      title: 'One membership. The right classes for your dog. No 6-week commitment.',
      steps: [
        { title: 'Tell us about your dog', body: 'Energy, quirks, the stuff that makes walks hard. We match classes and certified trainers to fit.' },
        { title: 'Mix it up week to week', body: 'Agility one week, scent work the next, a 1:1 when you need one. Just drop in.' },
        { title: 'Watch them get easier', body: 'Trainers leave notes after every session, so you can see the progress and the next trainer picks up where the last one left off.' },
      ],
    },
    classes: {
      eyebrow: 'Classes',
      title: 'A different outlet every week.',
      body: 'Physical, mental and social work, so your dog comes home tired in the good way. Every session shows its level, spots left and credits before you book.',
      tiles: [
        { label: 'Agility', sub: 'Builds focus and confidence', photo: photo('athletic_dog_catching_ball') },
        { label: 'Scent work', sub: 'Tires the brain fast', photo: photo('dog_and_owner_chilling') },
        { label: 'Sprint and lure', sub: 'For dogs who need to really run', photo: photo('dog_running_on_beach') },
        { label: 'Herding', sub: 'A job for dogs bred to have one', photo: photo('dog_chilling') },
        { label: 'Open field', sub: 'Room to run off leash', photo: photo('dog_getting_pets_at_park') },
        { label: 'Sniff spaces', sub: 'A quiet, private space to decompress', photo: photo('dog_wrapped_in_blanket') },
        { label: 'Recall and focus', sub: 'Come when called. The first time.', photo: photo('dog_being_patient') },
        { label: 'Reactive dog drop-ins', sub: 'Small groups, lots of space, no judgment', photo: photo('pulling_on_leash') },
      ],
    },
    partners: {
      eyebrow: 'Partners near you',
      title: 'Local trainers we’d trust with our own dogs.',
      body: 'Every lead trainer is certified (CPDT-KA, KPA, IAABC or equivalent). Every partner is licensed and insured.',
    },
    passport: {
      eyebrow: 'Dog Passport',
      title: 'One profile. Every trainer on the same page.',
      body: 'Juno’s vaccines, temperament and trainer notes travel with her. No re-explaining her quirks at every new place, and you can see what’s actually working.',
      rows: [
        { icon: 'MessageSquareText', title: 'Trainer notes after every class', body: '“Held a down-stay with two dogs passing. Big win.”' },
        { icon: 'TrendingUp', title: 'Levels set by trainers', body: 'Agility Level 3, Scent Work Level 1' },
        { icon: 'Flame', title: 'Weekly streaks', body: 'Book once a week to keep it going' },
      ],
      dog: {
        name: 'Juno', sub: 'Border Collie · 3 yrs', since: 'Since Mar 2026', streak: '12 wk streak', photo: photo('juno'),
        stats: [{ value: '38', label: 'Classes' }, { value: '6', label: 'Disciplines' }, { value: 'L3', label: 'Agility' }],
      },
    },
    plans: {
      eyebrow: 'Plans',
      title: 'Pick a plan. Change it any month.',
      body: 'Most sessions cost 1 to 4 credits depending on length and format. A typical group class is 2.',
      popularTag: 'Best fit for most dogs',
      perks: ['Any partner, any class', 'Free cancel up to 12 hours before', 'Unused credits roll over', 'Pause or cancel anytime'],
      items: [
        { key: 'starter', name: 'Starter', price: '$79', credits: 6, fit: 'A regular outlet for a mostly chill dog. About 3 classes a month.' },
        { key: 'regular', name: 'Regular', price: '$129', credits: 10, fit: 'A class most weeks, plus a session on the stuff that’s hard.', popular: true },
        { key: 'working', name: 'Working Dog', price: '$189', credits: 16, fit: 'For dogs who are never tired. Out about twice a week.' },
      ],
    },
    faq: {
      eyebrow: 'FAQ',
      rows: faq([
        ['How do credits work?', 'Your plan adds credits on the same day each month. Every session shows its cost before you book, open play is 1, a group drop-in is 2, a 1:1 with a specialist is 3 to 4.'],
        // The Book tab filters on sociability, not traits, so this says "filter to" rather than "you'll only see" (spec note).
        ['My dog is reactive. Can we still join?', 'Yes. Filter to reactive-dog drop-ins and 1:1s with behavior specialists. Nobody puts your dog in a busy group class.'],
        ['How is this different from daycare?', 'Daycare is a day of free play in a big group. PackPass sessions are short and structured, with a trainer or a purpose, and picked for what your dog needs.'],
        ['Does this replace a trainer?', 'It gives you access to lots of them. Drop in to group classes, book a 1:1 with a specialist when something needs work, and keep it all in one profile.'],
        ['What if a class isn’t a good fit?', 'Tell us in the app. We’ll adjust your dog’s matches, and the trainer’s notes help steer the next pick.'],
        ['Do I stay with my dog?', 'Yes, for most sessions. Some classes are drop-off, where you leave your dog with the trainer. Those are marked before you book.'],
        ['Do unused credits roll over?', 'Unused credits roll into the next month, capped at one month of credits.'],
        ['Can I cancel a booking?', 'Cancel at least 12 hours before the start and the credits go back to your balance. Late cancellations and no-shows use the credits.'],
        ['What does my dog need to join?', 'Current rabies, DHPP and Bordetella records, uploaded once to your dog’s profile. Some classes list extra requirements like a level or minimum age.'],
        ['Can I pause or cancel my plan?', 'Pause for up to 2 months or cancel anytime in the app. Your plan runs to the end of the billing period.'],
        ['Is PackPass outside Austin?', 'Not yet. Join the waitlist with your ZIP code and we’ll tell you when PackPass opens near you.'],
      ]),
    },
    signup: {
      photo: photo('dogs_meeting_on_leash'),
      foundingTitle: 'Join the founding pack.',
      foundingBody: 'Austin’s first members get 2 bonus credits in month one. No 6-week commitment. Pause or cancel anytime.',
      liveTitle: 'Book your dog’s first class this week.',
      liveBody: 'No 6-week commitment. Pause or cancel anytime.',
    },
  },
  partners: {
    hero: {
      eyebrow: 'Trainers · Sport clubs · Behavior specialists · Outdoor spaces',
      headline: 'Fill the empty spots in your classes.',
      body: 'Vetted local dogs, matched to your classes, for the spots you’d otherwise leave empty. You set the rules. We handle booking and pay you every month.',
      cta: 'Apply to partner',
      ctaNote: 'About 10 minutes. Have your license and insurance ready.',
      photo: photo('dog_getting_pets_at_park', 'Dog leaping over a jump'),
      values: [
        { icon: 'Users', title: 'Fill the spots you’d leave empty', body: 'You choose how many spots open to PackPass per session.' },
        { icon: 'ShieldCheck', title: 'Vetted dogs only', body: 'Every dog needs current vaccines, and group classes need a Social clearance. Each one arrives with a profile and any trainer notes.' },
        { icon: 'Banknote', title: 'Paid monthly, no chasing', body: 'A set rate per credit, no-shows included, on the 1st.' },
      ],
    },
    payouts: {
      eyebrow: 'How payouts work',
      title: 'Found money for spots that earn $0 today.',
      body: '$9.50 per credit, so $19 a dog for a typical 2-credit class. No listing fee, no ad spend, and you’re paid for no-shows.',
      steps: [
        { icon: 'CalendarPlus', title: 'A member books', body: 'They find your session by neighborhood, class type or time.' },
        { icon: 'Coins', title: 'Credits are redeemed', body: 'Each session costs 1 to 4 credits based on length and format.' },
        { icon: 'Banknote', title: 'You earn $9.50 each', body: 'Every credit counts, including late cancels and no-shows.' },
        { icon: 'Landmark', title: 'Paid on the 1st', body: 'Last month’s credits land in your bank account.' },
      ],
      example: 'Example: Saturday Agility Foundations, 2 credits, 3 PackPass dogs',
      exampleMath: '2 × 3 × $9.50 = $57',
    },
    calculator: {
      eyebrow: 'Earnings calculator',
      title: 'See what your schedule could earn.',
      gateBody: 'Tell us about your business and we’ll open the calculator.',
      note: 'Estimate at $9.50 per credit and 4.33 weeks a month. Actual payouts depend on bookings and attendance. On top of what your direct clients already pay you.',
    },
    clients: {
      eyebrow: 'Grow your client list',
      title: 'Today’s drop-in. Tomorrow’s private client.',
      body: 'Members try your class with zero risk. When their dog needs more, they can book privates or courses with you directly. PackPass never restricts it and never takes a cut of your direct business.',
    },
    control: {
      eyebrow: 'What you control',
      title: 'Your space. Your rules.',
      body: 'Open as many or as few spots to members as you like. Your direct clients and pricing stay yours.',
      items: [
        { icon: 'ShieldCheck', title: 'Who can book', body: 'Require a Herding rating and dogs without it can’t book. Group classes need a Social clearance, except as a step on a dog’s training path. Add level or age notes members see before booking.' },
        { icon: 'Users', title: 'Capacity', body: 'Set spots per session and how many open to members. Waitlists fill cancellations automatically.' },
        { icon: 'Calendar', title: 'Schedule', body: 'Publish recurring classes or one-off sessions. Change them any time and booked members are notified.' },
        { icon: 'Coins', title: 'Credits per session', body: 'Propose 1 to 4 credits based on length and format.' },
        { icon: 'Clock', title: 'Cancellation window', body: 'Members cancel free up to 12 hours before. Later cancels and no-shows are paid to you.' },
        { icon: 'CalendarCheck', title: 'Bookings run themselves', body: 'Rosters, waitlists, reminders and dog profiles in one dashboard.' },
        { icon: 'UserPlus', title: 'Your team', body: 'Add trainers and staff, each with a verified profile.' },
      ],
    },
    join: {
      eyebrow: 'Getting started',
      title: 'Apply in 10 minutes. Go live in about 2 business days.',
      steps: [
        { title: 'Account', body: 'Name, work email and mobile' },
        { title: 'Business', body: 'Name, address and business type' },
        { title: 'Services', body: 'Sport, scent, play and skills sessions you offer' },
        { title: 'Credentials', body: 'License, insurance and trainer certifications' },
        { title: 'Payouts', body: 'Legal name now; bank and tax details through Stripe once approved' },
        { title: 'Review', body: 'Usually 2 business days, then you go live' },
      ],
      required: [
        { title: 'Business license or registration', body: 'State or city registration in your business name.' },
        { title: 'General liability insurance', body: 'A current certificate covering the space where sessions run.' },
        { title: 'Trainer certification', body: 'CPDT-KA, KPA CTP, IAABC or equivalent, for each lead trainer. Outdoor-space hosts skip this and add a site photo.' },
      ],
      optional: [
        { title: 'Pet first aid and CPR', body: 'Shown as a badge on your profile and classes.' },
        { title: 'Photos of your space', body: 'Members book more when they can see where they’re going.' },
      ],
    },
    faq: {
      eyebrow: 'Partner FAQ',
      rows: faq([
        ['What kind of dogs will show up?', 'Dogs with a complete profile: current vaccine records, temperament traits, and notes from past trainers when they have them. Group classes need a Social clearance to book, unless the class is a step on that dog’s training path.'],
        ['Will this undercut my prices?', 'No. Members book with credits, not a discount on your rate. Your public prices stay the same, and you only open the spots you want filled.'],
        ['Do members become my direct clients?', 'Yes, and we hope they do. Anyone can book privates or courses with you directly. PackPass doesn’t restrict it.'],
        ['What does it cost to list?', 'Nothing to list. PackPass pays you a set rate for every credit a member redeems with you.'],
        ['Who sets the credit cost of a session?', 'You propose 1 to 4 credits per session. PackPass reviews it against duration, intensity and group size, the same way for every partner.'],
        ['Can I keep my existing clients?', 'Yes. Members only fill the spots you open to PackPass. Your direct clients and pricing stay yours.'],
        ['When do I get paid?', 'On the 1st of each month, for every credit redeemed the month before, straight to your bank account.'],
        ['What happens when a member no-shows?', 'Late cancellations and no-shows count as redeemed. You’re paid for the spot.'],
        ['How long does approval take?', 'Usually 2 business days once your credentials are uploaded.'],
      ]),
    },
    close: { title: 'Your next regulars are already nearby.', note: 'Approval usually takes 2 business days.', photo: photo('dog_being_patient') },
  },
};
