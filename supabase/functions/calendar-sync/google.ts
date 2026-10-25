// Google Calendar, two-way (migrations/…_google_calendar.sql): the parts of the sync that don't touch the network,
// so they can be tested on their own (node --test supabase/functions/calendar-sync/google.test.ts).

import type { Busy } from './ics.ts';

export const SCOPES = 'openid email https://www.googleapis.com/auth/calendar.events';

/** Google's consent page. Offline access and a forced prompt, so Google sends a refresh token. */
export function authUrl(clientId: string, redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: SCOPES, state,
    access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

/** The account's email from the ID token Google's token endpoint returned (straight from Google, so not re-verified). */
export function emailFromIdToken(idToken: string | undefined): string | null {
  const part = idToken?.split('.')[1];
  if (!part) return null;
  try {
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=')));
    return typeof json.email === 'string' ? json.email : null;
  } catch {
    return null;
  }
}

export interface GoogleEvent {
  id?: string;
  status?: string;
  summary?: string;
  transparency?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
}

/** Busy times from a page of events: timed ones only (as with iCal feeds), skipping cancelled, free and PackPass's own. */
export function busyFromEvents(items: GoogleEvent[]): Busy[] {
  const out: Busy[] = [];
  for (const e of items) {
    if (e.status === 'cancelled' || e.transparency === 'transparent' || e.extendedProperties?.private?.packpass) continue;
    const s = e.start?.dateTime, en = e.end?.dateTime;
    if (!s || !en) continue;
    const a = new Date(s), b = new Date(en);
    if (Number.isNaN(+a) || Number.isNaN(+b) || b <= a) continue;
    out.push({ starts_at: a.toISOString(), ends_at: b.toISOString(), title: (e.summary ?? '').trim() });
  }
  return out;
}

/** A row from calendar_google_exports: a session with dogs booked (title set), its event if written, or both. */
export interface ExportRow {
  session_id: string; starts_at: string | null; ends_at: string | null; title: string | null; dogs: string | null;
  event_id: string | null; hash: string | null;
}

/** The event PackPass writes for a session: the class and dogs, a roster link, and a mark so it's never read back as busy. */
export function eventFor(row: ExportRow, partnerUrl: string): GoogleEvent & { description: string } {
  const roster = `${partnerUrl.replace(/\/$/, '')}/roster?s=${row.session_id}`;
  return {
    summary: `${row.title} · ${row.dogs}`,
    description: `Booked through PackPass: ${row.dogs}.\nRoster: ${roster}`,
    start: { dateTime: new Date(row.starts_at!).toISOString() },
    end: { dateTime: new Date(row.ends_at!).toISOString() },
    transparency: 'opaque',
    extendedProperties: { private: { packpass: row.session_id } },
  };
}

/** A short fingerprint of what an event says, so unchanged sessions aren't written again. */
export async function hashEvent(e: GoogleEvent & { description: string }): Promise<string> {
  const text = [e.summary, e.description, e.start?.dateTime, e.end?.dateTime].join('\n');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest).slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}

export type Step =
  | { kind: 'insert'; row: ExportRow; event: GoogleEvent; hash: string }
  | { kind: 'update'; row: ExportRow; event: GoogleEvent; hash: string }
  | { kind: 'remove'; row: ExportRow };

/** What to do to the calendar: write new sessions, rewrite changed ones, remove ones no longer booked. */
export async function plan(rows: ExportRow[], partnerUrl: string): Promise<Step[]> {
  const steps: Step[] = [];
  for (const row of rows) {
    if (!row.title) {
      if (row.event_id) steps.push({ kind: 'remove', row });
      continue;
    }
    const event = eventFor(row, partnerUrl);
    const hash = await hashEvent(event);
    if (!row.event_id) steps.push({ kind: 'insert', row, event, hash });
    else if (row.hash !== hash) steps.push({ kind: 'update', row, event, hash });
  }
  return steps;
}
