// Reads the published site content from Sanity (project in .env) and lays it over DEFAULT_CONTENT. The build
// calls this once (scripts/prerender.mjs) and bakes the result into each page; the dev server calls it on load.
import { DEFAULT_CONTENT, type SiteContent } from './defaults';

const projectId = import.meta.env.VITE_SANITY_PROJECT_ID as string | undefined;
const dataset = (import.meta.env.VITE_SANITY_DATASET as string | undefined) || 'production';

export const SANITY_CONFIGURED = !!projectId;

// One document per part of the site, with fixed ids. If an editor makes another one by hand, the newest wins.
const doc = (type: string) => `coalesce(*[_id == "${type}"][0], *[_type == "${type}"] | order(_updatedAt desc)[0])`;
const QUERY = `{"site": ${doc('siteSettings')}, "owners": ${doc('ownersPage')}, "partners": ${doc('partnersPage')}}`;

/** Published content merged over the defaults. Throws if Sanity is configured but can't be read. */
export async function loadContent(): Promise<SiteContent> {
  if (!projectId) return DEFAULT_CONTENT;
  const url = `https://${projectId}.apicdn.sanity.io/v2025-02-19/data/query/${dataset}?perspective=published&query=${encodeURIComponent(QUERY)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sanity query failed: ${res.status} ${await res.text()}`);
  const { result } = (await res.json()) as { result: unknown };
  return merge(DEFAULT_CONTENT, clean(result)) as SiteContent;
}

type Json = unknown;
const isObj = (v: Json): v is Record<string, Json> => !!v && typeof v === 'object' && !Array.isArray(v);

/** `image-<id>-<w>x<h>-<ext>` → a CDN URL, resized for the page. */
export function imageUrl(ref: string) {
  const m = /^image-([a-f0-9]+)-(\d+x\d+)-(\w+)$/.exec(ref);
  if (!m || !projectId) return null;
  return `https://cdn.sanity.io/images/${projectId}/${dataset}/${m[1]}-${m[2]}.${m[3]}?w=2000&fit=max&auto=format&q=80`;
}

/** Drops Sanity's bookkeeping fields and turns image fields into { src, alt, position } (plus any extra fields). */
function clean(v: Json): Json {
  if (Array.isArray(v)) return v.map(clean).filter((x) => x !== undefined);
  if (!isObj(v)) return v;
  if (v._type === 'image' || isObj(v.asset)) {
    const ref = isObj(v.asset) && typeof v.asset._ref === 'string' ? v.asset._ref : '';
    const src = imageUrl(ref);
    if (!src) return undefined; // no picture chosen: keep the default one
    const { asset: _a, hotspot, crop: _c, ...rest } = v;
    const h = isObj(hotspot) && typeof hotspot.x === 'number' && typeof hotspot.y === 'number' ? hotspot : null;
    return { ...(clean(rest) as object), src, ...(h ? { position: `${Math.round((h.x as number) * 100)}% ${Math.round((h.y as number) * 100)}%` } : {}) };
  }
  const out: Record<string, Json> = {};
  for (const [k, x] of Object.entries(v)) if (!k.startsWith('_')) out[k] = clean(x);
  return out;
}

/** Takes each value from Sanity when it's set, else the default. Lists replace the default list when not empty. */
function merge(def: Json, over: Json): Json {
  if (Array.isArray(def)) {
    if (!Array.isArray(over) || !over.length) return def;
    return over.map((x, i) => merge(def[i] ?? def[0], x));
  }
  if (isObj(def)) {
    if (!isObj(over)) return def;
    const out: Record<string, Json> = { ...def };
    for (const k of Object.keys(def)) out[k] = merge(def[k], over[k]);
    // Optional fields with no default (a hotspot position, the popular flag) come straight through.
    for (const k of Object.keys(over)) if (!(k in def) && over[k] != null && over[k] !== '') out[k] = over[k];
    return out;
  }
  if (typeof def === 'string') return typeof over === 'string' && over.trim() ? over : def;
  if (typeof def === 'number') return typeof over === 'number' ? over : def;
  if (typeof def === 'boolean') return typeof over === 'boolean' ? over : def;
  return over ?? def;
}
