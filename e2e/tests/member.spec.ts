import type { Page } from '@playwright/test';
import { account, CODE, expect, sql, test } from './fixtures';

// The member app's web build in live mode, on a phone-sized screen, against the local database.
// One account goes from Welcome to a booked Social assessment and back, the way a new member would.

const visible = (page: Page) => ({
  button: (name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' }).filter({ visible: true }),
  boxes: () => page.getByRole('textbox').filter({ visible: true }),
  text: (t: string | RegExp) => page.getByText(t).filter({ visible: true }).first(),
});

test('a new member signs up, adds a dog and vaccines, books and cancels', async ({ page }) => {
  const ui = visible(page);
  const email = `member-${Date.now()}@example.com`;

  await page.goto('/');
  await page.getByText('CREATE ACCOUNT').click();
  await ui.boxes().nth(0).fill('Sam Rivera');
  await ui.boxes().nth(1).fill(email);
  await ui.boxes().nth(2).fill('goodpass123');
  await ui.button('Create account').click();

  await expect(ui.text(`We sent a 6-digit code to ${email}.`)).toBeVisible();
  await ui.boxes().first().fill(CODE);
  await ui.button('Verify').click();

  // Onboarding: the dog, details, play style, traits, the Athlete Card, then the suggested month.
  await expect(ui.text('Tell us about your pup')).toBeVisible();
  await ui.boxes().first().fill('Juno');
  await ui.button('Female').click();
  await ui.button('Continue').click();
  await expect(ui.text("Juno's details.")).toBeVisible();
  await ui.boxes().first().fill('Border Collie');
  await ui.button('Continue').click();
  await expect(ui.text('How does Juno play?')).toBeVisible();
  // Continue stays off until the member says how the dog is with other dogs (no sample answer on live builds).
  await expect(ui.button('Continue')).toBeDisabled();
  for (const pick of ['Needs a job', 'Loves dogs', 'Agility', 'Scent']) await ui.button(pick).click();
  await ui.button('Continue').click();
  await expect(ui.text('Tell us about Juno.')).toBeVisible();
  await ui.button('Pulls like a sled dog').click();
  await ui.button('Continue').click();
  await expect(ui.text('Juno is on the roster.')).toBeVisible();
  await ui.button("See Juno's month").click();
  await expect(ui.text("Juno's month.")).toBeVisible();
  await ui.button('Skip for now').click();

  // Today: the dog is saved, with the 2-credit launch trial.
  await expect(ui.text('Up next')).toBeVisible();
  const dog = sql(`select d.name || '|' || d.breed || '|' || d.energy || '|' || d.sociability || '|' || array_to_string(d.traits, ',')
    from dogs d join auth.users u on u.id = d.owner_id where u.email = '${email}'`);
  expect(dog).toBe('Juno|Border Collie|high|loves_dogs|pulls');

  // Vaccines: every class needs all three current.
  await page.goto('/vaccines');
  const year = String(new Date().getFullYear() + 1);
  for (const v of ['Rabies', 'DHPP', 'Bordetella']) {
    await page.getByRole('button', { name: `${v} expiry month` }).click();
    await ui.button('Dec').click();
    await page.getByRole('button', { name: `${v} expiry year` }).click();
    await ui.button(year).click();
  }
  await ui.button('Save vaccines').click();
  await expect(ui.text(`Expires Dec ${year}`)).toBeVisible();
  // Live builds don't show the sample care notes.
  await expect(page.getByText('Nervous around men in hats')).toHaveCount(0);

  // Book a Social assessment more than 12 hours out, then cancel it: the credits come back.
  const session = sql(`select id from sessions where class_id = 'social-assessment' and starts_at > now() + interval '2 days' and spots_left > 0
    order by starts_at limit 1`);
  await page.goto(`/class/${session}`);
  await expect(ui.text('Social assessment')).toBeVisible();
  await ui.button('Book for 2 credits').click();
  await expect(ui.text('0 credits left after booking')).toBeVisible();
  await ui.button('Confirm booking').click();
  await expect(ui.text('Booked.')).toBeVisible();
  expect(sql(`select b.status || '|' || b.credits_charged from bookings b join dogs d on d.id = b.dog_id join auth.users u on u.id = d.owner_id
    where u.email = '${email}'`)).toBe('booked|2');

  await ui.button('Done').click();
  await page.goto(`/class/${session}`);
  await ui.text('Cancel booking').click();
  await expect(ui.text('2 credits go back to your balance, and the spot opens for someone else.')).toBeVisible();
  await ui.button('Yes, cancel').click();
  await expect.poll(() => sql(`select b.status from bookings b join dogs d on d.id = b.dog_id join auth.users u on u.id = d.owner_id
    where u.email = '${email}'`)).toBe('cancelled');
});

test('a returning member signs in and finds plans, terms and sign out', async ({ page }) => {
  const ui = visible(page);
  const email = `back-${Date.now()}@example.com`;
  const id = await account(email, 'goodpass123');
  sql(`insert into dogs (owner_id, name, breed, birth_year, energy, sociability) values ('${id}', 'Otis', 'Labrador', 2020, 'medium', 'loves_dogs')`);

  await page.goto('/');
  await page.getByText('I already have an account').click();
  await ui.boxes().nth(0).fill(email);
  await ui.boxes().nth(1).fill('goodpass123');
  await ui.button('Sign in').click();
  await expect(ui.text(/Otis/)).toBeVisible();

  // Plan and credits lists the three plans; nothing here opens Stripe until a plan is picked.
  await page.goto('/plan');
  for (const price of ['$79', '$129', '$189']) await expect(ui.text(price)).toBeVisible();

  await page.goto('/settings');
  for (const link of ['Membership terms', 'Privacy policy']) await expect(ui.text(link)).toBeVisible();
  await ui.text('Sign out').click();
  await expect(page.getByText('CREATE ACCOUNT')).toBeVisible();
});
