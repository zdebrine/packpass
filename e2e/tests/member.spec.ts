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

test('a member adds a second dog from the Dog tab and switches between them', async ({ page }) => {
  const ui = visible(page);
  const email = `two-dogs-${Date.now()}@example.com`;
  const id = await account(email, 'goodpass123');
  sql(`insert into dogs (owner_id, name, breed, birth_year, energy, sociability, area) values ('${id}', 'Juno', 'Border Collie', 2023, 'working', 'loves_dogs', 'Mueller')`);
  const dogs = () => sql(`select string_agg(name || ':' || coalesce(area, ''), ',' order by created_at) from dogs where owner_id = '${id}'`);
  // Juno has a class coming up; it's Juno's alone, so Otis's Today doesn't show it.
  sql(`insert into bookings (session_id, dog_id, member_id, credits_charged)
       select s.id, d.id, d.owner_id, 1 from dogs d, sessions s
       where d.owner_id = '${id}' and s.starts_at > now() + interval '1 day' and s.spots_left > 0 and s.cancelled_at is null
       order by s.starts_at limit 1`);
  const checkIn = page.getByRole('button', { name: 'Check in', exact: true });

  await page.goto('/');
  await page.getByText('I already have an account').click();
  await ui.boxes().nth(0).fill(email);
  await ui.boxes().nth(1).fill('goodpass123');
  await ui.button('Sign in').click();
  await expect(ui.text('Juno is due for a hard day.')).toBeVisible();
  await expect(checkIn).toBeVisible();

  // Backing out of step 1 saves nothing.
  await page.goto('/dog');
  await ui.button('Add a dog').click();
  await expect(ui.text('Step 1 of 5 · Another dog')).toBeVisible();
  await ui.button('Back').click();
  await expect(ui.button('Add a dog')).toBeVisible();
  expect(dogs()).toBe('Juno:Mueller');

  // The same five steps as onboarding, for Otis.
  await ui.button('Add a dog').click();
  await ui.boxes().first().fill('Otis');
  await ui.button('Male').click();
  await ui.button('Continue').click();
  await expect(ui.text("Otis's details.")).toBeVisible();
  await ui.boxes().first().fill('Labrador');
  await ui.button('Continue').click();
  for (const pick of ['Loves dogs', 'Scent']) await ui.button(pick).click();
  await ui.button('Continue').click();
  await expect(ui.text('Tell us about Otis.')).toBeVisible();
  await ui.button('Continue').click();
  await expect(ui.text('Otis is on the roster.')).toBeVisible();
  await ui.button("See Otis's month").click();
  await expect(ui.text("Otis's month.")).toBeVisible();
  await ui.button('Skip for now').click();

  // Otis is saved next to Juno, in the same area, and the app now shows him.
  await expect(ui.text('Otis is due for a hard day.')).toBeVisible();
  expect(dogs()).toBe('Juno:Mueller,Otis:Mueller');
  // Otis's own profile: nothing up next, and Juno's class isn't his.
  await expect(checkIn).toHaveCount(0);

  // The Dog tab's switcher goes back to Juno, and Today follows.
  await page.goto('/dog');
  await ui.button('Juno').click();
  await expect(page.getByRole('button', { name: "Juno's Athlete Card. Tap to see discipline levels." })).toBeVisible();
  await page.goto('/');
  await expect(ui.text('Juno is due for a hard day.')).toBeVisible();
  await expect(checkIn).toBeVisible();
});

test('a class built for herding breeds says so to a herding dog and stays open to others', async ({ page }) => {
  const ui = visible(page);
  const email = `breeds-${Date.now()}@example.com`;
  const id = await account(email, 'goodpass123');
  sql(`insert into dogs (owner_id, name, breed, birth_year, weight_lb, energy, sociability) values ('${id}', 'Juno', 'Border Collie', 2023, 38, 'working', 'loves_dogs')`);
  const session = sql(`select s.id from sessions s where s.class_id = 'herding-fundamentals' and s.starts_at > now() order by s.starts_at limit 1`);

  await page.goto('/');
  await page.getByText('I already have an account').click();
  await ui.boxes().nth(0).fill(email);
  await ui.boxes().nth(1).fill('goodpass123');
  await ui.button('Sign in').click();
  await expect(ui.text(/Juno/)).toBeVisible();
  await page.goto(`/class/${session}`);
  await expect(ui.text('Built for herding breeds. Juno is a Border Collie.')).toBeVisible();

  // A Lab sees the same class as open to every breed.
  sql(`update dogs set breed_ids = '{labrador-retriever}' where owner_id = '${id}'`);
  await page.reload();
  await expect(ui.text('Open to all breeds. Built for herding breeds.')).toBeVisible();
});

test('a herding-breeds-only class turns a Lab away until the partner marks it Assessed fit, and Book logs what it showed', async ({ page }) => {
  const ui = visible(page);
  const email = `breed-only-${Date.now()}@example.com`;
  const id = await account(email, 'goodpass123');
  const dog = sql(`insert into dogs (owner_id, name, breed, birth_year, weight_lb, energy, sociability) values ('${id}', 'Otis', 'Labrador Retriever', 2021, 70, 'medium', 'loves_dogs') returning id`);
  sql(`update class_types set breed_only = true, breed_only_reason = 'Sanctioned trial' where id = 'herding-livestock'`);
  sql(`update class_types set breed_only_status = 'approved' where id = 'herding-livestock'`); // as PackPass would
  const session = sql(`select s.id from sessions s where s.class_id = 'herding-livestock' and s.starts_at > now() order by s.starts_at limit 1`);
  try {
    await page.goto('/');
    await page.getByText('I already have an account').click();
    await ui.boxes().nth(0).fill(email);
    await ui.boxes().nth(1).fill('goodpass123');
    await ui.button('Sign in').click();
    await expect(ui.text(/Otis/)).toBeVisible();
    await page.goto(`/class/${session}`);
    await expect(ui.text('Herding breeds only.')).toBeVisible();
    await expect(ui.text('This class is for herding breeds only.')).toBeVisible();

    // Ridgeline's trainer met Otis and let him in.
    sql(`insert into dog_fit_overrides (dog_id, partner_id, assessor) values ('${dog}', 'ridgeline', 'Maren')`);
    await page.reload();
    await expect(ui.text('Herding breeds only.')).toBeVisible();
    await expect(page.getByText('This class is for herding breeds only.')).toHaveCount(0);

    await page.goto('/book');
    await expect(ui.text('Open to Otis')).toBeVisible();
    await page.getByLabel('See all Sport').filter({ visible: true }).click();
    await expect(ui.text('Nearest first')).toBeVisible();
    // Book opens on today, which can have no Sport classes left (late in the day, or before the seed's first day), so pick the herding class's own day.
    const chip = sql(`select case when (starts_at at time zone 'America/Chicago')::date = (now() at time zone 'America/Chicago')::date then 'Today'
      else to_char(starts_at at time zone 'America/Chicago', 'Dy FMDD') end from sessions where id = '${session}'`);
    await ui.button(chip).click();
    await expect(ui.text(/^[1-9]\d* class(es)? · \d+ open to Otis$/)).toBeVisible();
    await expect.poll(() => Number(sql(`select count(*) from match_impressions where dog_id = '${dog}' and surface = 'list' and weights ->> 'breed' = '35' and (score_parts ->> 'breed')::numeric <= 1`))).toBeGreaterThan(0);
  } finally {
    sql(`update class_types set breed_only = false where id = 'herding-livestock'`);
  }
});
