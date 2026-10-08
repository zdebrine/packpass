import type { Page } from '@playwright/test';
import { account, expect, sql, test } from './fixtures';

// The partner dashboard against the local database, signed in as an owner of the seeded Eastside Dog Club.

async function signIn(page: Page, role: 'owner' | 'trainer' = 'owner') {
  const email = `${role}-${Date.now()}@example.com`;
  const id = await account(email, 'goodpass123');
  sql(`insert into partner_staff (user_id, partner_id, role) values ('${id}', 'eastside', '${role}')`);
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('goodpass123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Eastside Dog Club').first()).toBeVisible();
  return email;
}

/** A member with one dog booked on the next Eastside group class. Returns the session and booking ids. */
async function bookedDog() {
  const member = await account(`member-${Date.now()}@example.com`, 'goodpass123');
  const session = sql(`select s.id from sessions s join class_types c on c.id = s.class_id
    where c.partner_id = 'eastside' and c.session_type = 'class' and s.starts_at > now() order by s.starts_at limit 1`);
  const dog = sql(`insert into dogs (owner_id, name, breed, energy, sociability) values ('${member}', 'Biscuit', 'Beagle', 'medium', 'loves_dogs') returning id`);
  const booking = sql(`insert into bookings (session_id, dog_id, member_id, credits_charged) values ('${session}', '${dog}', '${member}', 1) returning id`);
  return { session, booking };
}

test('a partner signs in and sees the dashboard', async ({ page }) => {
  await signIn(page);
  for (const link of ['Overview', 'Schedule', 'Classes', 'Roster', 'Earnings', 'Team']) {
    await expect(page.getByRole('link', { name: link })).toBeVisible();
  }
  // Terms, privacy and support are one click away.
  for (const link of ['Support', 'Terms', 'Privacy']) await expect(page.getByRole('link', { name: link })).toHaveAttribute('href', /127\.0\.0\.1:8083\//);
  await page.getByRole('link', { name: 'Classes' }).click();
  await expect(page.getByText('Free roam').first()).toBeVisible();
});

test('a partner checks a dog in from the roster and undoes it', async ({ page }) => {
  const { session, booking } = await bookedDog();
  await signIn(page);
  await page.goto(`/roster?s=${session}`);
  await expect(page.getByText('Biscuit')).toBeVisible();
  await expect(page.getByText('0 of 1 checked in')).toBeVisible();
  await page.getByRole('button', { name: 'Check in' }).click();
  await expect(page.getByText('1 of 1 checked in')).toBeVisible();
  expect(sql(`select status from bookings where id = '${booking}'`)).toBe('checked_in');
  // Tapping Checked in again undoes it, for a dog checked in by mistake.
  await page.getByRole('button', { name: 'Checked in' }).click();
  await expect(page.getByText('0 of 1 checked in')).toBeVisible();
  expect(sql(`select status from bookings where id = '${booking}'`)).toBe('booked');
});

test('a partner uploads a trainer photo', async ({ page }) => {
  await signIn(page);
  const trainer = sql(`select id || '|' || name from trainers where partner_id = 'eastside' order by id limit 1`).split('|');
  await page.goto('/trainers');
  await expect(page.getByText(trainer[1]).first()).toBeVisible();
  // The first trainer's photo input; the browser crops and resizes it before it goes to storage.
  await page.locator('input[type=file]').first().setInputFiles(new URL('../../apps/member/assets/brand/app-icon.png', import.meta.url).pathname);
  await expect.poll(() => sql(`select photo_url from trainers where id = '${trainer[0]}'`)).toMatch(/^eastside\/.+\.jpg$/);
  expect(sql(`select count(*) from storage.objects where bucket_id = 'partner-media' and name like 'eastside/%'`)).not.toBe('0');
});
