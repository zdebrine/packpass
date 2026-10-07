import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { errorCopy } from '@/api/errors';
import { catalog } from '@/data/catalog';
import { payoff } from '@/data/payoffs';
import { FALLBACK_TRAITS, loadTraits, pathsFor, traitLabel } from '@/data/traits';
import { nextSession } from '@/lib/booking';
import { setLiveClock } from '@/lib/clock';
import { liveHerding, liveSocial } from '@/lib/clearances';
import { liveLog } from '@/lib/log';
import { liveGoal, pathTrainers } from '@/lib/paths';
import { statsOf } from '@/lib/stats';
import { useApp } from '@/store/app';

setLiveClock(true);
const psql = (sql: string) => execFileSync('psql', ['-h', process.env.PGHOST || '/tmp', '-p', process.env.PGPORT || '5432', '-U', process.env.PGUSER || 'postgres', '-d', process.env.DB || 'packpass_api', '-Atqc', sql]).toString().trim();
let n = 0;
function ok(cond: unknown, what: string) {
  if (!cond) { console.error('FAILED:', what); process.exit(1); }
  n++;
  console.log('ok:', what);
}
const S = () => useApp.getState();

(async () => {
  let email = `e2e+${Date.now()}@packpass.test`;
  S().updateDraft({ email, ownerName: 'Test Owner', area: 'Mueller' });

  // 01b / 01d
  await S().signUp(email, 'herding4life');
  let threw = '';
  try { await S().signIn(email, 'herding4life'); } catch (e) { threw = (e as Error).message; }
  ok(threw === 'email_not_confirmed', 'signing in before entering the code says the email isn\'t confirmed (the app sends a new code)');
  await S().signUp(email, 'herding4life');
  ok(true, 'signing up again before confirming just sends the code again');
  threw = '';
  try { await S().verifyEmail('000000'); } catch (e) { threw = (e as Error).message; }
  ok(/invalid|expired/i.test(threw), 'a wrong email code is rejected');
  await S().verifyEmail('123456');
  ok(S().signedIn, 'verifying the code signs in');

  // 01i Upload records before the dog exists, then 01j finishes onboarding.
  const far = new Date(); far.setFullYear(far.getFullYear() + 2);
  const iso = far.toISOString().slice(0, 10);
  const record = (name: string) => ({ name, mime: 'application/pdf' as const, uri: `data:application/pdf;base64,${Buffer.from(`%PDF-1.4 ${name}`).toString('base64')}` });
  await S().saveVaccines([{ type: 'Rabies', expires: iso }, { type: 'DHPP', expires: iso }, { type: 'Bordetella', expires: iso }], record('Clinic certificate.pdf'));
  // A photo picked in 01e (a JPEG data URI from pickDogPhoto) uploads when the dog is saved.
  const jpeg = (tag: string) => `data:image/jpeg;base64,${Buffer.from(`\xff\xd8 fake jpeg ${tag}`).toString('base64')}`;
  // Live accounts start with a blank draft, so fill in onboarding (01e to 01h) the way an owner would.
  S().updateDraft({
    dogName: 'Juno', sex: 'Female', breed: 'Border Collie', birthMonth: 2, birthYear: 2023, weight: 38,
    fixed: true, energy: 'working', social: 'Loves dogs', interests: ['Herding', 'Sprint', 'Scent'], traits: ['pulls', 'nervous_dogs'],
  });
  S().updateDraft({ photo: { uri: jpeg('first') } });
  await S().finishOnboarding();
  ok(S().onboarded && S().dogs.length === 1 && S().dogs[0].name === 'Juno', 'onboarding saves the dog');
  const userId = psql(`select id from profiles where email = '${email}'`);
  const photoOf = () => S().dogs[0].photo as { uri: string; cacheKey: string } | undefined;
  ok(photoOf()?.cacheKey.startsWith(`${userId}/${S().dogs[0].id}/`), 'the onboarding photo is uploaded to the member\'s folder');
  ok((await (await fetch(photoOf()!.uri)).text()).includes('fake jpeg first'), 'and shows through a signed URL');
  await S().setDogPhoto(S().dogs[0].id, jpeg('second'));
  ok((await (await fetch(photoOf()!.uri)).text()).includes('fake jpeg second'), 'changing the photo shows the new one');
  ok(psql(`select count(*) from storage.objects where bucket_id = 'dog-photos' and name like '${userId}/%'`) === '1', 'and removes the old file');
  ok(S().vaccineRecord?.name === 'Clinic certificate.pdf' && !S().vaccineRecord?.verified, 'a vet record picked in onboarding uploads with the dog, unverified');
  ok(psql(`select count(*) from vaccinations where document_path like '${userId}/%Clinic certificate.pdf'`) === '3', 'and covers all three vaccines');
  psql(`update vaccinations set verified = true where document_path like '${userId}/%'`);
  await S().refresh();
  ok(S().vaccineRecord?.verified, 'a checked record shows as checked');
  await S().saveVaccines(S().vaccines);
  ok(S().vaccineRecord?.verified, 'saving the same dates keeps the check');
  const later = new Date(far); later.setMonth(later.getMonth() + 1);
  await S().saveVaccines(S().vaccines.map((v) => (v.type === 'Rabies' ? { ...v, expires: later.toISOString().slice(0, 10) } : v)));
  ok(psql(`select string_agg(type || ':' || verified, ',' order by type::text) from vaccinations where document_path like '${userId}/%'`) === 'bordetella:true,dhpp:true,rabies:false',
     'a changed date can be saved after checking, and only that vaccine needs checking again');
  await S().saveVaccines(S().vaccines, record('New record.pdf'));
  ok(S().vaccineRecord?.name === 'New record.pdf' && !S().vaccineRecord?.verified, 'a new record replaces it and needs checking again');
  ok(psql(`select count(*) from storage.objects where bucket_id = 'vaccine-docs' and name like '${userId}/%'`) === '1', 'and the old file is removed');
  const { supabase } = await import('@/api/client');
  const intruder = await supabase!.storage.from('dog-photos').upload('00000000-0000-0000-0000-000000000000/x.jpg', new Uint8Array([1, 2, 3]));
  ok(intruder.error, 'a member can\'t upload into someone else\'s folder');
  ok(S().credits === 10, 'a new member has 10 credits on Regular');
  ok(S().vaccines.length === 3, 'vaccines entered during onboarding are saved with the dog');
  ok(S().activePaths.includes('calm-around-dogs') && S().activePaths.includes('loose-leash-walking'), 'traits start both training paths');
  ok(psql(`select energy || '|' || array_to_string(traits, ',') from dogs where id = '${S().dogs[0].id}'`) === 'working|pulls,nervous_dogs',
     'onboarding saves the energy key and trait ids');
  ok(S().social === 'working', 'Social starts as working on it');
  const calm = () => liveGoal(S().paths!.find((p) => p.id === 'calm-around-dogs')!, 'Juno', S().log ?? []);
  ok(S().paths!.length === 2 && calm().steps[0].state === 'next' && calm().steps[0].classId === 'calm-private' && calm().steps[3].state === 'final',
     'paths load from the database, starting at step 1');
  const calmTrainers = pathTrainers('calm-around-dogs', S().paths!.find((p) => p.id === 'calm-around-dogs')!.steps.map((x) => x.classId));
  const leashTrainers = pathTrainers('loose-leash-walking', S().paths!.find((p) => p.id === 'loose-leash-walking')!.steps.map((x) => x.classId));
  ok(calmTrainers[0]?.name === 'Sam Reyes' && calmTrainers[0].classId === 'calm-private' && calmTrainers[0].tags.includes('Reactivity')
     && !calmTrainers.some((t) => t.name === 'Maren Holt'), 'a path lists trainers who teach it or suit it, best match first');
  ok(leashTrainers[0]?.name === 'Ana Ruiz' && leashTrainers[0].classId === 'loose-leash', 'and each path has its own list');
  // A partner checks the dog in to step 1's class: the step is done and step 2 is next.
  psql(`insert into sessions (class_id, starts_at, capacity, packpass_spots, spots_left) values ('calm-private', now() - interval '1 hour', 1, 1, 0)`);
  const stepBooking = psql(`insert into bookings (session_id, dog_id, member_id, credits_charged) select id, '${S().dogs[0].id}', '${userId}', 3 from sessions where class_id = 'calm-private' and starts_at < now() order by starts_at desc limit 1 returning id`);
  psql(`update bookings set status = 'checked_in', checked_in_at = now() where id = '${stepBooking}'`);
  await S().refresh();
  ok(calm().steps[0].state === 'done' && /^Done /.test(calm().steps[0].stateLabel) && calm().steps[1].state === 'next' && /^Step 1 done /.test(calm().updated),
     'checking in to a step\'s class completes it, and the next step opens');
  ok(S().remoteNotifications!.some((n) => n.title === 'Step 1 of 4 done' && n.href === '/goal/calm-around-dogs'), 'and the member is told');
  psql(`update bookings set status = 'cancelled' where id = '${stepBooking}'`); // keep the booking counts below as they were
  ok(Object.keys(catalog.classes).length >= 16 && catalog.sessions.length > 300, 'the catalog loads from Supabase');
  // Trait catalog and payoff lines (copy refresh, phase 2).
  const traits = await loadTraits();
  ok(JSON.stringify(traits) === JSON.stringify(FALLBACK_TRAITS), 'the trait catalog loads, and matches the built-in fallback');
  const block = (f: string) => readFileSync(f, 'utf8').split('export const FALLBACK_TRAITS')[1].split('];')[0];
  ok(block('src/data/traits.ts') === block('../web/src/lib/traits.ts') && block('src/data/traits.ts') === block('../partner/src/lib/traits.ts'),
     'and the website and dashboard carry the same fallback');
  ok(traitLabel('leash_reactive') === 'Loses it at dogs on walks' && traitLabel('leash_reactive', 'partner') === 'Leash reactive (lunges or barks at dogs)'
     && traitLabel('Barks at bikes') === 'Barks at bikes', 'traits show in the owner\'s or trainer\'s words, and unknown ones as stored');
  ok(JSON.stringify(pathsFor(['nervous_dogs', 'leash_reactive', 'Barks at bikes'])) === '["calm-around-dogs"]'
     && JSON.stringify(pathsFor(['pulls', 'leash_reactive'])) === '["loose-leash-walking","calm-around-dogs"]',
     'leash_reactive starts Calm around dogs, and a path shared by two traits starts once');
  ok(Object.values(catalog.classes).every((c) => c.dropOff === false), 'classes load with the drop-off flag (off unless the partner sets it)');
  ok(Object.values(catalog.classes).every((c) => payoff(c.discipline) !== null) && payoff('Behavior') === null,
     'every class in the catalog has a payoff line; unknown disciplines have none');

  // Distances: from the area picked in onboarding, or anywhere the member chooses.
  ok(S().area === 'Mueller' && catalog.partners.ridgeline.distanceMi < 2, 'the onboarding area is saved, and distances are measured from it');
  const fromMueller = catalog.partners.southfork.distanceMi;
  S().setOrigin({ label: 'Near you', lat: 30.505, lng: -97.82 });
  ok(catalog.partners.southfork.distanceMi > fromMueller + 10, 'choosing another origin re-measures every partner');
  S().setOrigin(null);
  ok(catalog.partners.southfork.distanceMi === fromMueller, 'and going back to the area restores it');
  ok(catalog.partners.ridgeline.distanceMi > 0, 'partner distances are computed');

  const dog = S().dogs[0].id;
  const assessment = nextSession('social-assessment', 1)!;
  ok(!!assessment && (await S().bookSession(assessment.session.id, dog)).ok && S().credits === 8, 'a new dog can book the Social assessment its month leads with');
  const agility = nextSession('agility-drop-in', 1)!;
  let r = await S().bookSession(agility.session.id, dog);
  ok(!r.ok && r.error === 'needs_social', 'group sport is blocked without Social');
  const play = nextSession('small-group-play', 1)!;
  r = await S().bookSession(play.session.id, dog);
  ok(r.ok && S().credits === 7 && S().bookings.length === 2, 'a path session books and charges 1 credit');
  ok(S().remoteNotifications!.some((x) => x.title === 'Booked. Small-group play'), 'the booking notification shows up');

  // 01j holds group sessions for a dog without Social: spot reserved on the server, no credits.
  const roam = nextSession('free-roam', 3)!;
  const spotsBefore = roam.session.spotsLeft;
  const held = await S().holdSessions([roam.session.id, nextSession('herding-livestock', 3)!.session.id], dog);
  ok(held[0].error === null && held[1].error === 'needs_herding', 'holding skips the Social rule but no other');
  ok(S().pendingPlan.includes(roam.session.id) && S().credits === 7, 'the hold is stored on the server and charges nothing');
  ok(nextSession('free-roam', 3)!.session.spotsLeft === spotsBefore - 1, 'other members see one spot fewer');
  ok((await S().bookHeld(dog))[0].error === 'needs_social' && S().pendingPlan.length === 1, 'held spots stay held until the dog has Social');

  const many = await S().bookMany([nextSession('sniff-space', 2)!.session.id, nextSession('open-field', 2)!.session.id], dog);
  ok(many.filter((m) => !m.error).length === 1 && many.some((m) => m.error === 'needs_social'), 'Book these books what it can and reports the rest');
  ok(S().credits === 6, 'only the booked plan session is charged');

  const sniff = S().bookings.find((b) => b.sessionId === many.find((m) => !m.error)!.sessionId)!;
  await S().cancelBooking(sniff.id);
  ok(S().credits === 7 && !S().bookings.some((b) => b.id === sniff.id), 'cancelling early refunds the credit');

  threw = '';
  try { await S().checkIn(S().bookings[0].id, '0000'); } catch (e) { threw = (e as Error).message; }
  ok(threw === 'wrong_code' || threw === 'too_early', 'check-in checks the code and the time window');

  // Partner records a passing re-check (service role), then the member opens screen 13.
  psql(`select public.record_assessment('${dog}', 'social', 'eastside', 'Sam Reyes', 'cleared')`);
  await S().refresh();
  ok(S().social === 'earned' && !S().activePaths.includes('calm-around-dogs'), 'a passed re-check shows as earned and completes the path');
  S().seeSocialClearance();
  await new Promise((res) => setTimeout(res, 300));
  await S().refresh();
  ok(S().social === 'cleared', 'opening the celebration marks the clearance seen');
  const social = liveSocial(S().clearanceRecords!, S().log!);
  ok(social.status === 'cleared' && social.facts[0][1] === 'Eastside Dog Club' && social.assessor?.startsWith('Sam Reyes, Eastside Dog Club'),
     'the Passport shows the real clearance: issuer and assessor');
  ok(liveHerding(S().clearanceRecords!).status === 'needs', 'and Herding still needs an assessment');
  await S().updateDraft({ traits: ['pulls', 'Barks at bikes'] });
  await S().saveTraits(dog);
  ok(psql(`select array_to_string(traits, ',') from dogs where id = '${dog}'`) === 'pulls,Barks at bikes' && S().dogs[0].traits?.length === 2,
     'editing traits saves them to the dog');
  r = await S().bookSession(agility.session.id, dog);
  ok(r.ok, 'with Social, group sport books');
  const fromHold = await S().bookHeld(dog);
  ok(fromHold.length === 1 && fromHold[0].error === null && S().pendingPlan.length === 0, 'once cleared, held sessions book in one tap');
  ok(nextSession('free-roam', 3)!.session.spotsLeft === spotsBefore - 1, 'booking a held spot doesn\'t take a second one');

  S().markRead(null);
  await new Promise((res) => setTimeout(res, 300));
  await S().refresh();
  ok(S().remoteNotifications!.every((x) => S().readNotifications.includes(x.id)), 'mark all read persists');

  await S().holdSessions([nextSession('open-field', 3)!.session.id], dog);

  // Waitlist: join a full session; when a spot opens more than 12 hours out, it books itself.
  const sniffFull = nextSession('sniff-space', 4)!;
  psql(`update sessions set spots_left = 0 where id = '${sniffFull.session.id}'`);
  await S().refresh();
  const creditsBefore = S().credits;
  ok((await S().joinWaitlist(sniffFull.session.id, dog)) === 1 && S().waitlist.length === 1, 'a full session can be waitlisted, first in line');
  threw = '';
  try { await S().joinWaitlist(sniffFull.session.id, dog); } catch (e) { threw = (e as Error).message; }
  ok(threw === 'already_waiting', 'joining twice is refused');
  psql(`update sessions set spots_left = 1 where id = '${sniffFull.session.id}'`);
  await S().refresh();
  ok(S().bookings.some((b) => b.sessionId === sniffFull.session.id) && S().waitlist.length === 0 && S().credits === creditsBefore - 1, 'an opened spot books the waitlisted dog');
  ok(S().remoteNotifications!.some((x) => x.title === 'Off the waitlist. Sniff space is booked.'), 'and says so');

  // Log: a session that ran shows with the trainer's note from the partner dashboard.
  const ran = S().bookings.find((b) => b.status === 'booked')!;
  psql(`update sessions set starts_at = now() - interval '2 hours' where id = '${ran.sessionId}'`);
  psql(`insert into session_notes (booking_id, trainer_id, note, skills) values ('${ran.id}', 'dev', 'Fast on the recall. Needs a longer warm-up.', '{Recall}')`);
  await S().refresh();
  const logged = S().log!.find((e) => e.bookingId === ran.id);
  ok(logged?.note === 'Fast on the recall. Needs a longer warm-up.' && logged.noteBy === 'Dev Patel', 'a session that ran is in the Log with the trainer\'s note');
  const view = liveLog(S().log!, dog, 'Juno', S().social);
  ok(view.stats[0][0] === String(S().log!.filter((e) => e.startsAt.getMonth() === new Date().getMonth()).length) && view.sessions[0].trainer.startsWith('Dev Patel · '),
     'and counts toward the month');
  const stats = statsOf(S().log!.filter((e) => e.dogId === dog));
  ok(stats.sessions === S().log!.length && stats.disciplines >= 1 && stats.levels[0].level === 1, 'the Athlete Card counts sessions and disciplines from the Log');

  // Hold reminders: the device is linked for push, and a hold within a day of release gets a reminder.
  await S().registerPush('ExponentPushToken[e2e-device]', 'ios');
  ok(psql(`select count(*) from push_tokens where token = 'ExponentPushToken[e2e-device]'`) === '1', 'the device is linked for push');
  psql(`update held_spots set expires_at = now() + interval '20 hours' where status = 'held'`);
  ok(psql('select public.remind_expiring_holds()') === '1', 'a hold releasing within a day is reminded');
  await S().refresh();
  ok(S().remoteNotifications!.some((x) => x.title === "Book Juno's held sessions" && x.icon === 'clock'), 'the reminder shows in the app');

  await S().signOut();
  ok(!S().signedIn, 'sign out');
  ok(psql(`select count(*) from push_tokens`) === '0', 'signing out unlinks the device');
  threw = '';
  try { await S().signIn(email, 'wrong-password'); } catch (e) { threw = (e as Error).message; }
  ok(/invalid/i.test(threw), 'a wrong password is rejected');
  threw = '';
  try { await S().signUp(email, 'another-password'); } catch (e) { threw = (e as Error).message; }
  ok(threw === 'already_registered' && /already an account/.test(errorCopy(threw)), 'signing up with an email that has an account says so instead of waiting for a code');
  // Forgot password: the emailed code (123456 in the stand-in) sets a new password and signs in.
  await S().requestPasswordReset(email);
  threw = '';
  try { await S().resetPassword(email, '000000', 'collies-rule-99'); } catch (e) { threw = (e as Error).message; }
  ok(/expired|invalid/i.test(threw) && !S().signedIn, 'a wrong reset code is rejected');
  await S().resetPassword(email, '123456', 'collies-rule-99');
  ok(S().signedIn && S().onboarded, 'a reset code sets the new password and signs in');
  await S().signOut();
  threw = '';
  try { await S().signIn(email, 'herding4life'); } catch (e) { threw = (e as Error).message; }
  ok(/invalid/i.test(threw), 'the old password stops working');
  await S().signIn(email, 'collies-rule-99');
  ok(S().onboarded && S().bookings.length === 5, 'signing back in restores the dog and bookings');
  ok(S().pendingPlan.length === 1, 'held spots follow the member to a new sign-in');

  // Settings › Account: name, password, then delete the account.
  await S().saveName('Sam Rivera');
  ok(psql(`select name from profiles where id = '${userId}'`) === 'Sam Rivera' && S().account.name === 'Sam Rivera', 'the name can be changed');
  threw = '';
  try { await S().changePassword('short'); } catch (e) { threw = (e as Error).message; }
  ok(threw === 'weak_password', 'a short new password is refused');
  threw = '';
  try { await S().requestEmailChange(email.toUpperCase()); } catch (e) { threw = (e as Error).message; }
  ok(threw === 'same_email', 'changing to the same email is refused');
  threw = '';
  await fetch('http://127.0.0.1:54399/auth/v1/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'taken@example.com', password: 'password123' }) });
  try { await S().requestEmailChange('taken@example.com'); } catch (e) { threw = (e as Error).message; }
  ok(threw === 'email_exists', 'an email another account uses is refused');
  const newEmail = 'sam.rivera@example.com';
  await S().requestEmailChange(newEmail);
  ok(psql(`select email from auth.users where id = '${userId}'`) === email, 'nothing changes until the code is entered');
  threw = '';
  try { await S().confirmEmailChange(newEmail, '000000'); } catch (e) { threw = (e as Error).message; }
  ok(threw === 'otp_expired', 'a wrong code is refused');
  ok((await S().confirmEmailChange(newEmail, '123456')) === false && S().account.email === email, 'the new address\'s code alone isn\'t enough');
  ok((await S().confirmEmailChange(newEmail, '123456', email)) === true, 'with the current address\'s code too, the email changes');
  ok(S().account.email === newEmail && psql(`select email from profiles where id = '${userId}'`) === newEmail, 'profile included');
  await S().refresh();
  ok(S().account.email === newEmail, 'and it sticks after a refresh');
  email = newEmail;
  await S().changePassword('border-collie-2');
  await S().signOut();
  await S().signIn(email, 'border-collie-2');
  ok(S().signedIn, 'the new password signs in');
  const heldSession = psql(`select session_id from held_spots where member_id = '${userId}' and status = 'held' limit 1`);
  const heldSpots = Number(psql(`select spots_left from sessions where id = '${heldSession}'`));
  await S().deleteAccount();
  ok(!S().signedIn && !S().onboarded && S().dogs.length === 0, 'deleting the account signs out and clears the app');
  ok(psql(`select (select count(*) from auth.users where id = '${userId}') + (select count(*) from profiles where id = '${userId}') + (select count(*) from bookings where member_id = '${userId}')`) === '0',
     'and removes the member, their dogs and bookings');
  ok(psql(`select count(*) from storage.objects where name like '${userId}/%'`) === '0', 'and their photo and vet records');
  ok(Number(psql(`select spots_left from sessions where id = '${heldSession}'`)) === heldSpots + 1, 'and gives their held spot back');

  console.log(`\nAll ${n} live-mode checks passed.`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
