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
  distanceMi: number;
  rating: number;
  parking: string;
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

export type ClearanceStatus = 'cleared' | 'expired' | 'working' | 'needs';

export interface Dog {
  id: string;
  name: string;
  photo: PhotoKey;
  breed: string;
  age: string;
  stage: string;
  since: number;
}
