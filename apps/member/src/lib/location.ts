import { catalog } from '@/data/catalog';

/** Where distances are measured from: a home area picked in onboarding, or the phone's location. */
export interface Origin {
  label: string;
  lat: number;
  lng: number;
}

/** The areas onboarding offers (01g "Trains near"), with a rough centre for each. */
export const AREAS: Origin[] = [
  { label: 'Austin · South', lat: 30.229, lng: -97.788 },
  { label: 'Austin · East', lat: 30.262, lng: -97.715 },
  { label: 'Austin · Central', lat: 30.274, lng: -97.743 },
  { label: 'Mueller', lat: 30.298, lng: -97.705 },
  { label: 'Cedar Park', lat: 30.505, lng: -97.82 },
];
export const DEFAULT_AREA = AREAS[0];
export const areaNamed = (label?: string | null) => AREAS.find((a) => a.label === label);

/** Straight-line miles, to one decimal (what the cards show). */
export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return Math.round(3958.8 * 2 * Math.asin(Math.sqrt(h)) * 10) / 10;
}

const designMi = new Map<string, number>();

/**
 * Re-measures every partner in the catalog from `origin`. Null puts back the distances the partners
 * came with (sample mode shows the designs' numbers until the member picks somewhere).
 */
export function applyDistances(origin: Origin | null) {
  for (const p of Object.values(catalog.partners)) {
    if (!designMi.has(p.id)) designMi.set(p.id, p.distanceMi);
    if (!origin) p.distanceMi = designMi.get(p.id)!;
    else if (p.lat != null && p.lng != null) p.distanceMi = milesBetween(origin, { lat: p.lat, lng: p.lng });
  }
}
