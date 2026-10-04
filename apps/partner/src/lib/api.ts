// Everything the dashboard reads and writes. Reads of the catalog go through row level security; the
// rest are partner functions (supabase/migrations/…_partner_dashboard.sql) that check staff access.
import { check, db } from './supabase';

export type SessionType = 'class' | 'private' | 'assessment';
export interface Partner { id: string; name: string; short_name: string; type: string; street: string; address: string; parking: string | null; meet_at: string | null; rating: number | null; payout_status: 'none' | 'pending' | 'connected'; payout_rate_cents: number }
export interface Trainer { id: string; partner_id: string; name: string; credential: string | null; photo_url: string | null; rating: number | null; bio: string | null; specialties: string[]; private_sessions: boolean }
export interface ClassType {
  id: string; partner_id: string; trainer_id: string | null; title: string; discipline: string; category: 'sport' | 'scent' | 'play' | 'skills';
  session_type: SessionType; credits: number | null; duration_min: number; intensity: number; group_size: number; suits: string | null; suits_note: string | null;
  balance: 'physical' | 'mental' | 'social'; description: string | null; image: string | null; premium: boolean; requires: 'social' | 'herding' | null;
  grants: 'social' | 'herding' | null; open_window: string | null; requirements: { icon: string; text: string }[]; status: 'live' | 'in_review' | 'paused';
  credit_review: boolean; energy: string[]; sociability: string[];
}
export interface Staff { user_id: string; partner_id: string; trainer_id: string | null; role: 'owner' | 'trainer'; name: string }
export interface Session {
  id: string; class_id: string; starts_at: string; capacity: number; packpass_spots: number; spots_left: number; booked: number; checked_in: number;
  waiting: number; check_in_code: string; waitlist_open: boolean; auto_promote: boolean; cancelled_at: string | null; cancel_reason: string | null;
}
export interface RosterDog {
  booking_id: string; status: 'booked' | 'checked_in'; checked_in_at: string | null; dog_id: string; dog_name: string; breed: string | null; mixed: boolean;
  birth_year: number | null; birth_month: number | null; energy: string | null; sociability: string | null; traits: string[]; photo_path: string | null;
  owner_name: string; vaccine_line: string; record_path: string | null; record_verified: boolean; clearances: string[]; last_note: string | null;
}
export interface NoteRow { booking_id: string; session_id: string; starts_at: string; class_title: string; dog_name: string; breed: string | null; owner_name: string; photo_path: string | null; note: string | null; skills: string[]; sent_at: string | null }
export interface AssessmentRow {
  booking_id: string; starts_at: string; class_title: string; grants: 'social' | 'herding'; duration_min: number; dog_id: string; dog_name: string; breed: string | null;
  owner_name: string; photo_path: string | null; traits: string[]; clearances: string[]; outcome: 'cleared' | 'not_yet' | null; strengths: string[]; working_on: string[]; quote: string | null;
}
export interface EarningsMonth { month: string; sessions: number; dogs: number; credits: number; amount_cents: number }
export interface EarningsClass { class_id: string; title: string; dogs: number; credits: number; amount_cents: number }

// ---- Auth ----
export const signIn = async (email: string, password: string) => {
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
};
export const signOut = async () => { await db.auth.signOut(); };
/** Emails a 6-digit code for setting or resetting the password (supabase/templates/recovery.html). */
export const sendPasswordCode = async (email: string) => {
  const { error } = await db.auth.resetPasswordForEmail(email);
  if (error) throw new Error(error.message);
};
/**
 * Sets the password with a code: the one from "Set or reset password", or the one in a PackPass invite
 * email (supabase/templates/invite.html). Either signs the account in.
 */
export async function setPasswordWithCode(email: string, code: string, password: string) {
  const first = await db.auth.verifyOtp({ email, token: code, type: 'recovery' });
  if (first.error) {
    const invite = await db.auth.verifyOtp({ email, token: code, type: 'invite' });
    if (invite.error) throw new Error(first.error.message);
  }
  const { error } = await db.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

/** The signed-in account's staff row and partner, or null if it isn't linked to one. */
export async function loadStaff(): Promise<{ staff: Staff; partner: Partner } | null> {
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return null;
  const row = check(await db.from('partner_staff').select('*').eq('user_id', auth.user.id).maybeSingle()) as Omit<Staff, 'name'> | null;
  if (!row) return null;
  const [partner, profile] = await Promise.all([
    db.from('partners').select('*').eq('id', row.partner_id).single().then(check),
    db.from('profiles').select('name').eq('id', auth.user.id).maybeSingle().then(check),
  ]);
  return { staff: { ...row, name: (profile as { name: string } | null)?.name || auth.user.email || '' }, partner: partner as Partner };
}

// ---- Catalog ----
export const loadClasses = async (partnerId: string) =>
  check(await db.from('class_types').select('*').eq('partner_id', partnerId).order('title')) as ClassType[];
export const loadTrainers = async (partnerId: string) =>
  check(await db.from('trainers').select('*').eq('partner_id', partnerId).order('name')) as Trainer[];
export const saveClass = async (id: string | null, fields: Record<string, unknown>) =>
  check(await db.rpc('partner_save_class', { p_id: id, p: fields })) as string;
export const saveTrainer = async (id: string, bio: string, specialties: string[], privateSessions: boolean) => {
  check(await db.rpc('partner_save_trainer', { p_id: id, p_bio: bio, p_specialties: specialties, p_private: privateSessions }));
};

export const saveLocation = async (parking: string, meetAt: string) => {
  check(await db.rpc('partner_save_location', { p_parking: parking, p_meet_at: meetAt }));
};

// ---- Sessions ----
export const loadSessions = async (from: Date, to: Date) =>
  check(await db.rpc('partner_sessions', { p_from: from.toISOString(), p_to: to.toISOString() })) as Session[];
export const loadRoster = async (sessionId: string) => check(await db.rpc('partner_roster', { p_session: sessionId })) as RosterDog[];
export const loadWaitlist = async (sessionId: string) =>
  check(await db.rpc('partner_waitlist', { p_session: sessionId })) as { dog_name: string; breed: string | null; joined_at: string; place: number }[];
export const checkIn = async (bookingId: string, undo = false) => { check(await db.rpc('partner_check_in', { p_booking: bookingId, p_undo: undo })); };
export const updateSession = async (id: string, capacity: number, packpass: number, waitlistOpen: boolean, autoPromote: boolean) => {
  check(await db.rpc('partner_update_session', { p_session: id, p_capacity: capacity, p_packpass: packpass, p_waitlist_open: waitlistOpen, p_auto_promote: autoPromote }));
};
export const addSession = async (classId: string, startsAt: Date, capacity: number, packpass: number, repeat: boolean) =>
  check(await db.rpc('partner_add_session', { p_class: classId, p_starts_at: startsAt.toISOString(), p_capacity: capacity, p_packpass: packpass, p_repeat: repeat })) as string;
export const cancelSession = async (id: string, reason: string, message: string) =>
  check(await db.rpc('partner_cancel_session', { p_session: id, p_reason: reason, p_message: message })) as number;
export const blockDates = async (from: string, to: string, reason: string, message: string) =>
  (check(await db.rpc('partner_block_dates', { p_from: from, p_to: to, p_reason: reason, p_message: message })) as { sessions: number; dogs: number }[])[0];

// ---- Notes, assessments, vaccines ----
export const loadNotes = async (days = 7) => check(await db.rpc('partner_notes', { p_days: days })) as NoteRow[];
export const sendNote = async (bookingId: string, note: string, skills: string[]) => {
  check(await db.rpc('partner_send_note', { p_booking: bookingId, p_note: note, p_skills: skills }));
};
export const loadAssessments = async () => check(await db.rpc('partner_assessments')) as AssessmentRow[];
export const recordResult = async (bookingId: string, outcome: 'cleared' | 'not_yet', strengths: string[], working: string[], quote: string, goal: boolean) => {
  check(await db.rpc('partner_record_result', { p_booking: bookingId, p_outcome: outcome, p_strengths: strengths, p_working: working, p_quote: quote, p_goal: goal }));
};
export const checkVaccines = async (dogId: string) => { check(await db.rpc('partner_check_vaccines', { p_dog: dogId })); };

// ---- Earnings ----
export const loadEarnings = async (months = 6) => check(await db.rpc('partner_earnings', { p_months: months })) as EarningsMonth[];
export const loadEarningsByClass = async () => check(await db.rpc('partner_earnings_by_class')) as EarningsClass[];

// ---- Files ----
/** Signed URLs for dog photos or vet records (staff can read those of dogs booked with them). */
export async function signedUrls(bucket: 'dog-photos' | 'vaccine-docs', paths: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (!unique.length) return {};
  const rows = check(await db.storage.from(bucket).createSignedUrls(unique, 3600)) as { path: string | null; signedUrl: string }[];
  return Object.fromEntries(rows.filter((r) => r.path && r.signedUrl).map((r) => [r.path!, r.signedUrl]));
}

// ---- PackPass admin (supabase/migrations/…_admin.sql) ----
export interface ReviewClass {
  id: string; partner_id: string; partner_name: string; trainer_name: string | null; title: string; discipline: string; session_type: SessionType;
  duration_min: number; intensity: number; group_size: number; credits: number | null; premium: boolean; status: ClassType['status'];
  credit_review: boolean; description: string | null; image: string | null; energy: string[]; sociability: string[];
  requires: 'social' | 'herding' | null; grants: 'social' | 'herding' | null;
}
export interface AdminPartner {
  id: string; name: string; short_name: string; type: string; street: string; address: string; lat: number | null; lng: number | null;
  parking: string | null; meet_at: string | null; payout_rate_cents: number; payout_status: string; staff: number; trainers: number; live_classes: number; in_review: number;
}
export interface AdminTrainer { id: string; partner_id: string; name: string; credential: string | null; specialties: string[]; classes: number }
export interface AdminStaff { user_id: string; email: string; name: string | null; partner_id: string; partner_name: string; role: 'owner' | 'trainer'; trainer_id: string | null; trainer_name: string | null }

export const isAdmin = async () => (check(await db.rpc('is_packpass_admin')) as boolean) === true;
export const loadReviewQueue = async () => check(await db.rpc('admin_review_queue')) as ReviewClass[];
export const setClassReview = async (id: string, credits: number | null, premium: boolean, status: 'live' | 'paused' | 'in_review') => {
  check(await db.rpc('admin_set_class', { p_class: id, p_credits: credits, p_premium: premium, p_status: status }));
};
export const loadAdminPartners = async () => check(await db.rpc('admin_partners')) as AdminPartner[];
export const saveAdminPartner = async (id: string | null, fields: Record<string, unknown>) => check(await db.rpc('admin_save_partner', { p_id: id, p: fields })) as string;
export const loadAdminTrainers = async () => check(await db.rpc('admin_trainers')) as AdminTrainer[];
export const saveAdminTrainer = async (id: string | null, partnerId: string, name: string, credential: string) =>
  check(await db.rpc('admin_save_trainer', { p_id: id, p_partner: partnerId, p_name: name, p_credential: credential })) as string;
export const loadAdminStaff = async () => check(await db.rpc('admin_staff')) as AdminStaff[];
export const linkStaff = async (email: string, partnerId: string, role: 'owner' | 'trainer', trainerId: string | null) => {
  check(await db.rpc('admin_link_staff', { p_email: email, p_partner: partnerId, p_role: role, p_trainer: trainerId }));
};

/** Copy for the reason codes the partner functions raise. */
const COPY: Record<string, string> = {
  not_partner: 'This account isn\'t linked to a partner yet.',
  below_booked: 'PackPass spots can\'t go below the dogs already booked. Cancel bookings from the roster first.',
  bad_capacity: 'Capacity has to be at least the PackPass spots, and at most 40.',
  not_live: 'This class is still in review.',
  started: 'That time has already passed.',
  bad_range: 'Pick a range of up to 60 days.',
  empty_note: 'Write a sentence or two first.',
  too_early: 'Results can be recorded once the session has started.',
  already_recorded: 'A result is already recorded for this booking.',
  vaccines: 'This dog doesn\'t have all three vaccines on file.',
  bad_title: 'Give the class a name.',
  not_found: 'That isn\'t available any more. Refresh and try again.',
  not_admin: 'Only PackPass admins can do this.',
  bad_credits: 'Set a credit cost between 1 and 20 to put the class live.',
  bad_status: 'Pick live, paused or back to review.',
  no_account: 'No PackPass account uses that email yet. Ask them to sign up in the app first (or invite them from Supabase), then link them.',
  bad_trainer: 'That trainer profile belongs to another partner.',
  bad_role: 'Pick owner or trainer.',
  bad_name: 'Add a name.',
  bad_address: 'Add the street address.',
};
export const errorCopy = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  if (/invalid login/i.test(m)) return 'That email and password don\'t match. Invited and never set one? Use Set or reset password.';
  if (/only request this after|rate limit/i.test(m)) return 'We just sent a code. Wait a minute before asking for another.';
  if (/expired|invalid.*(token|otp)|token.*invalid/i.test(m)) return 'That code is wrong or has expired. Send a new one.';
  if (/password should be|weak/i.test(m)) return 'Use at least 8 characters for the password.';
  return COPY[m] ?? (m || 'Something went wrong. Try again.');
};
