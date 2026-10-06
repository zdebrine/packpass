import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

/**
 * Live mode is on when both env vars are set (see apps/member/.env.example). Without them the
 * app runs on the sample data in src/data, exactly as in v1.
 */
export const isLive = !!url && !!key;

/** Public URL of a partner's uploaded photo (class cover or trainer photo) in the partner-media bucket. */
export const partnerMediaUrl = (path: string) => `${url}/storage/v1/object/public/partner-media/${path}`;

export const supabase: SupabaseClient | null = isLive
  ? createClient(url!, key!, {
      auth: {
        storage: Platform.OS === 'web' ? undefined : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export function db() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}
