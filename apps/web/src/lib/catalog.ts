// The live catalog (anyone can read partners, classes and session times), for "Partners near you" and the
// month quiz. Falls back to a copy of the launch catalog if it can't load, so the page always renders.
import { useEffect, useState } from 'react';

import { db } from './supabase';

export interface Partner { id: string; name: string; short_name: string; type: string; street: string; lat: number | null; lng: number | null }
export interface ClassType { id: string; partner_id: string; title: string; discipline: string; category: string; credits: number | null; image: string | null; session_type: string }
export interface Session { class_id: string; starts_at: string; spots_left: number; packpass_spots: number }
export interface Catalog { partners: Partner[]; classes: ClassType[]; sessions: Session[]; live: boolean }

const FALLBACK: Catalog = {
  live: false,
  partners: [
    { id: 'ridgeline', name: 'Ridgeline Dog Sport', short_name: 'Ridgeline', type: 'sport_club', street: 'Manor Rd', lat: 30.2905, lng: -97.6985 },
    { id: 'northside', name: 'Northside Canine', short_name: 'Northside', type: 'facility', street: 'Burnet Rd', lat: 30.329, lng: -97.739 },
    { id: 'eastfield', name: 'Eastfield Park', short_name: 'Eastfield', type: 'outdoor_space', street: 'Webberville Rd', lat: 30.269, lng: -97.702 },
    { id: 'eastside', name: 'Eastside Dog Club', short_name: 'Eastside', type: 'facility', street: 'E Cesar Chavez St', lat: 30.258, lng: -97.723 },
    { id: 'southfork', name: 'South Fork Yard', short_name: 'South Fork', type: 'outdoor_space', street: 'S Lamar Blvd', lat: 30.24, lng: -97.786 },
  ],
  classes: [
    ['agility-drop-in', 'ridgeline', 'Agility drop-in', 'Agility', 'sport', 2, 'weave', 'class'],
    ['herding-assessment', 'ridgeline', 'Herding assessment', 'Herding', 'sport', 2, 'collie', 'assessment'],
    ['lure-sprint', 'eastfield', 'Lure Sprint Heats', 'Sprint', 'sport', 2, 'sprint', 'class'],
    ['scent-work', 'northside', 'Scent Work I', 'Scent', 'scent', 2, 'grass', 'class'],
    ['sniff-space', 'southfork', 'Sniff space', 'Sniff', 'scent', 1, 'wall', 'class'],
    ['open-field', 'eastfield', 'Open Field Session', 'Open play', 'play', 1, 'leap', 'class'],
    ['small-group-play', 'eastside', 'Small-group play', 'Play', 'play', 1, 'tunnel', 'class'],
    ['focus-recall', 'northside', 'Focus and Recall', 'Skills', 'skills', 2, 'hurdle', 'class'],
    ['calm-private', 'eastside', 'Calm around dogs', 'Skills', 'skills', 3, 'rail', 'private'],
  ].map(([id, partner_id, title, discipline, category, credits, image, session_type]) =>
    ({ id, partner_id, title, discipline, category, credits, image, session_type }) as ClassType),
  sessions: [],
};

async function load(): Promise<Catalog> {
  if (!db) return FALLBACK;
  const [p, c, s] = await Promise.all([
    db.from('partners').select('id, name, short_name, type, street, lat, lng'),
    db.from('class_types').select('id, partner_id, title, discipline, category, credits, image, session_type').eq('status', 'live'),
    db.from('sessions').select('class_id, starts_at, spots_left, packpass_spots').gt('starts_at', new Date().toISOString()).gt('spots_left', 0)
      .order('starts_at').limit(400),
  ]);
  if (p.error || c.error || s.error || !p.data?.length || !c.data?.length) return FALLBACK;
  return { partners: p.data as Partner[], classes: c.data as ClassType[], sessions: (s.data ?? []) as Session[], live: true };
}

let cached: Promise<Catalog> | null = null;
export function useCatalog() {
  const [cat, setCat] = useState<Catalog>(FALLBACK);
  useEffect(() => {
    cached ??= load().catch(() => FALLBACK);
    let live = true;
    cached.then((c) => live && setCat(c));
    return () => { live = false; };
  }, []);
  return cat;
}

/** The areas the member app offers ("Trains near"), with a rough centre for each. */
export const AREAS = [
  { label: 'Austin · East', lat: 30.262, lng: -97.715 },
  { label: 'Austin · South', lat: 30.229, lng: -97.788 },
  { label: 'Austin · Central', lat: 30.274, lng: -97.743 },
  { label: 'Mueller', lat: 30.298, lng: -97.705 },
  { label: 'Cedar Park', lat: 30.505, lng: -97.82 },
];

export function miles(a: { lat: number; lng: number }, b: { lat: number | null; lng: number | null }) {
  if (b.lat == null || b.lng == null) return null;
  const r = (d: number) => (d * Math.PI) / 180, R = 3958.8;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const TZ = 'America/Chicago';
/** "Sat 9:00 am", in Austin time. */
export const when = (iso: string) => {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(d);
  const t = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(d).toLowerCase();
  return `${day} ${t}`;
};
export const creditsLabel = (n: number | null) => (n == null ? '' : `${n} credit${n === 1 ? '' : 's'}`);
export const PARTNER_TYPE: Record<string, string> = { trainer: 'Independent trainer', facility: 'Training facility', sport_club: 'Sport club', behavior_specialist: 'Behavior specialist', outdoor_space: 'Outdoor space' };

export async function submitLead(type: string, name: string, business: string, email: string, zip: string) {
  if (!db) throw new Error('offline');
  const { error } = await db.rpc('submit_partner_lead', { p_type: type, p_name: name, p_business: business, p_email: email, p_zip: zip });
  if (error) throw new Error(error.message);
}
