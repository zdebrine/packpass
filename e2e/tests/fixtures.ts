import { test as base, expect } from '@playwright/test';

// Every test runs offline apart from the local stack: a request to anything else (the live Supabase project,
// Stripe, analytics, image CDNs) is blocked, and one aimed at Supabase or Stripe fails the test.
export const test = base.extend({
  page: async ({ page }, use) => {
    const live: string[] = [];
    await page.route(/^https?:\/\/(?!(127\.0\.0\.1|localhost)[:/])/, (route) => {
      const url = route.request().url();
      if (/supabase\.co|stripe\.com/.test(url)) live.push(url);
      return route.abort('blockedbyclient');
    });
    await use(page);
    expect(live, 'requests to live services').toEqual([]);
  },
});
export { expect };

export const API = process.env.API ?? 'http://127.0.0.1:54399';
export const CODE = '123456'; // the local gateway accepts this code for every email

import { execFileSync } from 'node:child_process';
/** Runs SQL on the local test database (run.sh sets DB and the PG* variables) and returns psql's unaligned output. */
export const sql = (query: string) =>
  execFileSync('psql', ['-d', process.env.DB ?? 'packpass_screens', '-Atqc', query]).toString().trim();

/** A confirmed account on the local gateway, as if the person had entered their emailed code. Returns its user id. */
export async function account(email: string, password: string): Promise<string> {
  const post = (path: string, body: object) =>
    fetch(`${API}/auth/v1/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
  const user = await post('signup', { email, password });
  await post('verify', { email, token: CODE, type: 'signup' });
  return user.id;
}
