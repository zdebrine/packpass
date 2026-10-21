// The clearances PackPass offers (supabase/migrations/…_clearance_types.sql), with each one's rubric. PackPass
// adds and edits them on PackPass › Clearances; partners read them here.
import { useEffect, useState } from 'react';

import { db } from './supabase';

export interface ClearanceInfo {
  id: string; name: string; description: string; scope: 'network' | 'partner'; expiry_months: number;
  status: 'draft' | 'active' | 'retired'; criteria: { label: string; required: boolean }[];
}

/** Social and Herding as seeded, for when the table can't load. */
export const FALLBACK_CLEARANCES: ClearanceInfo[] = [
  { id: 'social', name: 'Social', description: '', scope: 'network', expiry_months: 12, status: 'active', criteria: [] },
  { id: 'herding', name: 'Herding', description: '', scope: 'partner', expiry_months: 12, status: 'active', criteria: [] },
];

let current: ClearanceInfo[] = FALLBACK_CLEARANCES;
let loading: Promise<ClearanceInfo[]> | null = null;

/** Reads the clearances once per session; on any error it keeps the fallback. */
export function loadClearances(): Promise<ClearanceInfo[]> {
  loading ??= fetchClearances()
    .then((rows) => (current = rows.length ? rows : FALLBACK_CLEARANCES))
    .catch(() => (current = FALLBACK_CLEARANCES));
  return loading;
}

/** Every clearance a partner can see (active and retired), starting from the fallback. */
export function useClearances(): ClearanceInfo[] {
  const [list, setList] = useState(current);
  useEffect(() => {
    let live = true;
    loadClearances().then((l) => live && setList(l));
    return () => { live = false; };
  }, []);
  return list;
}

/** A clearance's name, or its id capitalised when it isn't loaded. */
export const clearanceName = (id: string | null | undefined, list: ClearanceInfo[] = current) =>
  id ? list.find((k) => k.id === id)?.name ?? id.charAt(0).toUpperCase() + id.slice(1) : '';

/** The clearance a roster or Passport badge ("Herding · re-assess") is about. */
export const clearanceFromLabel = (label: string, list: ClearanceInfo[] = current) => {
  const name = label.split(' · ')[0];
  return list.find((k) => k.name === name)?.id ?? name.toLowerCase();
};

async function fetchClearances(): Promise<ClearanceInfo[]> {
  const [types, criteria] = await Promise.all([
    db.from('clearance_types').select('id, name, description, scope, expiry_months, status').order('position'),
    db.from('clearance_criteria').select('clearance_id, label, required').order('position'),
  ]);
  if (types.error) throw types.error;
  const items = (criteria.data ?? []) as { clearance_id: string; label: string; required: boolean }[];
  return (types.data as Omit<ClearanceInfo, 'criteria'>[]).map((k) => ({
    ...k, criteria: items.filter((c) => c.clearance_id === k.id).map(({ label, required }) => ({ label, required })),
  }));
}
