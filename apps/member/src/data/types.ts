// Client types. These mirror the Supabase schema planned in docs/TECH_SPEC.md §5.

export type PhotoKey =
  | 'collie' | 'grass' | 'hurdle' | 'juno' | 'lab' | 'leap' | 'rail' | 'sprint' | 'tunnel' | 'wall' | 'weave';

export type Category = 'Sport' | 'Scent' | 'Play' | 'Skills';
export type SessionType = 'Class' | 'Private' | 'Assessment';
export type BalanceCategory = 'Physical' | 'Mental' | 'Social';
export type ClearanceType = 'social' | 'herding';

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
  photo: PhotoKey;
  rating: number;
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
  image: PhotoKey;
  premium?: boolean;
  /** Clearance the dog needs before booking. */
  requires?: ClearanceType;
  /** Clearance an assessment grants. */
  grants?: ClearanceType;
  /** Shown instead of a start time, e.g. open sniff spaces. */
  openWindow?: string;
  requirements: { icon: 'syringe' | 'cake' | 'link'; text: string }[];
}

export interface Session {
  id: string;
  classId: string;
  startsAt: Date;
  spotsLeft: number;
}

export type BookingStatus = 'booked' | 'checked_in' | 'cancelled';

export interface Booking {
  id: string;
  sessionId: string;
  dogId: string;
  credits: number;
  status: BookingStatus;
}

/** A dog waiting for a spot in a full session. place 1 = next in line. */
export interface WaitEntry {
  sessionId: string;
  dogId: string;
  place: number;
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
  steps: { position: number; title: string; classId: string; doneAt: Date | null }[];
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
}

/** A session a dog went to (07 Log), with the trainer's note and any assessment result. */
export interface LogEntry {
  bookingId: string;
  dogId: string;
  startsAt: Date;
  durationMin: number;
  classId: string;
  title: string;
  image: PhotoKey;
  balance: 'physical' | 'mental' | 'social';
  partner: string;
  trainer: string | null;
  note: string | null;
  skills: string[];
  /** Who wrote the note (the trainer signed in on the dashboard). */
  noteBy: string | null;
  assessment: {
    type: 'social' | 'herding';
    outcome: 'cleared' | 'not_yet';
    quote: string | null;
    strengths: string[];
    workingOn: string[];
    assessor: string;
  } | null;
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
  age: string;
  stage: string;
  since: number;
  /** What the owner picked in onboarding (01h), e.g. "Pulls on the leash". Live mode only. */
  traits?: string[];
}
