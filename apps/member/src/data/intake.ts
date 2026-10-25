import { sessionById, trainers } from './fixtures';
import type { IntakeCall, IntakeSpecialist, PrivateOffer } from './types';

/**
 * Sample mode's intake calls (23d to 23f): Sam takes video and phone calls at three times a day for the next week, Ana
 * books through Calendly, and Sam has offered Juno a 1:1 of Calm around dogs. Dated from the clock.
 */
export function sampleIntake(now: Date): { specialists: IntakeSpecialist[]; calls: IntakeCall[]; offers: PrivateOffer[] } {
  const at = (d: number, h: number, m = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, h, m);
  const slots = Array.from({ length: 7 }, (_, i) => [at(i + 1, 12), at(i + 1, 12, 30), at(i + 1, 16)]).flat()
    .map((startsAt) => ({ id: `sam.${startsAt.getTime()}`, startsAt }));
  const offered = sessionById('calm-private.4.1900');
  return {
    specialists: [
      { trainerId: 'sam', name: trainers.sam.name, credential: 'Certified behavior consultant · 9 years', photo: 'dog_sleeping_while_owner_reads', partnerId: 'eastside',
        partner: 'Eastside Dog Club', focus: 'reactivity, new dogs', phone: true, calendly: false, slots },
      { trainerId: 'ana', name: trainers.ana.name, credential: trainers.ana.credential, photo: 'dog_and_owner_chilling', partnerId: 'northside',
        partner: 'Northside Canine', focus: 'leash manners and loose-leash walking', phone: false, calendly: true, slots: [] },
    ],
    calls: [],
    offers: offered ? [{
      id: 'sample-offer', dogId: 'juno', sessionId: offered.id, classId: 'calm-private', title: 'Calm around dogs', startsAt: offered.startsAt, durationMin: 40,
      credits: 3, cancelHours: 24, partner: 'Eastside Dog Club', trainer: trainers.sam.name, trainerPhoto: 'dog_sleeping_while_owner_reads',
      note: "Juno settles fast one-on-one. We'll start at distance from a calm dog and close the gap.", status: 'offered', expiresAt: at(2, 18),
    }] : [],
  };
}
