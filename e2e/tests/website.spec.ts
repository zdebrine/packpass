import { expect, sql, test } from './fixtures';

// The prerendered website, with its forms pointed at the local database instead of the live project.

test('owner page: pick energy and traits, then join the founding pack', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Join the founding pack.' })).toBeVisible();
  await page.getByRole('button', { name: 'Needs a job' }).first().click();
  await page.getByRole('button', { name: 'Pulls like a sled dog' }).first().click();

  const form = page.locator('form').filter({ has: page.getByText('ZIP code') });
  const email = `owner-${Date.now()}@example.com`;
  await form.getByLabel('ZIP code').fill('7870');
  await form.getByLabel('Email').fill(email);
  await form.locator('button[type=submit]').click();
  await expect(form.getByText('Enter a 5-digit ZIP code.')).toBeVisible();
  await form.getByLabel('ZIP code').fill('78702');
  await form.locator('button[type=submit]').click();
  await expect(page.getByRole('status')).toHaveText(/You’re in\. We’ll email you when booking opens near you\./);
  expect(sql(`select zip || '|' || energy || '|' || array_to_string(traits, ',') from owner_waitlist where email = '${email}'`)).toMatch(/^78702\|high\|.*\bpulls\b/);
});

test('partner page: the earnings form saves a lead and opens the estimate', async ({ page }) => {
  await page.goto('/partners');
  await page.getByRole('button', { name: 'Sport club' }).click();
  const form = page.locator('form').filter({ hasText: 'See my earnings' });
  const email = `club-${Date.now()}@example.com`;
  await form.getByLabel('Your name').fill('Jo Park');
  await form.getByLabel('Business name').fill('Park Dog Sport');
  await form.getByLabel('Work email').fill(email);
  await form.getByLabel('ZIP code').fill('78704');
  await form.getByRole('button', { name: 'See my earnings' }).click();
  await expect(form).toHaveCount(0);
  expect(sql(`select business_type || '|' || business_name || '|' || zip from partner_leads where email = '${email}'`)).toBe('Sport club|Park Dog Sport|78704');
});

test('privacy, terms and support pages are linked and load', async ({ page }) => {
  await page.goto('/');
  for (const [link, heading] of [['Privacy', /privacy/i], ['Terms', /terms/i], ['Support', /support|help/i]] as const) {
    await page.goto('/');
    await page.getByRole('contentinfo').getByRole('link', { name: link, exact: false }).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
  }
});
