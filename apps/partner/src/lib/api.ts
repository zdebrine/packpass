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
  /** Owners leave the dog with the trainer (group classes only). */
  drop_off: boolean;
}
export interface Staff { user_id: string; partner_id: string; trainer_id: string | null; role: 'owner' | 'trainer'; name: string }
export interface Session {
  id: string; class_id: string; starts_at: string; capacity: number; packpass_spots: number; spots_left: number; booked: number; checked_in: number;
  waiting: number; check_in_code: string; waitlist_open: boolean; auto_promote: boolean; cancelled_at: string | null; cancel_reason: string | null;
}
export interface RosterDog {
  booking_id: string; status: 'booked' | 'checked_in' | 'no_show'; checked_in_at: string | null; dog_id: string; dog_name: string; breed: string | null; mixed: boolean;
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

/**
 * Creates an account for someone invited to a team (or a partner applying). Supabase emails a 6-digit
 * code (supabase/templates/confirmation.html); confirming it links any invite waiting for the email.
 */
export async function createAccount(name: string, email: string, password: string) {
  const { data, error } = await db.auth.signUp({ email, password, options: { data: { name: name.trim() } } });
  if (error) throw new Error(error.message);
  // An email that already has a confirmed account gets a stand-in user with no identities and no email.
  if (data.user && !data.user.identities?.length) throw new Error('already_registered');
}
export async function confirmAccount(email: string, code: string) {
  const { error } = await db.auth.verifyOtp({ email, token: code, type: 'signup' });
  if (error) throw new Error(error.message);
}
export async function resendAccountCode(email: string) {
  const { error } = await db.auth.resend({ email, type: 'signup' });
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
// ---- Photos (class covers, trainer photos) -------------------------------------------------------
// Uploads go to the public partner-media bucket under the partner's folder and are stored on the row as that
// path; library photos stay a bare key (src/lib/photos.ts tells them apart).

const PHOTO_MAX_BYTES = 15 * 1024 * 1024;

/** Centre-crops to `aspect` (width / height), scales the long side to at most `max` px and re-encodes as JPEG. */
async function preparePhoto(file: File, aspect: number, max: number): Promise<Blob> {
  const img = await createImageBitmap(file);
  const sw = Math.min(img.width, img.height * aspect), sh = sw / aspect;
  const scale = Math.min(1, max / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale); canvas.height = Math.round(sh * scale);
  canvas.getContext('2d')!.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
  img.close();
  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('bad_file'))), 'image/jpeg', 0.85));
}

/** Uploads a photo for this partner and returns its storage path. Covers are 4:5 like the class cards; trainer photos square. */
export async function uploadPartnerPhoto(partnerId: string, file: File, shape: 'cover' | 'portrait') {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('bad_photo_file');
  if (file.size > PHOTO_MAX_BYTES) throw new Error('photo_too_big');
  const blob = await preparePhoto(file, shape === 'cover' ? 4 / 5 : 1, shape === 'cover' ? 1600 : 800);
  const path = `${partnerId}/${shape}-${crypto.randomUUID()}.jpg`;
  check(await db.storage.from('partner-media').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' }));
  return path;
}

/** Deletes an uploaded photo that's no longer used. Library keys (no slash) are left alone. */
export async function removePartnerPhoto(path: string | null | undefined) {
  if (path?.includes('/')) await db.storage.from('partner-media').remove([path]);
}

export interface PartnerPhoto { kind: 'class' | 'trainer'; id: string; name: string; partner_name: string; path: string }
export const loadPartnerPhotos = async () => check(await db.rpc('admin_partner_photos')) as PartnerPhoto[];
export const setTrainerPhoto = async (id: string, photo: string) => { check(await db.rpc('partner_set_trainer_photo', { p_id: id, p_photo: photo })); };
export const adminRemovePhoto = async (p: { classId?: string; trainerId?: string }, path: string | null) => {
  check(await db.rpc('admin_remove_photo', { p_class: p.classId ?? null, p_trainer: p.trainerId ?? null }));
  await removePartnerPhoto(path);
};

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

// ---- Team (supabase/migrations/…_partner_team.sql; owners only) ----
export interface TeamRow {
  kind: 'staff' | 'invite'; id: string; email: string; name: string | null; role: 'owner' | 'trainer';
  trainer_id: string | null; trainer_name: string | null; is_me: boolean; since: string;
}
export const loadTeam = async () => check(await db.rpc('partner_team')) as TeamRow[];
/** 'linked' when an account already uses the email, else 'invited' (linked once they sign up). */
export const inviteToTeam = async (email: string, role: 'owner' | 'trainer', trainerId: string | null, newTrainer: string | null) =>
  check(await db.rpc('partner_invite', { p_email: email, p_role: role, p_trainer: trainerId, p_new_trainer: newTrainer })) as 'linked' | 'invited';
export const cancelInvite = async (id: string) => { check(await db.rpc('partner_cancel_invite', { p_id: id })); };
export const removeFromTeam = async (userId: string) => { check(await db.rpc('partner_remove_staff', { p_user: userId })); };

// ---- Files ----
/** Signed URLs for dog photos or vet records (staff can read those of dogs booked with them). */
export async function signedUrls(bucket: 'dog-photos' | 'vaccine-docs' | 'partner-docs', paths: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (!unique.length) return {};
  const rows = check(await db.storage.from(bucket).createSignedUrls(unique, 3600)) as { path: string | null; signedUrl: string }[];
  return Object.fromEntries(rows.filter((r) => r.path && r.signedUrl).map((r) => [r.path!, r.signedUrl]));
}

// ---- Partner applications (supabase/migrations/…_partner_applications.sql) ----
export type PartnerType = 'trainer' | 'facility' | 'sport_club' | 'behavior_specialist' | 'outdoor_space';
export type DocKind = 'license' | 'insurance' | 'certs' | 'firstaid' | 'photos';
export interface AppDoc { id: string; kind: DocKind; path: string; file_name: string; size_bytes: number | null }
export interface Application {
  id: string; status: 'draft' | 'submitted' | 'approved' | 'declined'; contact_name: string | null; phone: string | null;
  partner_type: PartnerType | null; business_name: string | null; address: string | null; website: string | null;
  wheres: string[]; services: string[]; formats: string[]; group_size: string | null; legal_name: string | null;
  decline_reason: string | null; submitted_at: string | null; docs: AppDoc[];
}
/** The name the account signed up with, to start an application with. */
export async function accountName() {
  const { data } = await db.auth.getUser();
  if (!data.user) return '';
  const p = check(await db.from('profiles').select('name').eq('id', data.user.id).maybeSingle()) as { name: string } | null;
  return p?.name ?? '';
}
/** The signed-in account's application, or null if it hasn't started one. */
export async function loadMyApplication(): Promise<Application | null> {
  const a = check(await db.from('partner_applications').select('*').maybeSingle()) as Omit<Application, 'docs'> | null;
  if (!a) return null;
  const docs = check(await db.from('partner_application_docs').select('id, kind, path, file_name, size_bytes').eq('application_id', a.id).order('created_at')) as AppDoc[];
  return { ...a, docs };
}
export const saveApplication = async (fields: Partial<Omit<Application, 'id' | 'status' | 'docs' | 'decline_reason' | 'submitted_at'>>) => {
  check(await db.rpc('save_application', { p: fields }));
};
export const DOC_MAX_BYTES = 10 * 1024 * 1024;
/** Uploads to partner-docs/<user id>/… and records it on the application. */
export async function uploadApplicationDoc(kind: DocKind, file: File) {
  if (file.size > DOC_MAX_BYTES) throw new Error('too_big');
  if (!/^(application\/pdf|image\/(jpeg|png))$/.test(file.type)) throw new Error('bad_file');
  const { data: auth } = await db.auth.getUser();
  const safe = file.name.replace(/[^\w.-]+/g, '-').slice(-80);
  const path = `${auth.user!.id}/${kind}-${Date.now()}-${safe}`;
  check(await db.storage.from('partner-docs').upload(path, file, { contentType: file.type }));
  try {
    check(await db.rpc('add_application_doc', { p_kind: kind, p_path: path, p_name: file.name, p_size: file.size }));
  } catch (e) {
    await db.storage.from('partner-docs').remove([path]);
    throw e;
  }
}
export async function removeApplicationDoc(id: string) {
  const path = check(await db.rpc('remove_application_doc', { p_id: id })) as string;
  await db.storage.from('partner-docs').remove([path]);
}
export const submitApplication = async () => { check(await db.rpc('submit_application')); };

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
export const unlinkStaff = async (userId: string) => { check(await db.rpc('admin_unlink_staff', { p_user: userId })); };
export interface AdminApplication extends Omit<Application, 'docs'> { email: string; partner_id: string | null; decided_at: string | null; docs: AppDoc[] }
export const loadApplications = async () => check(await db.rpc('admin_applications')) as AdminApplication[];
export interface PartnerLead { id: string; business_type: string; name: string; business_name: string; email: string; zip: string; created_at: string; applied: boolean }
/** The website's earnings-calculator form, last 90 days. */
export const loadPartnerLeads = async () => check(await db.rpc('admin_partner_leads')) as PartnerLead[];
export interface OwnerSignup { id: string; email: string; zip: string; energy: string | null; traits: string[]; plan: string | null; created_at: string; updated_at: string; founding_paid_at: string | null }
/** The website's founding-pack signup on the owner page, every signup. */
export const loadOwnerWaitlist = async () => check(await db.rpc('admin_owner_waitlist')) as OwnerSignup[];
/** Approve returns the new partner's id. */
export const decideApplication = async (id: string, approve: boolean, reason?: string) =>
  check(await db.rpc('admin_decide_application', { p_id: id, p_approve: approve, p_reason: reason ?? null })) as string | null;

export type VaccineKind = 'rabies' | 'dhpp' | 'bordetella';
export interface AdminVetRecord {
  dog_id: string; dog_name: string; breed: string | null; mixed: boolean; owner_name: string | null; email: string;
  document_path: string; uploaded_at: string | null; vaccines: { type: VaccineKind; expires_on: string; verified: boolean }[];
  status: 'pending' | 'approved' | 'denied'; reason: string | null; decided_at: string | null;
}
/** Vet records waiting for a decision, then the last 30 days of decisions. */
export const loadVetRecords = async () => check(await db.rpc('admin_vet_records')) as AdminVetRecord[];
/** Approve verifies the three vaccines; deny needs a reason, which the member sees. */
export const decideVetRecord = async (dogId: string, approve: boolean, reason?: string) =>
  check(await db.rpc('admin_decide_vet_record', { p_dog: dogId, p_approve: approve, p_reason: reason ?? null }));

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
  no_account: 'No PackPass account uses that email yet. Ask them to choose Create an account on the dashboard sign-in page (or sign up in the app), then link them.',
  bad_trainer: 'That trainer profile belongs to another partner.',
  bad_role: 'Pick owner or trainer.',
  bad_name: 'Add a name.',
  bad_address: 'Add the street address.',
  not_owner: 'Only owners can do this.',
  bad_email: 'Check the email address.',
  needs_trainer: 'Pick their trainer profile, or add a new one.',
  already_staff: 'They\'re already on your team.',
  staff_elsewhere: 'That account is already on another partner\'s team. Ask PackPass to move it.',
  trainer_taken: 'Someone on your team already signs in as that trainer.',
  is_me: 'You can\'t remove yourself. Ask another owner.',
  already_registered: 'There\'s already an account with this email. Sign in instead (or use Set or reset password).',
  incomplete: 'A required detail is missing. Check each step.',
  missing_docs: 'Upload every required document first.',
  submitted: 'Your application is with PackPass. You can edit it again if we ask for changes.',
  already_partner: 'This account is already on a partner\'s team.',
  needs_reason: 'Say why, so they can fix it.',
  too_big: 'That file is over 10 MB.',
  bad_file: 'Upload a PDF, JPG or PNG.',
  bad_photo_file: 'Upload a JPG, PNG or WebP photo.',
  photo_too_big: 'That photo is over 15 MB.',
  bad_photo: 'That photo belongs to another partner.',
};
export const errorCopy = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  if (/invalid login/i.test(m)) return 'That email and password don\'t match. Invited and never set one? Use Set or reset password.';
  if (/only request this after|rate limit/i.test(m)) return 'We just sent a code. Wait a minute before asking for another.';
  if (/expired|invalid.*(token|otp)|token.*invalid/i.test(m)) return 'That code is wrong or has expired. Send a new one.';
  if (/password should be|weak/i.test(m)) return 'Use at least 8 characters for the password.';
  return COPY[m] ?? (m || 'Something went wrong. Try again.');
};

// ---- Payouts (Stripe Connect, through the stripe-connect Edge Function) ----------------------------------

/** 'onboard' returns Stripe's onboarding URL, 'dashboard' a sign-in link to the partner's Stripe dashboard,
 * 'refresh' re-reads the account and returns the new payout status. */
export async function stripeConnect(action: 'onboard' | 'refresh' | 'dashboard'): Promise<{ url?: string; status?: Partner['payout_status'] }> {
  const back = `${window.location.origin}/earnings`;
  const { data, error } = await db.functions.invoke('stripe-connect', { body: { action, back } });
  if (error) {
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(body?.error ?? 'stripe_error');
  }
  return data;
}
