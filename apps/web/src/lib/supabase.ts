import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

/** Signed-out reads of the public catalog, and the partner lead form. Null if the env isn't set. */
export const db = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

export const DASHBOARD_URL = (import.meta.env.VITE_DASHBOARD_URL as string | undefined) || 'https://packpass-partner.vercel.app';
export const APPLY_URL = `${DASHBOARD_URL}/?apply=1`;
export const IOS_URL = (import.meta.env.VITE_IOS_URL as string | undefined) || '';
export const ANDROID_URL = (import.meta.env.VITE_ANDROID_URL as string | undefined) || '';

/** The app is in the stores. Until then (unset), the site collects founding-member signups instead of store links. */
export const APP_LIVE = import.meta.env.VITE_APP_LIVE === 'true';
/** Stripe Payment Link for the Founding Pack. Unset runs the free waitlist only. */
export const FOUNDING_PACK_URL = (import.meta.env.VITE_FOUNDING_PACK_URL as string | undefined) || '';
