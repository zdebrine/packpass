// Dog traits by stable id (docs/COPY_REFRESH_SPEC.md, phase 2). Same module in apps/member and apps/web.
import { useEffect, useState } from 'react';

import { db } from './supabase';

export type TraitGroup = 'dogs' | 'people' | 'walks' | 'home' | 'special';
export interface Trait { id: string; label: string; partner_label: string; grp: TraitGroup; sort: number; path_id: string | null }

/** The catalog as seeded (supabase/migrations/20261005000100_trait_catalog.sql), for when it can't load. */
export const FALLBACK_TRAITS: Trait[] = [
  { id: 'rough_play', label: 'Plays too rough', partner_label: 'Plays too rough', grp: 'dogs', sort: 10, path_id: null },
  { id: 'nervous_dogs', label: 'Nervous around new dogs', partner_label: 'Nervous with new dogs', grp: 'dogs', sort: 20, path_id: 'calm-around-dogs' },
  { id: 'guards', label: 'Guards food or toys', partner_label: 'Resource guards', grp: 'dogs', sort: 30, path_id: null },
  { id: 'shy_people', label: 'Shy with strangers', partner_label: 'Nervous with strangers', grp: 'people', sort: 40, path_id: null },
  { id: 'jumps', label: 'Greets everyone by jumping', partner_label: 'Jumps up on people', grp: 'people', sort: 50, path_id: null },
  { id: 'barks_visitors', label: 'Barks at every doorbell', partner_label: 'Barks at visitors', grp: 'people', sort: 60, path_id: null },
  { id: 'pulls', label: 'Pulls like a sled dog', partner_label: 'Pulls on the leash', grp: 'walks', sort: 70, path_id: 'loose-leash-walking' },
  { id: 'leash_reactive', label: 'Loses it at dogs on walks', partner_label: 'Leash reactive (lunges or barks at dogs)', grp: 'walks', sort: 80, path_id: 'calm-around-dogs' },
  { id: 'chases', label: 'Chases bikes and cars', partner_label: 'Chases bikes or cars', grp: 'walks', sort: 90, path_id: null },
  { id: 'recall', label: 'Selective hearing at the park', partner_label: 'Weak recall', grp: 'walks', sort: 100, path_id: null },
  { id: 'settle_public', label: 'Can\'t settle in public', partner_label: 'Struggles to settle in public', grp: 'walks', sort: 110, path_id: null },
  { id: 'alone', label: 'Struggles when left alone', partner_label: 'Separation stress', grp: 'home', sort: 120, path_id: null },
  { id: 'bored_chewing', label: 'Bored and chewing at home', partner_label: 'Chews or digs when alone', grp: 'home', sort: 130, path_id: null },
  { id: 'crate', label: 'Hard to settle in a crate', partner_label: 'Hard to settle in a crate', grp: 'home', sort: 140, path_id: null },
  { id: 'none', label: 'None of these', partner_label: 'None listed', grp: 'special', sort: 150, path_id: null },
  { id: 'not_sure', label: 'Not sure yet', partner_label: 'Owner not sure', grp: 'special', sort: 160, path_id: null },
];

let current: Trait[] = FALLBACK_TRAITS;
let loading: Promise<Trait[]> | null = null;

/** Reads the catalog once per session; on any error it keeps the fallback. */
export function loadTraits(): Promise<Trait[]> {
  loading ??= fetchTraits()
    .then((rows) => (current = rows?.length ? [...rows].sort((a, b) => a.sort - b.sort) : FALLBACK_TRAITS))
    .catch(() => (current = FALLBACK_TRAITS));
  return loading;
}

/** The catalog, starting from the fallback and updating once the database answers. */
export function useTraits(): Trait[] {
  const [traits, setTraits] = useState(current);
  useEffect(() => {
    let live = true;
    loadTraits().then((t) => live && setTraits(t));
    return () => { live = false; };
  }, []);
  return traits;
}

export const traitById = (id: string): Trait | undefined => current.find((t) => t.id === id);

/**
 * What to show for a stored trait: the owner's wording or the plain wording for trainers. Anything that
 * isn't in the catalog (free text from older builds) is shown as it is.
 */
export function traitLabel(id: string, audience: 'owner' | 'partner' = 'owner'): string {
  const t = traitById(id);
  return t ? (audience === 'partner' ? t.partner_label : t.label) : id;
}

async function fetchTraits(): Promise<Trait[] | null> {
  const { data, error } = await db.from('traits').select('id, label, partner_label, grp, sort, path_id');
  if (error) throw error;
  return data as Trait[];
}
