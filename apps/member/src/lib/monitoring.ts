import * as Sentry from '@sentry/react-native';

/**
 * Crash and error reports through Sentry. Off until EXPO_PUBLIC_SENTRY_DSN is set (Sentry › Project settings ›
 * Client keys); the DSN is public by design, like the Supabase publishable key. Reports carry no names, emails or
 * dog details: only the signed-in account's id, so a report can be matched to a support request.
 */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN || undefined;
export const monitoring = !!dsn;

Sentry.init({
  dsn,
  enabled: monitoring && !__DEV__,
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
});

/** Tag reports with the account id (or clear it on sign-out). */
export function identify(userId: string | null) {
  if (monitoring) Sentry.setUser(userId ? { id: userId } : null);
}

export const wrap = Sentry.wrap;
