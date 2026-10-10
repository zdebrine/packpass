// The Passport's two clearances. Sample mode shows the designs' Juno (src/data/passport.ts); live mode
// builds them from the dog's clearance rows and its assessment results in the Log.
import { isLive } from '@/api/client';
import { catalog } from '@/data/catalog';
import { HERDING, SOCIAL_UNLOCKS, socialClearance, type Clearance } from '@/data/passport';
import type { ClearanceRecord, LogEntry } from '@/data/types';
import { useApp, useDog } from '@/store/app';
import { now as clock } from './clock';
import { monthDay } from './dates';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Sep 2026" from an ISO date. */
export const monthYear = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const partnerName = (id: string) => catalog.partners[id]?.name ?? 'a PackPass partner';
const today = () => {
  const d = clock();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const isValid = (k: ClearanceRecord) => !k.expiresOn || k.expiresOn >= today();

/** Herding classes the dog can book with a Herding clearance at their partner. */
function herdingUnlocks(): Clearance['unlocks'] {
  const list = Object.values(catalog.classes).filter((c) => c.requires === 'herding');
  return list.length
    ? list.slice(0, 4).map((c) => ({ icon: 'fence', label: c.title, ex: catalog.partners[c.partnerId]?.name ?? '', photo: c.image }))
    : HERDING.unlocks;
}

export function liveSocial(rows: ClearanceRecord[], log: LogEntry[], onPath = false): Clearance {
  const k = rows.find((r) => r.type === 'social');
  if (k) {
    const where = partnerName(k.partnerId);
    const assessed = monthYear(k.assessedOn);
    const notes = { assessor: [k.assessor, `${where} · ${assessed}`].filter(Boolean).join(', '), strengths: k.strengths, working: k.workingOn };
    if (!isValid(k)) {
      return { type: 'social', name: 'Social', status: 'expired', eyebrow: 'Verified · Expired', sub: `Expired · ${where}`,
        facts: [['Issued by', where], ['Assessed', assessed], ['Expired', monthYear(k.expiresOn!)]], unlocks: SOCIAL_UNLOCKS, ...notes };
    }
    if (!k.seen) {
      return { type: 'social', name: 'Social', status: 'working', eyebrow: 'Re-check passed', sub: 'Result in · Tap to see',
        facts: [['Assessed at', where], ['Assessed', assessed], ['Next', 'Done']], unlocks: SOCIAL_UNLOCKS, ...notes };
    }
    return { type: 'social', name: 'Social', status: 'cleared', eyebrow: 'Verified clearance', sub: `${where} · ${assessed}`,
      facts: [['Issued by', where], ['Assessed', assessed], ['Expires', k.expiresOn ? monthYear(k.expiresOn) : 'No expiry']], unlocks: SOCIAL_UNLOCKS, ...notes };
  }
  // No clearance yet: the latest "not yet" result, if there is one, says where the dog stands.
  const tried = log.find((e) => e.assessment?.type === 'social');
  if (tried) {
    const a = tried.assessment!;
    return { type: 'social', name: 'Social', status: 'working', eyebrow: 'Working toward it', sub: 'Calm around dogs, then a re-check',
      facts: [['Assessed at', tried.partner], ['First check', `${monthDay(tried.startsAt)} · Not yet`], ['Next', 'Social re-check']], unlocks: SOCIAL_UNLOCKS,
      assessor: `${a.assessor}, ${tried.partner} · ${monthDay(tried.startsAt)}`, strengths: a.strengths, working: a.workingOn };
  }
  if (onPath) {
    return { type: 'social', name: 'Social', status: 'working', eyebrow: 'Working toward it', sub: 'Calm around dogs, then a re-check',
      facts: [['Assessed at', 'Any PackPass partner'], ['Path', 'Calm around dogs'], ['Next', 'Social re-check']], unlocks: SOCIAL_UNLOCKS };
  }
  return { type: 'social', name: 'Social', status: 'needs', eyebrow: 'Not assessed yet', sub: 'Book a Social assessment',
    facts: [['Assessed at', 'Any PackPass partner'], ['Assessed', 'Not yet'], ['Lasts', 'A year, at every partner']], unlocks: SOCIAL_UNLOCKS,
    note: 'Group classes need a Social clearance. A short assessment with a trainer checks how your dog does around other dogs, and it counts at every PackPass partner.' };
}

export function liveHerding(rows: ClearanceRecord[]): Clearance {
  const valid = rows.filter((r) => r.type === 'herding' && isValid(r));
  const unlocks = herdingUnlocks();
  if (!valid.length) return { ...HERDING, unlocks };
  const latest = valid[0];
  const where = valid.map((r) => partnerName(r.partnerId)).join(', ');
  return {
    type: 'herding', name: 'Herding', status: 'cleared', eyebrow: 'Discipline · Stays at the partner', sub: `Assessed at ${where}`,
    facts: [['Assessed at', where], ['Assessed', monthYear(latest.assessedOn)], ['Expires', latest.expiresOn ? monthYear(latest.expiresOn) : 'Set by the partner']],
    unlocks, assessor: [latest.assessor, `${partnerName(latest.partnerId)} · ${monthYear(latest.assessedOn)}`].filter(Boolean).join(', '),
    strengths: latest.strengths, working: latest.workingOn,
    note: 'Herding stays with the partner that assessed it. Other herding partners assess on their own livestock.',
  };
}

/** Social and Herding for the Passport, the clearance sheet and the celebration screen. */
export function useClearances() {
  const social = useApp((s) => s.social);
  const expired = useApp((s) => s.socialExpired);
  const rows = useApp((s) => s.clearanceRecords);
  const log = useApp((s) => s.log);
  const onPath = useApp((s) => s.activePaths.includes('calm-around-dogs'));
  const dog = useDog();
  if (!isLive || !rows) return { social: socialClearance(social, expired), herding: HERDING, socialRecord: null as ClearanceRecord | null };
  // The Log has every dog's sessions; only this dog's assessments say where it stands.
  const mine = (log ?? []).filter((e) => e.dogId === dog.id);
  return { social: liveSocial(rows, mine, onPath), herding: liveHerding(rows), socialRecord: rows.find((r) => r.type === 'social') ?? null };
}
