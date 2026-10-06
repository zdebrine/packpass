import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined;
if (!url || !key) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_KEY (see apps/partner/.env).');

export const db = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });

/** Throws the error message (a short code from the partner functions) or returns the data. */
export function check<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

/** The public website, which hosts the membership and partner terms, privacy policy and support page. */
export const SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) || 'https://packpass-landing.vercel.app').replace(/\/$/, '');
