// Privacy policy, membership terms and support, served at /privacy, /terms and /support. Kept in code rather than
// Sanity so every change is reviewed in a PR and the "Last updated" date moves with it. The app stores and both
// apps link here. DRAFT: have a lawyer read the waiver and liability sections before launch.

export const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) || 'support@packpass.app';
const UPDATED = 'October 6, 2026';

/** A section is a heading and paragraphs; a paragraph starting with "- " is one bullet of a list. */
export type LegalSection = { heading: string; body: string[] };
export type LegalDoc = { title: string; updated: string; intro: string; sections: LegalSection[] };

export const PRIVACY: LegalDoc = {
  title: 'Privacy policy',
  updated: UPDATED,
  intro:
    'PackPass ("we", "us") runs the PackPass app, the partner dashboard and this website. This policy says what we collect, why, who sees it and how to delete it. We don\'t sell your information and we don\'t show ads.',
  sections: [
    {
      heading: 'What we collect',
      body: [
        '- Account: your name, email address and password (stored hashed by our sign-in provider).',
        '- Your dog: name, photo, breed, birthday, weight, whether they\'re fixed, energy, how they get on with other dogs, interests and traits, and the area they train near.',
        '- Vaccines: expiry dates for Rabies, DHPP and Bordetella, and the vet record you upload.',
        '- Activity: bookings, waitlists, held spots, check-ins, credits, training paths, and the notes, assessment results and clearances partners record about your dog.',
        '- Payments: your plan, top-ups and payment status. Card details go straight to Stripe; we never see or store your card number.',
        '- Device: a push notification token if you allow notifications. If you choose "My location" for distances, your position is used on your phone and is not sent to us.',
        '- Website: the email, ZIP code and dog details you enter in the founding pack or partner forms.',
        '- Partners: business and contact details, trainer profiles and photos, application documents (such as insurance and certifications) and the details Stripe needs to pay you.',
      ],
    },
    {
      heading: 'How we use it',
      body: [
        '- To run your membership: show classes that fit your dog, book and check you in, keep your credits and bill your plan.',
        '- To keep classes safe: partners check vaccines and clearances before a dog joins a group.',
        '- To send you sign-in codes, booking updates and reminders by email and push notification.',
        '- To pay partners for the sessions members attend.',
        '- To answer support requests, prevent fraud and keep the service working.',
      ],
    },
    {
      heading: 'Who sees it',
      body: [
        'Partners you book with see your name, your dog\'s profile, vaccine dates and vet record, clearances, and their own notes and results for your dog. Other members never see your information.',
        'We use service providers who process data for us under contract: Supabase (database, sign-in and file storage, United States), Stripe (payments and partner payouts), Resend (email), Expo (push notifications), Vercel (website hosting) and Sanity (website copy, no member data).',
        'We share information with authorities only when the law requires it, or to protect someone\'s safety.',
      ],
    },
    {
      heading: 'How long we keep it',
      body: [
        'We keep your information while your account is open. When you delete your account, your profile, dogs, photos, vet records, bookings and credits are deleted straight away. Payment records stay with Stripe for as long as tax and accounting law requires.',
      ],
    },
    {
      heading: 'Your choices',
      body: [
        '- Delete your account any time in the app: Settings › Account › Delete account.',
        '- Edit your name, email, password and dog details in the app.',
        '- Turn push notifications and location off in your phone\'s settings.',
        `- Ask for a copy of your information, or ask us to correct or delete it, by writing to ${SUPPORT_EMAIL}. We answer within 30 days.`,
      ],
    },
    {
      heading: 'Security',
      body: [
        'Data is encrypted in transit and at rest. Row level security in our database means each member can reach only their own records, and partners only the dogs booked with them. Vet records and dog photos are stored privately and shown through short-lived links.',
      ],
    },
    {
      heading: 'Children',
      body: ['PackPass is for adults 18 and over. We don\'t knowingly collect information from children.'],
    },
    {
      heading: 'Changes and contact',
      body: [
        `We\'ll tell you in the app or by email before a change that affects how we use your information. Questions: ${SUPPORT_EMAIL}.`,
      ],
    },
  ],
};

export const TERMS: LegalDoc = {
  title: 'Membership terms',
  updated: UPDATED,
  intro:
    'These terms are the agreement between you and PackPass when you use the PackPass app, website or partner dashboard. By creating an account you agree to them. Please read the "Your dog and risk" section carefully: it limits your right to sue.',
  sections: [
    {
      heading: 'What PackPass is',
      body: [
        'PackPass is a membership that lets you book classes, assessments and private sessions for your dog with independent trainers, facilities and clubs ("partners"). Partners run their own sessions and are responsible for them. PackPass is not a trainer, vet or behaviorist and doesn\'t supervise sessions.',
        'You must be 18 or older and the owner or legal guardian of the dog you book for.',
      ],
    },
    {
      heading: 'Plans, credits and payment',
      body: [
        '- Plans renew monthly: Starter ($79, 6 credits), Regular ($129, 10 credits) and Working Dog ($189, 16 credits). Prices include any fees and may change with 30 days\' notice.',
        '- Each session costs the number of credits shown before you book. Extra credits can be bought in packs of 2 for $26.',
        '- At each renewal your plan\'s credits are added. Unused credits carry over, up to one month of your plan\'s credits; anything above that expires.',
        '- New members get a one-time trial of 2 credits. After that, credits come from a plan or a top-up.',
        '- Payments are processed by Stripe. If a payment fails, Stripe retries it; if it still fails, your plan ends and you keep the credits you already have until they expire.',
        '- Cancel any time in the app (Settings › Plan and credits). Your plan ends at the end of the period you paid for, and your credits stay usable until then. Payments already made aren\'t refunded, except where the law requires.',
        '- The Founding Pack is the Starter plan with 2 bonus credits in the first month.',
      ],
    },
    {
      heading: 'Booking, cancelling and no-shows',
      body: [
        '- Cancel free up to 12 hours before a session and your credits come back. Inside 12 hours, or if you don\'t show up, the credits are used.',
        '- If you join a waitlist, you may be booked and charged automatically when a spot opens more than 12 hours before the start. You can still cancel free until 12 hours before.',
        '- Spots held for a dog awaiting an assessment are released 24 hours before the session unless you book them.',
        '- If a partner cancels a session, all credits are returned.',
        '- Arrive on time with your dog on a leash, and check in with the code at the partner\'s entrance.',
      ],
    },
    {
      heading: 'Your dog',
      body: [
        '- Your dog must have current Rabies, DHPP and Bordetella vaccines on the day of the session, and you must give true dates and a genuine vet record.',
        '- Group classes need a Social clearance from a PackPass assessment, except sessions on your dog\'s own training path. Some classes need other clearances.',
        '- Tell the partner about any history of biting, aggression, illness, injury or heat. Don\'t bring a dog who is sick, injured, in heat or has bitten a person or dog in a way you haven\'t disclosed.',
        '- Follow the partner\'s instructions. A partner may refuse or remove a dog they believe is unsafe or unwell, and the credits are not returned in that case.',
        '- You are responsible for your dog\'s behavior, and for any injury or damage your dog causes to people, other dogs or property.',
      ],
    },
    {
      heading: 'Your dog and risk (waiver)',
      body: [
        'Dog training and dog sports involve physical activity and contact with other dogs and people. Risks include bites, scratches, falls, strains and other injuries, illness passed between dogs, lost or escaped dogs, and, rarely, serious injury or death, to your dog or to you.',
        'You choose to take part, and you accept these risks for yourself and your dog. To the fullest extent the law allows, you release PackPass and its team from claims arising from your or your dog\'s participation in sessions booked through PackPass, except claims caused by our gross negligence or willful misconduct.',
        'You agree to cover PackPass\'s reasonable costs, including legal fees, from claims brought by others because of your dog\'s behavior or your breach of these terms.',
      ],
    },
    {
      heading: 'Partners',
      body: [
        'Partners are independent businesses, not employees or agents of PackPass. We check applications, insurance and certifications before partners join, but we don\'t guarantee their sessions. Partners who join PackPass also agree to the partner terms below.',
      ],
    },
    {
      heading: 'Partner terms',
      body: [
        '- You run your sessions safely and lawfully, hold the insurance and certifications you applied with, and keep them current.',
        '- You check vaccines and clearances before a dog joins a group, and record attendance, notes and assessment results honestly.',
        '- PackPass pays $9.50 for each credit members spend on your sessions, including late cancellations and no-shows, by Stripe on the 1st of the following month. You need a Stripe account to be paid.',
        '- Photos and text you upload must be yours to use. You allow PackPass to show them in the app, on the website and in PackPass marketing. We may remove anything that breaks these terms.',
      ],
    },
    {
      heading: 'Your account and content',
      body: [
        'Keep your password private; you\'re responsible for what happens in your account. Photos and details you add stay yours; you allow us to store and show them to run the service. We may suspend or close an account that breaks these terms, puts dogs or people at risk, or misuses payments.',
      ],
    },
    {
      heading: 'Liability',
      body: [
        'PackPass is provided "as is". To the fullest extent the law allows, PackPass isn\'t liable for indirect or consequential losses, and our total liability to you is limited to the amount you paid us in the 3 months before the claim. Nothing in these terms limits liability that can\'t be limited by law.',
      ],
    },
    {
      heading: 'Disputes and changes',
      body: [
        'These terms are governed by the laws of the State of Texas. Before going to court, contact us and we\'ll try to resolve the problem within 30 days. Disputes go to the state or federal courts in Travis County, Texas.',
        `We may update these terms. We\'ll tell you in the app or by email at least 14 days before a change takes effect; continuing to use PackPass after that means you accept it. Questions: ${SUPPORT_EMAIL}.`,
      ],
    },
  ],
};

export const SUPPORT: LegalDoc = {
  title: 'Support',
  updated: UPDATED,
  intro: `Write to ${SUPPORT_EMAIL} and a person will answer, usually within one business day. Tell us the email on your account and, for a booking, the class and time.`,
  sections: [
    {
      heading: 'Members',
      body: [
        '- Cancel a booking: open the class from Today or Log and tap Cancel booking. It\'s free until 12 hours before.',
        '- Change or cancel your plan, or buy credits: Settings › Plan and credits.',
        '- Didn\'t get your sign-in code? Check spam, then ask for a new code after a minute.',
        '- Forgot your password: on Sign in, tap Forgot password.',
        '- Update vaccines: Dog tab › Vaccines. Bookings need all three current on the day.',
        '- Delete your account: Settings › Account › Delete account.',
      ],
    },
    {
      heading: 'Partners',
      body: [
        '- Sign in to the partner dashboard with the email you applied with.',
        '- Payouts arrive on the 1st for the previous month. Set up or check Stripe under Earnings.',
        '- To add a teammate, use Team in the dashboard.',
      ],
    },
    {
      heading: 'Safety',
      body: [
        'If a dog or person was hurt at a session, tell the partner on the spot and write to us the same day. In an emergency, call 911 or your nearest emergency vet first.',
      ],
    },
  ],
};
