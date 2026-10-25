// Client types. These mirror the Supabase schema planned in docs/TECH_SPEC.md §5.

import type { Aptitude } from './breeds';
import type { Energy } from './fixtures';
import type { ActivityKind, Balance, Rating } from './practice';

/** A photo in assets/photos, named for what it shows. */
export type PhotoKey =
  | 'athletic_dog_catching_ball'
  | 'dog_and_owner_chilling'
  | 'dog_being_patient'
  | 'dog_chilling'
  | 'dog_chilling_in_car'
  | 'dog_chilling_with_owner_on_porch'
  | 'dog_getting_pets_at_park'
  | 'dog_providing_good_eye_contact'
  | 'dog_running_on_beach'
  | 'dog_sleeping_while_owner_reads'
  | 'dog_wrapped_in_blanket'
  | 'dogs_meeting_on_leash'
  | 'juno'
  | 'pulling_on_leash';

export type Category = 'Sport' | 'Scent' | 'Play' | 'Skills';
export type SessionType = 'Class' | 'Private' | 'Assessment';
export type BalanceCategory = 'Physical' | 'Mental' | 'Social';
/** Social and Herding, or a clearance PackPass added (its id from clearance_types). */
export type ClearanceType = 'social' | 'herding' | (string & {});

/** A clearance PackPass offers (supabase/migrations/…_clearance_types.sql). */
export interface ClearanceInfo {
  id: string;
  name: string;
  description: string;
  /** network: every partner honours it. partner: only the partner that granted it. */
  scope: 'network' | 'partner';
  expiryMonths: number;
  /** Group classes that need this clearance also need this one (Herding needs Social). */
  groupAlsoRequires: string | null;
}

export interface Partner {
  id: string;
  name: string;
  short: string;
  street: string;
  address: string;
  /** Miles from the member's area or location (src/lib/location.ts). */
  distanceMi: number;
  rating: number;
  parking: string;
  lat?: number;
  lng?: number;
}

export interface Trainer {
  id: string;
  name: string;
  credential: string;
  photo: PhotoSource;
  rating: number;
  /** Live mode: set by the partner on the dashboard. */
  partnerId?: string;
  specialties?: string[];
  privateSessions?: boolean;
}

export interface ClassType {
  id: string;
  title: string;
  discipline: string;
  category: Category;
  sessionType: SessionType;
  credits: number;
  durationMin: number;
  intensity: 1 | 2 | 3 | 4 | 5;
  groupSize: number;
  suits: string;
  suitsNote: string;
  balance: BalanceCategory;
  description: string;
  partnerId: string;
  trainerId: string;
  image: PhotoSource;
  premium?: boolean;
  /** Clearance the dog needs before booking. */
  requires?: ClearanceType;
  /** Clearance an assessment grants. */
  grants?: ClearanceType;
  /** Shown instead of a start time, e.g. open sniff spaces. */
  openWindow?: string;
  /** Owners leave the dog with the trainer and pick up at the end. Every other class, they stay. */
  dropOff: boolean;
  /** False when the partner doesn't ask for their own waiver for this class (the PackPass waiver still applies). */
  waiverRequired?: boolean;
  /** Members cancel free until this many hours before (class_types.cancel_hours). 12 when unset. */
  cancelHours?: number;
  /** Fewest dogs it runs with, checked minCutoffHours before the start; below it the class is called off and refunded. */
  minDogs?: number;
  minCutoffHours?: number;
  requirements: { icon: 'syringe' | 'cake' | 'link' | 'stethoscope' | 'shield'; text: string }[];
  // Who it's for (gates). A dog outside them can't book: src/lib/fit.ts and public.class_gate().
  minAgeMonths?: number;
  maxAgeMonths?: number;
  minWeightLb?: number;
  maxWeightLb?: number;
  /** Spayed or neutered dogs only. */
  requiresFixed?: boolean;
  // Fit (fitFor in src/lib/fit.ts): ranks the class for each dog, never hides it.
  /** Breed aptitudes the class is built for. Dogs that share one see it first with a "Built for" tag. */
  builtFor?: Aptitude[];
  /** PackPass approved "Only these breeds": dogs whose breeds share none of builtFor can't book (unless Assessed fit). */
  breedOnly?: boolean;
  /** Energy levels and sociability ("Loves dogs"…) the partner picked. Empty: judged from intensity and group size. */
  energy?: Energy[];
  sociability?: string[];
}

export interface Session {
  id: string;
  classId: string;
  startsAt: Date;
  spotsLeft: number;
  /** Off: a spot opening tells everyone waiting instead of booking or offering it. Default on. */
  autoPromote?: boolean;
  /** A 1:1 a specialist offered this member after an intake call: theirs alone, booked from the offer (23f). */
  offered?: boolean;
  /** Closed to new bookings: the partner's calendar shows them busy then (…_calendar_sync.sql). */
  closed?: boolean;
}

export type BookingStatus = 'booked' | 'checked_in' | 'cancelled';

export interface Booking {
  id: string;
  sessionId: string;
  dogId: string;
  credits: number;
  status: BookingStatus;
  /** The standing booking (Repeat weekly) this date belongs to. */
  seriesId?: string;
}

/** One date of a standing booking this credit month: booked, cancelled on its own, or short (credits don't cover it). */
export interface SeriesDate {
  sessionId: string;
  startsAt: Date;
  bookingId?: string;
  status: 'booked' | 'cancelled' | 'short';
}

/** A standing booking: the same class, day and time every week, until a date (YYYY-MM-DD) or until credits run out. */
export interface Series {
  id: string;
  dogId: string;
  classId: string;
  until: string | null;
  dates: SeriesDate[];
}

/** A dog waiting for a spot in a full session. place 1 = next in line. offerUntil (ISO): a spot held for it to accept. */
export interface WaitEntry {
  sessionId: string;
  dogId: string;
  place: number;
  offerUntil?: string;
}

/** A training path and the main dog's progress on it (my_paths). Not started: startedAt is null. */
export interface PathProgress {
  id: string;
  title: string;
  lede: string;
  grants: ClearanceType | null;
  startedAt: Date | null;
  /** 1-based step the dog is on; past the last step when complete. */
  nextStep: number;
  completedAt: Date | null;
  /**
   * `options`: the step's Path classes the dog can join (its age, size, breed and spayed or neutered status fit),
   * the step's own class first. `classId` is the first of them, or the step's own class when none fits.
   */
  steps: { position: number; title: string; classId: string; options: string[]; doneAt: Date | null }[];
}

/** A clearance on the dog's Passport, as the partner recorded it. */
export interface ClearanceRecord {
  id: string;
  type: ClearanceType;
  /** Social is valid across the network; Herding only at the partner that assessed it. */
  scope: 'network' | 'partner';
  partnerId: string;
  assessedOn: string;
  expiresOn: string | null;
  assessor: string | null;
  strengths: string[];
  workingOn: string[];
  quote: string | null;
  seen: boolean;
  /** A partner or PackPass sent the dog back for re-assessment: why, and who. The clearance reads as expired. */
  reassess: { reason: string; by: string } | null;
}

/** A session a dog went to (07 Log), with the trainer's note and any assessment result. */
/** Something an owner logged between classes (Log at home, supabase/migrations/…_log_at_home.sql). */
export interface HomeActivity {
  id: string;
  dogId: string;
  kind: ActivityKind;
  doneAt: Date;
  durationMin: number;
  /** Null: Something else with no balance picked. */
  balance: Balance | null;
  /** Skill ids (src/data/practice.ts). */
  skills: string[];
  rating: Rating | null;
  note: string | null;
  drillId: string | null;
  reps: number | null;
}

/** One of the skills a dog is working on (07k), and where it came from. */
export interface FocusSkill {
  skillId: string;
  source: 'trait' | 'path' | 'note' | 'assessment' | 'owner';
}

/** What the Log activity sheet sends: one activity, for one or more dogs. */
export interface HomeActivityInput {
  dogIds: string[];
  kind: ActivityKind;
  doneAt: Date;
  durationMin: number;
  skills: string[];
  rating: Rating | null;
  note: string;
  /** Something else: the balance the owner picked. */
  balance?: Balance | null;
  drillId?: string | null;
  reps?: number | null;
}

/** A homework item on a report card: a drill from the practice catalog, or the trainer's own words (drill null). */
export interface HomeworkItem { text: string; drill: string | null }

/** The trainer's report card after class (22a): ratings 1 to 3, a note and up to three homework items to tick off. */
export interface ReportCard {
  bookingId: string;
  dogId: string;
  sessionId: string;
  classId: string;
  title: string;
  startsAt: Date;
  partner: string;
  trainer: string | null;
  trainerRole: string | null;
  trainerPhoto: PhotoSource;
  discipline: string;
  note: string | null;
  ratings: { focus: number; sociability: number; skill: number };
  homework: HomeworkItem[];
  /** Homework items ticked off, by index. */
  done: number[];
  /** Homework is open until the dog's next class starts. */
  openUntil: Date;
}

export interface LogEntry {
  bookingId: string;
  dogId: string;
  startsAt: Date;
  durationMin: number;
  classId: string;
  title: string;
  image: PhotoSource;
  balance: 'physical' | 'mental' | 'social';
  partner: string;
  trainer: string | null;
  note: string | null;
  skills: string[];
  /** Who wrote the note (the trainer signed in on the dashboard). */
  noteBy: string | null;
  assessment: {
    type: ClearanceType;
    outcome: 'cleared' | 'not_yet';
    quote: string | null;
    strengths: string[];
    workingOn: string[];
    assessor: string;
  } | null;
  /** Nobody checked the dog in or cancelled in time, so the credits were used (a no-show). */
  missed: boolean;
  credits: number;
}

/** A picked vet record, ready to show and upload: a data URI with its original name and type. */
export interface PickedDoc {
  name: string;
  mime: 'image/jpeg' | 'application/pdf';
  uri: string;
}

/** The vet record on file for the main dog. Unverified until a partner or PackPass checks it. */
export interface VaccineRecord {
  name: string;
  verified: boolean;
  /** PackPass's decision on this record; none while it waits for review. */
  review?: { status: 'approved' | 'denied'; reason: string | null; decidedAt: string };
}

/** A waiver members sign once (supabase/migrations/…_waivers.sql). No partner: PackPass's, covering every class. */
export interface Waiver {
  id: string;
  partnerId: string | null;
  title: string;
  /** Up to three short points for the booking sheet ("Ridgeline waiver, in short"). */
  summary: string[];
  /** Pasted text, a PDF, or both. */
  body: string | null;
  pdfPath: string | null;
}

export type ClearanceStatus = 'cleared' | 'expired' | 'working' | 'needs';

/** A bundled sample photo, or an uploaded one (a signed URL, cached by its storage path). */
export type PhotoSource = PhotoKey | { uri: string; cacheKey?: string };

export interface Dog {
  id: string;
  name: string;
  /** None until the member adds one; screens fall back to the dog's initial. */
  photo?: PhotoSource;
  breed: string;
  /** Canonical breeds (src/data/breeds.ts), up to three for a mix. Empty when the owner isn't sure. */
  breedIds?: string[];
  age: string;
  stage: string;
  since: number;
  /** For the class gates (src/lib/fit.ts). Month is 1 to 12. Unknown when missing. */
  birthYear?: number;
  birthMonth?: number;
  weightLb?: number;
  fixed?: boolean;
  /** Partners whose trainers marked the dog Assessed fit: their size and breed gates don't apply. Live mode only. */
  fitPartners?: string[];
  /** From onboarding (01g), for class fit. */
  energy?: Energy;
  /** "Loves dogs", "Selective" or "Prefers solo". */
  social?: string;
  interests?: string[];
  /** What the owner picked in onboarding (01h), e.g. "Pulls on the leash". Live mode only. */
  traits?: string[];
  /** The weekly practice goal (07l): days a week, and when to nudge on days without a class. */
  practiceDays?: number;
  practiceRemind?: PracticeRemind | null;
}

export type PracticeRemind = 'morning' | 'after_work' | 'evening';

export type PlanKey = 'starter' | 'regular' | 'working';

/** The member's plan. `plan` gave this month's credits; `nextPlan` is what the next renewal bills (Stripe). */
export interface Membership {
  plan: PlanKey;
  status: 'none' | 'active' | 'past_due' | 'canceled';
  nextPlan: PlanKey | null;
  /** When credits next refresh: the renewal date with a paid plan, else the 1st. */
  renewsOn: string | null;
  /** Ends at renewsOn instead of renewing. */
  cancels: boolean;
}

/** A specialist taking 15-minute intake calls for 0 credits (23d), with open times over the next two weeks. */
export interface IntakeSpecialist {
  trainerId: string;
  name: string;
  credential: string | null;
  photo: PhotoSource;
  partnerId: string;
  partner: string;
  /** One line on what they help with ("reactivity, new dogs"). */
  focus: string | null;
  /** Takes phone calls as well as video. */
  phone: boolean;
  /** Books through Calendly instead of open times in the app. */
  calendly: boolean;
  slots: { id: string; startsAt: Date }[];
}

/** A booked intake call (23e), or a Calendly request (startsAt null). The link shows 10 minutes before a video call. */
export interface IntakeCall {
  id: string;
  trainerId: string;
  trainer: string;
  trainerPhoto: PhotoSource;
  partner: string;
  dogId: string;
  startsAt: Date | null;
  mode: 'video' | 'phone' | 'calendly';
  status: 'booked' | 'cancelled';
  link: string | null;
}

/** A 1:1 a specialist offered after an intake call (23f): a session only this member sees, booked from the booking sheet. */
export interface PrivateOffer {
  id: string;
  dogId: string;
  sessionId: string;
  classId: string;
  title: string;
  startsAt: Date;
  durationMin: number;
  credits: number;
  cancelHours: number;
  partner: string;
  trainer: string | null;
  trainerPhoto: PhotoSource;
  note: string | null;
  status: 'offered' | 'booked' | 'other_time' | 'expired';
  expiresAt: Date;
}
