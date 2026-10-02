import { execFileSync } from 'node:child_process';

import { catalog } from '@/data/catalog';
import { nextSession } from '@/lib/booking';
import { setLiveClock } from '@/lib/clock';
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
  const email = `e2e+${Date.now()}@packpass.test`;
  S().updateDraft({ email, ownerName: 'Test Owner' });

  // 01b / 01d
  await S().signUp(email, 'herding4life');
  let threw = '';
  try { await S().verifyEmail('000000'); } catch (e) { threw = (e as Error).message; }
  ok(/invalid|expired/i.test(threw), 'a wrong email code is rejected');
  await S().verifyEmail('123456');
  ok(S().signedIn, 'verifying the code signs in');

  // 01i Upload records before the dog exists, then 01j finishes onboarding.
  const far = new Date(); far.setFullYear(far.getFullYear() + 2);
  const iso = far.toISOString().slice(0, 10);
  await S().saveVaccines([{ type: 'Rabies', expires: iso }, { type: 'DHPP', expires: iso }, { type: 'Bordetella', expires: iso }]);
  await S().finishOnboarding();
  ok(S().onboarded && S().dogs.length === 1 && S().dogs[0].name === 'Juno', 'onboarding saves the dog');
  ok(S().credits === 10, 'a new member has 10 credits on Regular');
  ok(S().vaccines.length === 3, 'vaccines entered during onboarding are saved with the dog');
  ok(S().activePaths.includes('calm-around-dogs') && S().activePaths.includes('loose-leash-walking'), 'traits start both training paths');
  ok(S().social === 'working', 'Social starts as working on it');
  ok(Object.keys(catalog.classes).length >= 16 && catalog.sessions.length > 300, 'the catalog loads from Supabase');
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
  await S().signOut();
  ok(!S().signedIn, 'sign out');
  threw = '';
  try { await S().signIn(email, 'wrong-password'); } catch (e) { threw = (e as Error).message; }
  ok(/invalid/i.test(threw), 'a wrong password is rejected');
  await S().signIn(email, 'herding4life');
  ok(S().onboarded && S().bookings.length === 4, 'signing back in restores the dog and bookings');
  ok(S().pendingPlan.length === 1, 'held spots follow the member to a new sign-in');

  console.log(`\nAll ${n} live-mode checks passed.`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
