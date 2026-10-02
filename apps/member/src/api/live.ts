// Live mode: reads and writes go to Supabase. Every function here has a sample-data twin in the
// store (src/store/app.ts), so the screens don't care which mode they run in.

import { setCatalog } from '@/data/catalog';
import type { Goal, Notif } from '@/data/passport';
import type { Booking, ClassType, Dog, Partner, PhotoKey, PickedDoc, Session, Trainer, VaccineRecord, WaitEntry } from '@/data/types';
import type { OnboardingDraft, SocialStage } from '@/store/app';
import { base64ToBytes } from '@/lib/base64';
import { db } from './client';

const PHOTOS: PhotoKey[] = ['collie', 'grass', 'hurdle', 'juno', 'lab', 'leap', 'rail', 'sprint', 'tunnel', 'wall', 'weave'];
const photo = (k: string | null | undefined, fallback: PhotoKey): PhotoKey => (PHOTOS.includes(k as PhotoKey) ? (k as PhotoKey) : fallback);
/** Miles from the member's area. Until the app asks for location, that's Austin · South. */
const HOME = [30.229, -97.788];
function miles(lat?: number | null, lng?: number | null) {
  if (lat == null || lng == null) return 0;
  const r = (x: number) => (x * Math.PI) / 180;
  const a = Math.sin(r(lat - HOME[0]) / 2) ** 2 + Math.cos(r(HOME[0])) * Math.cos(r(lat)) * Math.sin(r(lng - HOME[1]) / 2) ** 2;
  return Math.round(3958.8 * 2 * Math.asin(Math.sqrt(a)) * 10) / 10;
}

const cap = <T extends string>(s: string) => (s.charAt(0).toUpperCase() + s.slice(1)) as T;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function check(r: { data: any; error: { message: string } | null }): any {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

// ---- Auth ----------------------------------------------------------------------------------

export async function signUp(email: string, password: string, name: string) {
  check(await db().auth.signUp({ email, password, options: { data: { name } } }));
}

/** Confirms the 6-digit code from the sign-up email (01d). */
export async function verifyEmail(email: string, token: string) {
  check(await db().auth.verifyOtp({ email, token, type: 'signup' }));
}

export async function resendCode(email: string) {
  check(await db().auth.resend({ type: 'signup', email }));
}

/** Emails a 6-digit reset code (supabase/templates/recovery.html). Succeeds whether or not the account exists. */
export async function requestPasswordReset(email: string) {
  check(await db().auth.resetPasswordForEmail(email));
}

/** Checks the reset code, which signs the member in, then sets the new password. */
export async function resetPassword(email: string, token: string, password: string) {
  check(await db().auth.verifyOtp({ email, token, type: 'recovery' }));
  check(await db().auth.updateUser({ password }));
}

export async function signIn(email: string, password: string) {
  check(await db().auth.signInWithPassword({ email, password }));
}

/** Signs out, first unlinking this device so the next person to use it doesn't get this member's pushes. */
export async function signOut(pushToken?: string | null) {
  if (pushToken) await db().from('push_tokens').delete().eq('token', pushToken);
  await db().auth.signOut();
}

export async function hasSession() {
  const { data } = await db().auth.getSession();
  return !!data.session;
}

// ---- Catalog -------------------------------------------------------------------------------

/** Loads partners, trainers, classes and the next 4 weeks of sessions into the shared catalog. */
export async function loadCatalog() {
  const c = db();
  const [partners, trainers, classes, sessions] = await Promise.all([
    c.from('partners').select('*').then(check),
    c.from('trainers').select('*').then(check),
    c.from('class_types').select('*').then(check),
    c.from('sessions').select('id, class_id, starts_at, spots_left')
      .gte('starts_at', new Date(Date.now() - 86_400_000).toISOString())
      .lte('starts_at', new Date(Date.now() + 29 * 86_400_000).toISOString())
      .order('starts_at')
      .then(check),
  ]);
  setCatalog({
    partners: Object.fromEntries((partners as any[]).map((p): [string, Partner] => [p.id, {
      id: p.id, name: p.name, short: p.short_name, street: p.street, address: p.address,
      distanceMi: miles(p.lat, p.lng), rating: Number(p.rating ?? 0), parking: p.parking ?? '',
    }])),
    trainers: Object.fromEntries((trainers as any[]).map((t): [string, Trainer] => [t.id, {
      id: t.id, name: t.name, credential: t.credential ?? '', photo: photo(t.photo_url, 'lab'), rating: Number(t.rating ?? 0),
    }])),
    classes: Object.fromEntries((classes as any[]).map((k): [string, ClassType] => [k.id, {
      id: k.id, title: k.title, discipline: k.discipline, category: cap(k.category), sessionType: cap(k.session_type),
      credits: k.credits, durationMin: k.duration_min, intensity: k.intensity, groupSize: k.group_size,
      suits: k.suits ?? '', suitsNote: k.suits_note ?? '', balance: cap(k.balance), description: k.description ?? '',
      partnerId: k.partner_id, trainerId: k.trainer_id, image: photo(k.image, 'weave'), premium: k.premium,
      requires: k.requires ?? undefined, grants: k.grants ?? undefined, openWindow: k.open_window ?? undefined,
      requirements: k.requirements ?? [],
    }])),
    sessions: (sessions as any[]).map((s): Session => ({ id: s.id, classId: s.class_id, startsAt: new Date(s.starts_at), spotsLeft: s.spots_left })),
  });
}

// ---- Member --------------------------------------------------------------------------------

export interface MemberSnapshot {
  name: string;
  credits: number;
  dogs: Dog[];
  bookings: Booking[];
  social: SocialStage;
  socialExpired: boolean;
  socialClearanceId: string | null;
  herdingAt: string[];
  activePaths: Goal['id'][];
  vaccines: { type: 'Rabies' | 'DHPP' | 'Bordetella'; expires: string }[];
  notifications: Notif[];
  readNotifications: string[];
  /** Sessions held for the main dog until its Social assessment. */
  holds: string[];
  waitlist: WaitEntry[];
  /** The main dog's vet record, if one was uploaded. */
  vaccineRecord: VaccineRecord | null;
}

const ageOf = (year?: number | null, month?: number | null) => {
  if (!year) return { age: '', stage: '' };
  const now = new Date();
  const months = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - (month ?? 1));
  const yrs = Math.floor(months / 12);
  return { age: months < 12 ? 'Puppy' : `${yrs} yrs`, stage: months < 12 ? '' : yrs < 8 ? 'Prime' : 'Senior' };
};

function relTime(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 5) return 'Just now';
  if (mins < 60) return `${mins}m`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)}h`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export async function loadMember(): Promise<MemberSnapshot | null> {
  const c = db();
  const { data: auth } = await c.auth.getUser();
  if (!auth.user) return null;
  const profile = check(await c.from('profiles').select('*').eq('id', auth.user.id).single()) as any;
  const dogs = check(await c.from('dogs').select('*').order('created_at')) as any[];
  const dogIds = dogs.map((d) => d.id);
  const main = dogs[0]?.id ?? null;
  // dog-photos is private: show uploads through signed URLs, cached by path so a fresh URL doesn't refetch.
  const photoPaths = dogs.map((d) => d.photo_path).filter(Boolean) as string[];
  const signed = photoPaths.length ? (check(await c.storage.from('dog-photos').createSignedUrls(photoPaths, PHOTO_URL_TTL)) as { path: string; signedUrl: string }[]) : [];
  const photoUrl = new Map(signed.map((x) => [x.path, x.signedUrl]));
  const [bookings, clearances, paths, vaccines, notes, holds, waiting] = await Promise.all([
    c.from('bookings').select('*').neq('status', 'cancelled').then(check),
    c.from('clearances').select('*').in('dog_id', dogIds).then(check),
    c.from('dog_paths').select('*').in('dog_id', dogIds).then(check),
    c.from('vaccinations').select('*').in('dog_id', dogIds).then(check),
    c.from('notifications').select('*').order('created_at', { ascending: false }).limit(50).then(check),
    c.from('held_spots').select('session_id, dog_id, expires_at').eq('status', 'held').gt('expires_at', new Date().toISOString()).then(check),
    c.rpc('my_waitlist').then(check),
  ]) as any[][];

  const today = new Date().toISOString().slice(0, 10);
  const mine = (rows: any[]) => rows.filter((r) => r.dog_id === main);
  const social = mine(clearances).filter((k) => k.type === 'social').sort((a, b) => (a.assessed_on < b.assessed_on ? 1 : -1))[0];
  const socialValid = social && (!social.expires_on || social.expires_on >= today);
  const vax = mine(vaccines);

  return {
    name: profile.name,
    credits: profile.credits_balance,
    dogs: dogs.map((d) => ({
      id: d.id, name: d.name, photo: photoUrl.has(d.photo_path) ? { uri: photoUrl.get(d.photo_path)!, cacheKey: d.photo_path } : undefined, breed: d.mixed ? 'Mixed breed' : d.breed ?? '',
      ...ageOf(d.birth_year, d.birth_month), since: d.member_since,
    })),
    bookings: bookings.map((b) => ({ id: b.id, sessionId: b.session_id, dogId: b.dog_id, credits: b.credits_charged, status: b.status === 'checked_in' ? 'checked_in' : 'booked' })),
    social: !social ? 'working' : social.seen_at ? 'cleared' : 'earned',
    socialExpired: !!social && !socialValid,
    socialClearanceId: social?.id ?? null,
    herdingAt: mine(clearances).filter((k) => k.type === 'herding' && (!k.expires_on || k.expires_on >= today)).map((k) => k.partner_id),
    activePaths: mine(paths).filter((p) => !p.completed_at).map((p) => p.path_id),
    vaccineRecord: recordOf(vax),
    vaccines: vax.map((v) => ({ type: ({ rabies: 'Rabies', dhpp: 'DHPP', bordetella: 'Bordetella' } as const)[v.type as 'rabies'], expires: v.expires_on })),
    notifications: notes.map((n): Notif => ({
      id: n.id,
      icon: n.kind === 'clearance_earned' ? 'shield-check' : n.kind === 'booked' ? 'calendar-check' : n.kind === 'waitlist_booked' ? 'calendar-check' : n.kind.startsWith('waitlist') || n.kind.startsWith('hold') ? 'clock' : 'message-square',
      tone: n.kind === 'clearance_earned' ? 'clr' : 'n',
      title: n.title, body: n.body, time: relTime(n.created_at),
      cat: cap(n.category), isNew: Date.now() - new Date(n.created_at).getTime() < 3 * 86_400_000 || !n.read_at,
      href: n.href ?? undefined,
    })),
    readNotifications: notes.filter((n) => n.read_at).map((n) => n.id),
    holds: mine(holds).map((h) => h.session_id),
    waitlist: waiting.map((w) => ({ sessionId: w.session_id, dogId: w.dog_id, place: w.place })),
  };
}

// ---- Writes --------------------------------------------------------------------------------

const ENERGY: Record<string, string> = { Couch: 'couch', Medium: 'medium', High: 'high', 'Working dog': 'working' };
const SOCIABILITY: Record<string, string> = { 'Loves dogs': 'loves_dogs', Selective: 'selective', 'Prefers solo': 'prefers_solo' };
/** Traits that start a training path at sign-up (same as PLAN_GOALS in fixtures). */
const TRAIT_PATHS: Record<string, Goal['id']> = { 'Nervous with new dogs': 'calm-around-dogs', 'Pulls on the leash': 'loose-leash-walking' };

/** Saves the onboarding dog and starts the paths its traits point to. */
export async function createDog(d: OnboardingDraft) {
  const c = db();
  const { data: auth } = await c.auth.getUser();
  if (!auth.user) throw new Error('not_signed_in');
  const dog = check(await c.from('dogs').insert({
    owner_id: auth.user.id, name: d.dogName.trim(), sex: d.sex.toLowerCase(), breed: d.breed || null, mixed: d.mixed,
    birth_month: d.birthMonth + 1, birth_year: d.birthYear, weight_lb: d.weight, fixed: d.fixed,
    energy: ENERGY[d.energy], sociability: SOCIABILITY[d.social], interests: d.interests, traits: d.traits,
  }).select('id').single()) as { id: string };
  for (const t of d.traits) {
    if (TRAIT_PATHS[t]) check(await c.rpc('start_path', { p_dog: dog.id, p_path: TRAIT_PATHS[t] }));
  }
  return dog.id;
}

/** Signed photo URLs last a week; every load signs fresh ones. */
const PHOTO_URL_TTL = 7 * 24 * 3600;

/**
 * Uploads a dog's photo (a JPEG data URI from pickDogPhoto) to dog-photos/<member>/<dog>/<time>.jpg,
 * points the dog at it and removes the previous one. Storage rules only allow the member's own folder.
 */
export async function uploadDogPhoto(dogId: string, dataUri: string) {
  const c = db();
  const { data: auth } = await c.auth.getUser();
  if (!auth.user) throw new Error('not_signed_in');
  const before = check(await c.from('dogs').select('photo_path').eq('id', dogId).single()) as { photo_path: string | null };
  const path = `${auth.user.id}/${dogId}/${Date.now()}.jpg`;
  check(await c.storage.from('dog-photos').upload(path, base64ToBytes(dataUri.slice(dataUri.indexOf(',') + 1)), { contentType: 'image/jpeg' }));
  check(await c.from('dogs').update({ photo_path: path }).eq('id', dogId));
  if (before.photo_path) await c.storage.from('dog-photos').remove([before.photo_path]);
}

/** Vet records are stored as <member>/<dog>/<time>-<original name>. */
const recordName = (path: string) => path.slice(path.lastIndexOf('/') + 1).replace(/^\d+-/, '');
function recordOf(vax: { document_path: string | null; verified: boolean }[]): VaccineRecord | null {
  const path = vax.find((v) => v.document_path)?.document_path;
  return path ? { name: recordName(path), verified: vax.length > 0 && vax.every((v) => v.verified) } : null;
}

/**
 * Uploads the vet record (one photo or PDF covering all three vaccines) to vaccine-docs and links it
 * to the dog's vaccination rows, which go back to unverified until someone checks the new document.
 * The previous file is removed. Call after saveVaccines, so the rows exist.
 */
export async function uploadVaccineRecord(dogId: string, doc: PickedDoc) {
  const c = db();
  const { data: auth } = await c.auth.getUser();
  if (!auth.user) throw new Error('not_signed_in');
  const before = (check(await c.from('vaccinations').select('document_path').eq('dog_id', dogId)) as { document_path: string | null }[])
    .map((r) => r.document_path).filter((p): p is string => !!p);
  const safe = doc.name.replace(/[^\w. -]+/g, '').trim().slice(0, 80) || 'Vet record';
  const path = `${auth.user.id}/${dogId}/${Date.now()}-${safe}`;
  check(await c.storage.from('vaccine-docs').upload(path, base64ToBytes(doc.uri.slice(doc.uri.indexOf(',') + 1)), { contentType: doc.mime }));
  check(await c.from('vaccinations').update({ document_path: path, verified: false }).eq('dog_id', dogId));
  const old = Array.from(new Set(before)).filter((p) => p !== path);
  if (old.length) await c.storage.from('vaccine-docs').remove(old);
}

/**
 * Records vaccine expiry dates. Only dates that changed are written, and those go back to unverified
 * (a new date needs checking again; members can't write verified rows), so checked ones stay checked.
 */
export async function saveVaccines(dogId: string, rows: { type: 'rabies' | 'dhpp' | 'bordetella'; expiresOn: string }[]) {
  const c = db();
  const current = check(await c.from('vaccinations').select('type, expires_on').eq('dog_id', dogId)) as { type: string; expires_on: string }[];
  const changed = rows.filter((r) => current.find((x) => x.type === r.type)?.expires_on !== r.expiresOn);
  if (!changed.length) return;
  check(await c.from('vaccinations').upsert(changed.map((r) => ({ dog_id: dogId, type: r.type, expires_on: r.expiresOn, verified: false })), { onConflict: 'dog_id,type' }));
}

/** Returns the new booking id, or throws with a reason code (see errors.ts). */
export async function book(sessionId: string, dogId: string) {
  return (check(await db().rpc('book_session', { p_session: sessionId, p_dog: dogId })) as { id: string }).id;
}

export async function bookMany(dogId: string, sessionIds: string[]) {
  const rows = check(await db().rpc('book_sessions', { p_dog: dogId, p_sessions: sessionIds })) as { session_id: string; error: string | null }[];
  return rows.map((r) => ({ sessionId: r.session_id, error: r.error }));
}

/** Holds the rest of a starting month for a dog without Social (spots reserved, no credits). */
export async function holdSessions(dogId: string, sessionIds: string[]) {
  const rows = check(await db().rpc('hold_sessions', { p_dog: dogId, p_sessions: sessionIds })) as { session_id: string; error: string | null }[];
  return rows.map((r) => ({ sessionId: r.session_id, error: r.error }));
}

/** Books every live hold for the dog; each succeeds or fails on its own. */
export async function bookHeld(dogId: string) {
  const rows = check(await db().rpc('book_held', { p_dog: dogId })) as { session_id: string; error: string | null }[];
  return rows.map((r) => ({ sessionId: r.session_id, error: r.error }));
}

export async function releaseHolds(dogId: string, sessionId?: string) {
  check(await db().rpc('release_holds', { p_dog: dogId, p_session: sessionId ?? null }));
}

/** Joins a full session's waitlist. Returns the dog's place in line. */
export async function joinWaitlist(dogId: string, sessionId: string) {
  return check(await db().rpc('join_waitlist', { p_dog: dogId, p_session: sessionId })) as number;
}

export async function leaveWaitlist(dogId: string, sessionId: string) {
  check(await db().rpc('leave_waitlist', { p_dog: dogId, p_session: sessionId }));
}

export async function cancel(bookingId: string) {
  check(await db().rpc('cancel_booking', { p_booking: bookingId }));
}

export async function checkIn(bookingId: string, code: string) {
  check(await db().rpc('check_in', { p_booking: bookingId, p_code: code }));
}

export async function seeClearance(id: string) {
  check(await db().rpc('see_clearance', { p_clearance: id }));
}

/** Links this device's Expo push token to the signed-in member (supabase/functions/send-push delivers to it). */
export async function registerPushToken(token: string, platform: 'ios' | 'android') {
  check(await db().rpc('register_push_token', { p_token: token, p_platform: platform }));
}

export async function markRead(ids: string[] | null) {
  check(await db().rpc('mark_notifications_read', { p_ids: ids }));
}
