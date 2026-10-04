import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

/** Signed-out reads of the public catalog, and the partner lead form. Null if the env isn't set. */
export const db = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

export const DASHBOARD_URL = (import.meta.env.VITE_DASHBOARD_URL as string | undefined) || 'https://packpass-partner.vercel.app';
export const APPLY_URL = `${DASHBOARD_URL}/?apply=1`;
export const IOS_URL = (import.meta.env.VITE_IOS_URL as string | undefined) || '';
export const ANDROID_URL = (import.meta.env.VITE_ANDROID_URL as string | undefined) || '';
