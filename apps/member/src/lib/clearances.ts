// The Passport's clearances: Social and Herding, then any PackPass added. Sample mode shows the designs' Juno
// (src/data/passport.ts); live mode builds them from the dog's clearance rows and its assessment results in the Log.
import { isLive } from '@/api/client';
import { catalog } from '@/data/catalog';
import { HERDING, SOCIAL_UNLOCKS, socialClearance, type Clearance } from '@/data/passport';
import type { ClearanceInfo, ClearanceRecord, LogEntry } from '@/data/types';
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
    if (!isValid(k) && k.reassess) {
      return { type: 'social', name: 'Social', status: 'expired', eyebrow: 'Re-assessment needed', sub: `Asked by ${k.reassess.by}`,
        facts: [['Asked by', k.reassess.by], ['First assessed', `${where} · ${assessed}`]], unlocks: SOCIAL_UNLOCKS,
        note: `${k.reassess.reason} Group classes open again once a Social re-check passes.`, rebook: 'social-recheck', ...notes };
    }
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
  const flagged = rows.find((r) => r.type === 'herding' && r.reassess);
  if (!valid.length && flagged?.reassess) {
    const where = partnerName(flagged.partnerId);
    const again = Object.values(catalog.classes).find((c) => c.grants === 'herding' && c.partnerId === flagged.partnerId);
    return {
      type: 'herding', name: 'Herding', status: 'expired', eyebrow: 'Re-assessment needed', sub: `Asked by ${flagged.reassess.by}`,
      facts: [['Asked by', flagged.reassess.by], ['First assessed', `${where} · ${monthYear(flagged.assessedOn)}`]], unlocks,
      note: `${flagged.reassess.reason} Herding classes at ${where} open again once a re-assessment there passes.`, rebook: again?.id,
    };
  }
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

/** A clearance PackPass added: cleared, flagged or expired from the dog's rows, else what it takes to earn it. */
export function liveOther(k: ClearanceInfo, rows: ClearanceRecord[]): Clearance {
  const mine = rows.filter((r) => r.type === k.id);
  const valid = mine.filter(isValid);
  const needing = Object.values(catalog.classes).filter((c) => c.requires === k.id);
  const unlocks: Clearance['unlocks'] = needing.slice(0, 4).map((c) => ({ icon: 'award', label: c.title, ex: catalog.partners[c.partnerId]?.name ?? '', photo: c.image }));
  const assessments = Object.values(catalog.classes).filter((c) => c.grants === k.id);
  const at = (partnerId: string) => assessments.find((c) => c.partnerId === partnerId)?.id ?? (k.scope === 'network' ? assessments[0]?.id : undefined);
  const lasts = `${k.expiryMonths === 12 ? 'A year' : `${k.expiryMonths} months`}, ${k.scope === 'network' ? 'at every partner' : 'at the partner that assessed it'}`;
  const latest = valid[0] ?? mine[0];
  if (!latest) {
    return { type: k.id, name: k.name, status: 'needs', eyebrow: 'Not assessed yet', sub: `Book a ${k.name} assessment`,
      facts: [['Assessed at', k.scope === 'network' ? 'Any PackPass partner' : 'Each partner'], ['Assessed', 'Not yet'], ['Lasts', lasts]], unlocks,
      note: k.description || `Some classes need a ${k.name} clearance. A short assessment with a trainer checks your dog is ready.`, rebook: assessments[0]?.id };
  }
  const where = partnerName(latest.partnerId);
  const assessed = monthYear(latest.assessedOn);
  const notes = { assessor: [latest.assessor, `${where} · ${assessed}`].filter(Boolean).join(', '), strengths: latest.strengths, working: latest.workingOn };
  if (!valid.length && latest.reassess) {
    return { type: k.id, name: k.name, status: 'expired', eyebrow: 'Re-assessment needed', sub: `Asked by ${latest.reassess.by}`,
      facts: [['Asked by', latest.reassess.by], ['First assessed', `${where} · ${assessed}`]], unlocks,
      note: `${latest.reassess.reason} Classes that need ${k.name} open again once a re-assessment passes.`, rebook: at(latest.partnerId), ...notes };
  }
  if (!valid.length) {
    return { type: k.id, name: k.name, status: 'expired', eyebrow: 'Verified · Expired', sub: `Expired · ${where}`,
      facts: [['Issued by', where], ['Assessed', assessed], ['Expired', monthYear(latest.expiresOn!)]], unlocks,
      note: `${k.name} expired. Book a re-assessment to open its classes again.`, rebook: at(latest.partnerId), ...notes };
  }
  return { type: k.id, name: k.name, status: 'cleared', eyebrow: k.scope === 'network' ? 'Verified clearance' : 'Stays at the partner', sub: `${where} · ${assessed}`,
    facts: [['Issued by', where], ['Assessed', assessed], ['Expires', latest.expiresOn ? monthYear(latest.expiresOn) : 'No expiry']], unlocks, ...notes };
}

/** Social and Herding for the Passport, the clearance sheet and the celebration screen. */
export function useClearances() {
  const social = useApp((s) => s.social);
  const expired = useApp((s) => s.socialExpired);
  const rows = useApp((s) => s.clearanceRecords);
  const log = useApp((s) => s.log);
  const onPath = useApp((s) => s.activePaths.includes('calm-around-dogs'));
  const dog = useDog();
  if (!isLive || !rows) return { social: socialClearance(social, expired), herding: HERDING, others: [] as Clearance[], socialRecord: null as ClearanceRecord | null };
  // The Log has every dog's sessions; only this dog's assessments say where it stands.
  const mine = (log ?? []).filter((e) => e.dogId === dog.id);
  // Clearances PackPass added: every one it offers, and any the dog holds that it has since retired.
  const known = Object.values(catalog.clearanceTypes).filter((k) => k.id !== 'social' && k.id !== 'herding');
  const extra = [...new Set(rows.map((r) => r.type))].filter((t) => t !== 'social' && t !== 'herding' && !known.some((k) => k.id === t))
    .map((t): ClearanceInfo => ({ id: t, name: t.charAt(0).toUpperCase() + t.slice(1), description: '', scope: rows.find((r) => r.type === t)!.scope, expiryMonths: 12, groupAlsoRequires: null }));
  const others = [...known, ...extra].map((k) => liveOther(k, rows));
  return { social: liveSocial(rows, mine, onPath), herding: liveHerding(rows), others, socialRecord: rows.find((r) => r.type === 'social') ?? null };
}
