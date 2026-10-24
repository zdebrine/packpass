import type { Waiver } from '@/data/types';
import type { Vaccine, VaccineType } from '@/store/app';

import { now } from './clock';
import { dayOffset, expiryLabel, fromIso } from './dates';

/** A record that expires within this many days shows Expires soon (Ready to book, 18d). */
export const SOON_DAYS = 30;

export const VACCINE_TYPES: VaccineType[] = ['Rabies', 'DHPP', 'Bordetella'];

export type ReadyStatus = 'done' | 'needed' | 'soon' | 'expired';

export interface VaccineRow {
  type: VaccineType;
  status: ReadyStatus;
  /** "Expires Mar 2028", "Expires Oct 14 · in 15 days", "Upload a record from your vet". */
  meta: string;
  expires: Date | null;
  days: number | null;
}

export function vaccineRows(vaccines: Vaccine[], at = now()): VaccineRow[] {
  return VACCINE_TYPES.map((type) => {
    const rec = vaccines.find((v) => v.type === type);
    if (!rec) return { type, status: 'needed', meta: 'Upload a record from your vet', expires: null, days: null };
    const exp = fromIso(rec.expires);
    const days = dayOffset(exp, at);
    if (days < 0) return { type, status: 'expired', meta: `Expired ${expiryLabel(exp, at)}`, expires: exp, days };
    if (days <= SOON_DAYS) return { type, status: 'soon', meta: `Expires ${expiryLabel(exp, at)} · in ${days} ${days === 1 ? 'day' : 'days'}`, expires: exp, days };
    return { type, status: 'done', meta: `Expires ${expiryLabel(exp, at)}`, expires: exp, days };
  });
}

/** The PackPass waiver: the live one without a partner. */
export const packpassWaiver = (waivers: Waiver[]) => waivers.find((w) => w.partnerId === null) ?? null;

export interface Readiness {
  vaccines: VaccineRow[];
  waiver: Waiver | null;
  waiverSignedOn: string | null;
  /** Everything on file and nothing expiring: "Juno is ready to book." */
  state: 'done' | 'needed' | 'soon';
  /** The first thing to fix: a missing or expired vaccine, then the waiver, then one expiring soon. */
  next: { kind: 'vaccine'; row: VaccineRow } | { kind: 'waiver' } | null;
}

export function readiness(vaccines: Vaccine[], waivers: Waiver[], signed: Record<string, string>, at = now()): Readiness {
  const rows = vaccineRows(vaccines, at);
  const waiver = packpassWaiver(waivers);
  const waiverSignedOn = waiver ? signed[waiver.id] ?? null : null;
  const missing = rows.find((r) => r.status === 'needed' || r.status === 'expired');
  const soon = rows.find((r) => r.status === 'soon');
  const waiverNeeded = !!waiver && !waiverSignedOn;
  const next = missing ? { kind: 'vaccine' as const, row: missing } : waiverNeeded ? { kind: 'waiver' as const } : soon ? { kind: 'vaccine' as const, row: soon } : null;
  return { vaccines: rows, waiver, waiverSignedOn, state: missing || waiverNeeded ? 'needed' : soon ? 'soon' : 'done', next };
}
