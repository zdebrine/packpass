// Turns a new notifications row into Expo push messages and delivers them. Kept free of Deno and
// Supabase imports so it runs under Node for tests (push.test.ts).

/** Notifications worth interrupting someone for. The rest (e.g. "Booked.") stay in the app. */
export const PUSH_KINDS = new Set(['hold_expiring', 'holds_released', 'clearance_earned']);

export type NotificationRow = { id: string; member_id: string; kind: string; title: string; body: string; href: string | null };
export type ExpoMessage = { to: string; title: string; body: string; sound: 'default'; data: { href: string; notificationId: string } };
export type ExpoTicket = { status: 'ok'; id: string } | { status: 'error'; message: string; details?: { error?: string } };

export type Deps = {
  tokensFor: (memberId: string) => Promise<string[]>;
  send: (messages: ExpoMessage[]) => Promise<ExpoTicket[]>;
  /** Drops tokens Expo says no longer reach a device (app removed, permission revoked). */
  forget: (tokens: string[]) => Promise<void>;
};

export function messagesFor(n: NotificationRow, tokens: string[]): ExpoMessage[] {
  if (!PUSH_KINDS.has(n.kind)) return [];
  return tokens.map((to) => ({ to, title: n.title, body: n.body, sound: 'default', data: { href: n.href ?? '/notifications', notificationId: n.id } }));
}

/** Sends one notification to every device of its member. Returns how many pushes Expo accepted. */
export async function deliver(n: NotificationRow, deps: Deps): Promise<{ sent: number; forgotten: number }> {
  if (!PUSH_KINDS.has(n.kind)) return { sent: 0, forgotten: 0 };
  const messages = messagesFor(n, await deps.tokensFor(n.member_id));
  let sent = 0;
  const gone: string[] = [];
  // Expo takes at most 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    const tickets = await deps.send(batch);
    tickets.forEach((t, j) => {
      if (t.status === 'ok') sent++;
      else if (t.details?.error === 'DeviceNotRegistered') gone.push(batch[j].to);
    });
  }
  if (gone.length) await deps.forget(gone);
  return { sent, forgotten: gone.length };
}

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export function expoSender(fetchFn: typeof fetch, accessToken?: string) {
  return async (messages: ExpoMessage[]): Promise<ExpoTicket[]> => {
    const res = await fetchFn(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) },
      body: JSON.stringify(messages),
    });
    if (!res.ok) throw new Error(`expo_push_${res.status}`);
    return ((await res.json()) as { data: ExpoTicket[] }).data;
  };
}
