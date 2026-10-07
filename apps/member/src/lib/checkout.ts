import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { checkout } from '@/api/live';
import type { PlanKey } from '@/data/types';
import { useApp } from '@/store/app';

export type PayOutcome = 'done' | 'cancel' | 'switched' | 'away';

/** Where Stripe Checkout comes back to: this page on the web, the app's own route on a phone. */
function backTo(path: string) {
  if (Platform.OS !== 'web') return Linking.createURL(path);
  const u = new URL(window.location.href);
  u.searchParams.delete('checkout');
  return u.toString();
}

/**
 * Pays through Stripe Checkout (a plan, or a 2-credit top-up). On a phone it opens Stripe in an in-app browser and
 * resolves when the member comes back; on the web the page goes to Stripe and returns with ?checkout=done ('away').
 * Switching an existing plan needs no payment and resolves 'switched'. Credits arrive through the webhook, so a
 * 'done' is followed by settle().
 */
export async function pay(what: { plan: PlanKey } | 'credits', path: string): Promise<PayOutcome> {
  const back = backTo(path);
  const url = await checkout(what === 'credits' ? { action: 'credits', back } : { action: 'plan', plan: what.plan, back });
  if (!url) return 'switched';
  if (Platform.OS === 'web') {
    window.location.assign(url);
    return 'away';
  }
  const r = await WebBrowser.openAuthSessionAsync(url, back);
  return r.type === 'success' && r.url.includes('checkout=done') ? 'done' : 'cancel';
}

/**
 * Opens Stripe's billing portal (card on file, receipts, billing email) and resolves when the member is back.
 * On the web the page goes to Stripe and comes back with ?checkout=portal.
 */
export async function manageBilling(path: string) {
  const url = await checkout({ action: 'portal', back: backTo(path) });
  if (!url) return;
  if (Platform.OS === 'web') { window.location.assign(url); return; }
  await WebBrowser.openAuthSessionAsync(url, backTo(path));
  await useApp.getState().refresh().catch(() => {});
}

/** After a payment: reloads until the webhook's credits or plan show up (a few seconds at most). */
export async function settle() {
  const before = JSON.stringify([useApp.getState().credits, useApp.getState().membership]);
  for (let i = 0; i < 8; i++) {
    await useApp.getState().refresh().catch(() => {});
    if (JSON.stringify([useApp.getState().credits, useApp.getState().membership]) !== before) return true;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}
