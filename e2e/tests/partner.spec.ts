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
  await expect(page.getByText(/^Checked in \d/)).toBeVisible();
  // Undo, for a dog checked in by mistake.
  await page.getByRole('button', { name: 'Undo' }).click();
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

test('picking Herding makes a new class built for herding breeds, and the preview counts who can book', async ({ page }) => {
  const member = await account(`collie-${Date.now()}@example.com`, 'goodpass123');
  sql(`insert into dogs (owner_id, name, breed, birth_year, weight_lb) values ('${member}', 'Kep', 'Border Collie', 2022, 40)`);
  await signIn(page);
  await page.goto('/classes/new');
  await page.getByLabel('Class name').fill('Herding basics');
  await page.getByRole('button', { name: 'Herding', exact: true }).click();
  await page.getByRole('button', { name: 'Use the dog chilling photo' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('What happens in the session').fill('Dogs meet a small flock of ducks on a long line with the trainer.');
  await page.getByRole('button', { name: 'Continue' }).click();
  // Step 3: the discipline filled in who it's for, and the preview says how many dogs could book it.
  await expect(page.getByRole('button', { name: 'Herding', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '25 lb+' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '1 year+' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/PackPass dogs? can book this · \d+ (is a Built for match|are Built for matches)/)).toBeVisible();
});

test('a partner asks for Only these breeds, PackPass approves it, and a trainer marks a dog Assessed fit', async ({ page }) => {
  const email = await signIn(page);
  await page.goto('/classes');
  await page.getByText('Free roam').first().click();
  await page.getByRole('button', { name: 'Terrier', exact: true }).click();
  await page.getByRole('switch', { name: 'Only these breeds' }).locator('..').click();
  await page.getByRole('button', { name: 'Insurance requirement' }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Waiting for PackPass review. Every dog can book until it\'s approved.')).toBeVisible();
  expect(sql(`select breed_only_status from class_types where id = 'free-roam'`)).toBe('pending');

  // PackPass approves it from Review.
  sql(`insert into packpass_admins (user_id) select id from auth.users where email = '${email}'`);
  await page.goto('/admin');
  await expect(page.getByText(/^Only Terrier/)).toBeVisible();
  await expect(page.getByText('Why: Insurance requirement')).toBeVisible();
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Why: Insurance requirement')).toHaveCount(0);
  expect(sql(`select breed_only_status from class_types where id = 'free-roam'`)).toBe('approved');
  sql(`update class_types set breed_only = false, built_for = '{}' where id = 'free-roam'`);

  // A trainer lets a dog in past the size and breed limits after its assessment.
  const member = await account(`fit-${Date.now()}@example.com`, 'goodpass123');
  const dog = sql(`insert into dogs (owner_id, name, breed) values ('${member}', 'Pip', 'Pug') returning id`);
  const session = sql(`select s.id from sessions s join class_types c on c.id = s.class_id
    where c.partner_id = 'eastside' and c.grants is not null and s.starts_at > now() order by s.starts_at limit 1`);
  sql(`insert into bookings (session_id, dog_id, member_id, credits_charged) values ('${session}', '${dog}', '${member}', 0)`);
  await page.goto('/assessments');
  await page.getByText(/^Pip ·/).first().click();
  await page.getByRole('switch', { name: 'Assessed fit at Eastside' }).locator('..').click();
  await expect(page.getByText('Pip can book your classes whatever their size or breed limits.', { exact: false })).toBeVisible();
  expect(sql(`select count(*) from dog_fit_overrides where dog_id = '${dog}' and partner_id = 'eastside'`)).toBe('1');
});

test('PackPass sees how fit predicts booking and tunes the weights', async ({ page }) => {
  const email = await signIn(page);
  sql(`insert into packpass_admins (user_id) select id from auth.users where email = '${email}'`);
  const member = await account(`fit-report-${Date.now()}@example.com`, 'goodpass123');
  const dog = sql(`insert into dogs (owner_id, name) values ('${member}', 'Rex') returning id`);
  sql(`insert into match_impressions (dog_id, session_id, surface, state, score, score_parts, weights, booked)
    select '${dog}', s.id, 'list', 'open', 90, '{"breed":1,"energy":1,"social":1,"interests":1,"balance":0,"history":0}', '{"breed":35}', true
    from sessions s where s.class_id = 'free-roam' and s.starts_at > now() order by s.starts_at limit 1`);
  await page.goto('/admin/fit');
  await expect(page.getByRole('heading', { name: 'Class fit' })).toBeVisible();
  await expect(page.getByText(/of classes shown were booked/)).toBeVisible();
  await expect(page.getByText(/Fewer than 30 dogs so far/)).toBeVisible();

  // Move 5 from breed to balance and save.
  await page.getByRole('button', { name: 'Fewer Breed weight' }).click();
  await expect(page.getByText('Adds up to 95. Make it 100 to save.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save weights' })).toBeDisabled();
  await page.getByRole('button', { name: 'More Balance weight' }).click();
  await page.getByRole('button', { name: 'Save weights' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
  expect(sql(`select breed || ',' || balance from fit_weights`)).toBe('30,15');
  sql(`update fit_weights set breed = 35, balance = 10`);
});

test('an owner adds a waiver with text and a PDF, and a change asks members to sign again', async ({ page }) => {
  await signIn(page);
  await page.goto('/locations');
  await expect(page.getByText('Your waiver')).toBeVisible();
  await page.getByRole('button', { name: 'Add waiver' }).click();
  await page.getByLabel('Point 1').fill('You stay with your dog in group play.');
  await page.getByLabel('Waiver text').fill('Eastside rules for every class.');
  await page.getByLabel('Upload waiver PDF').setInputFiles({ name: 'eastside-waiver.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF\n') });
  await expect(page.getByText('eastside-waiver.pdf')).toBeVisible();
  await page.getByRole('button', { name: 'Save waiver' }).click();
  await expect(page.getByText(/^Version 1 · Saved .+ · 0 members signed$/)).toBeVisible();
  expect(sql(`select title || '|' || array_to_string(summary, ',') || '|' || body || '|' || (pdf_path like 'eastside/%.pdf') from waivers where partner_id = 'eastside' and active`))
    .toBe('Eastside Dog Club waiver|You stay with your dog in group play.|Eastside rules for every class.|true');

  await page.getByRole('button', { name: 'Edit waiver' }).click();
  await expect(page.getByText('Saving a change starts version 2. Members sign it again on their next booking with you.')).toBeVisible();
  await page.getByLabel('Waiver text').fill('');
  await page.getByRole('button', { name: 'Save waiver' }).click();
  await expect(page.getByText(/^Version 2 · /)).toBeVisible();
  expect(sql(`select count(*) || '|' || bool_and(body is null) from waivers where partner_id = 'eastside' and active`)).toBe('1|true');

  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await page.getByRole('button', { name: 'Remove waiver' }).click();
  await expect(page.getByRole('button', { name: 'Add waiver' })).toBeVisible();
  expect(sql(`select count(*) from waivers where partner_id = 'eastside' and active`)).toBe('0');
});

test('an owner duplicates a template, sets its booking rules, schedules a series and archives it', async ({ page }) => {
  await signIn(page);
  const [id, title] = sql(`select id || '|' || title from class_types where partner_id = 'eastside' and status = 'live' and session_type = 'class' and archived_at is null and id not like '%-copy%' order by title limit 1`).split('|');
  await page.goto(`/classes?c=${id}`);
  await page.getByRole('button', { name: `Duplicate ${title}`, exact: true }).click();
  await expect(page.getByRole('status')).toContainText(`Copy of ${title} made`);
  const copy = `Copy of ${title}`;
  await expect(page.getByRole('heading', { name: `Edit ${copy}` })).toBeVisible();

  // Booking rules save without a credit review.
  await page.getByRole('button', { name: 'Fewer PackPass spots' }).click();
  await page.getByRole('switch', { name: 'Members sign your waiver' }).locator('..').click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved. Members see the changes on Book now.')).toBeVisible();
  const copyId = sql(`select id from class_types where title = '${copy.replace(/'/g, "''")}'`);
  expect(sql(`select (packpass_spots = group_size - 1) || '|' || waiver_required || '|' || credit_review from class_types where id = '${copyId}'`)).toBe('true|false|false');

  // Tue and Thu at 5:30 pm for six weeks from tomorrow is 12 sessions.
  await page.getByRole('button', { name: `Schedule series of ${copy}`, exact: true }).click();
  const sheet = page.getByRole('dialog', { name: copy });
  await sheet.getByRole('button', { name: 'Tue', exact: true }).click();
  await sheet.getByRole('button', { name: 'Thu', exact: true }).click();
  await expect(sheet.getByText('12 sessions · Tue and Thu · 5:30 pm')).toBeVisible();
  await expect(sheet.getByText('+4 more')).toBeVisible();
  await expect(sheet.getByText(/no waiver/)).toBeVisible();
  await sheet.getByRole('button', { name: 'Schedule 12 sessions' }).click();
  await expect(page.getByRole('status')).toContainText(`${copy} scheduled. 12 sessions, Tue and Thu at 5:30 pm`);
  expect(sql(`select count(*) || '|' || bool_and(packpass_spots = capacity - 1) from sessions where class_id = '${copyId}' and series_id is not null`)).toBe('12|true');
  await expect(page.getByText('Tue and Thu · 5:30 pm', { exact: true })).toBeVisible();

  // Archived templates leave the table and the Add session picker until restored.
  await page.getByRole('button', { name: `Archive ${copy}`, exact: true }).click();
  await page.getByRole('dialog', { name: copy }).getByRole('button', { name: 'Archive' }).click();
  await expect(page.getByRole('status')).toContainText(`${copy} archived.`);
  await expect(page.getByRole('button', { name: `Duplicate ${copy}`, exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Archived · 1' }).click();
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByRole('button', { name: `Duplicate ${copy}`, exact: true })).toBeVisible();
});

test('a session below its minimum is cancelled at the cutoff, and Run it anyway re-books the dog', async ({ page }) => {
  await signIn(page);
  const member = await account(`min-member-${Date.now()}@example.com`, 'goodpass123');
  const dog = sql(`insert into dogs (owner_id, name, breed, energy, sociability, birth_year, fixed) values ('${member}', 'Pepper', 'Beagle', 'medium', 'loves_dogs', 2021, true) returning id`);
  sql(`insert into vaccinations (dog_id, type, expires_on) select '${dog}', t, current_date + 365 from unnest(enum_range(null::vaccine_type)) t`);
  sql(`insert into clearances (dog_id, type, scope, partner_id, assessed_on, expires_on) values ('${dog}', 'social', 'network', 'eastside', current_date, current_date + 365)`);
  const [session, cls] = sql(`select s.id || '|' || s.class_id from sessions s join class_types c on c.id = s.class_id
    where c.partner_id = 'eastside' and c.session_type = 'class' and c.group_size >= 3 and s.cancelled_at is null and s.starts_at > now() + interval '2 days'
      and public.booking_block('${dog}', s.id) is null order by s.starts_at limit 1`).split('|');
  sql(`select public.book_as('${member}', '${session}', '${dog}')`);
  sql(`update class_types set min_dogs = 3 where id = '${cls}'`);
  sql(`update sessions set starts_at = now() + interval '10 hours', created_at = now() - interval '3 days' where id = '${session}'`);
  expect(sql(`select public.enforce_minimums()`)).toBe('1');

  await page.goto(`/schedule?s=${session}`);
  await expect(page.getByText('Cancelled (low enrollment)')).toBeVisible();
  await expect(page.getByText('Below the minimum of 3 at the 12-hour cutoff.')).toBeVisible();
  await page.getByRole('button', { name: 'Run it anyway' }).click();
  await expect(page.getByText('1 of 3 minimum. You chose to run it.')).toBeVisible();
  expect(sql(`select count(*) from bookings where session_id = '${session}' and dog_id = '${dog}' and status = 'booked'`)).toBe('1');
  expect(sql(`select title from notifications where member_id = '${member}' and kind = 'session_back_on'`)).toMatch(/is back on$/);
  sql(`update class_types set min_dogs = null where id = '${cls}'`);
});

test('an owner sets a template\'s minimum, cutoff and free cancel window', async ({ page }) => {
  await signIn(page);
  const [id, title] = sql(`select id || '|' || title from class_types where partner_id = 'eastside' and status = 'live' and session_type = 'class' and group_size >= 4 and archived_at is null order by title desc limit 1`).split('|');
  await page.goto(`/classes?c=${id}`);
  await expect(page.getByRole('heading', { name: `Edit ${title}` })).toBeVisible();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'More minimum dogs' }).click();
  await page.getByRole('group', { name: 'Minimum cutoff' }).getByRole('button', { name: '24 h' }).click();
  await page.getByRole('group', { name: 'Free cancel window' }).getByRole('button', { name: '48 h' }).click();
  await expect(page.getByText('Below 4 dogs at 24 hours before start, the session cancels on its own.', { exact: false })).toBeVisible();
  await expect(page.getByText('Members cancel free until 48 hours before. Later cancellations and no-shows still pay you.')).toBeVisible();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved. Members see the changes on Book now.')).toBeVisible();
  expect(sql(`select min_dogs || '|' || min_cutoff_hours || '|' || cancel_hours || '|' || credit_review from class_types where id = '${id}'`)).toBe('4|24|48|false');
  sql(`update class_types set min_dogs = null, min_cutoff_hours = 12, cancel_hours = 12 where id = '${id}'`);
});

/** Two dogs on an Eastside group class (no one else booked) that started half an hour ago. Returns the session and both bookings. */
async function startedClass() {
  const member = await account(`ran-${Date.now()}@example.com`, 'goodpass123');
  const session = sql(`select s.id from sessions s join class_types c on c.id = s.class_id
    where c.partner_id = 'eastside' and c.session_type = 'class' and s.starts_at > now() and s.cancelled_at is null
      and not exists (select 1 from bookings b where b.session_id = s.id) order by s.starts_at limit 1`);
  sql(`update sessions set starts_at = now() - interval '30 minutes' where id = '${session}'`);
  const book = (name: string) => {
    const dog = sql(`insert into dogs (owner_id, name, breed, energy, sociability) values ('${member}', '${name}', 'Beagle', 'medium', 'loves_dogs') returning id`);
    return sql(`insert into bookings (session_id, dog_id, member_id, credits_charged) values ('${session}', '${dog}', '${member}', 1) returning id`);
  };
  return { session, a: book('Biscuit'), b: book('Maple') };
}

test('once a class has started, the roster marks a no-show, undoes it and checks a dog in late', async ({ page }) => {
  const { session, a, b } = await startedClass();
  await signIn(page);
  await page.goto(`/roster?s=${session}`);
  await expect(page.getByText(/^Started \d+ min ago\. Mark dogs who didn't come as no-shows\./)).toBeVisible();
  const biscuit = page.locator('.tbl-row').filter({ hasText: 'Biscuit' });
  await biscuit.getByRole('button', { name: 'Mark no-show' }).click();
  await expect(biscuit.getByText('No-show', { exact: true })).toBeVisible();
  expect(sql(`select status from bookings where id = '${a}'`)).toBe('no_show');
  expect(sql(`select count(*) from notifications where kind = 'class_missed' and href like '/missed/${a}%'`)).toBe('1');
  await expect(page.getByText(/· 1 no-show$/)).toBeVisible();
  await biscuit.getByRole('button', { name: 'Undo' }).click();
  await expect(biscuit.getByText('Not checked in')).toBeVisible();
  expect(sql(`select count(*) from notifications where kind = 'class_missed' and href like '/missed/${a}%'`)).toBe('0');
  const maple = page.locator('.tbl-row').filter({ hasText: 'Maple' });
  await maple.getByRole('button', { name: 'Check in late' }).click();
  await expect(maple.getByText(/^Checked in \d/)).toBeVisible();
  expect(sql(`select status from bookings where id = '${b}'`)).toBe('checked_in');
  await expect(page.getByRole('button', { name: 'Start report cards' })).toBeVisible();
});

test('a trainer sends one report card with homework, then the rest of the class at once', async ({ page }) => {
  const { session, a, b } = await startedClass();
  await signIn(page);
  await page.goto(`/roster?s=${session}`);
  await page.getByRole('button', { name: 'Start report cards' }).click();
  await expect(page.getByText('Owners see this as the trainer note after class. 0 of 2 sent.')).toBeVisible();

  // One dog: ratings, a note, a drill and the trainer's own homework line, previewed as the owner sees it.
  await page.locator('[role=button]').filter({ hasText: 'Biscuit' }).click();
  await page.getByRole('group', { name: 'Focus' }).getByRole('button', { name: '3' }).click();
  await page.getByRole('group', { name: 'Sociability' }).getByRole('button', { name: '1' }).click();
  await page.getByLabel('Note', { exact: true }).fill('Great focus through the tunnel.');
  await expect(page.getByText('Great focus through the tunnel.', { exact: true }).last()).toBeVisible();
  const drill = page.locator('.pp-chip:has(svg)').first();
  const drillName = (await drill.textContent())!.trim();
  await drill.click();
  await page.getByLabel('Or type your own').fill('Hand target before meals');
  await expect(page.getByText('Homework · 2 of 3')).toBeVisible();
  await page.getByRole('button', { name: /^Send to / }).click();
  await expect(page.getByText('1 of 2 sent.', { exact: false })).toBeVisible();
  expect(sql(`select focus || ',' || sociability || ',' || skill from report_cards where booking_id = '${a}'`)).toBe('3,1,2');
  expect(sql(`select string_agg(h->>'text', '|') from report_cards, jsonb_array_elements(homework) h where booking_id = '${a}'`)).toBe(`${drillName}|Hand target before meals`);
  expect(sql(`select note from session_notes where booking_id = '${a}'`)).toBe('Great focus through the tunnel.');
  expect(sql(`select title from notifications where kind = 'session_note' and href like '/after-class/${a}%'`)).toMatch(/ left a note for Biscuit\.$/);

  // Whole class: the same homework for every dog not sent yet; a dog without a note gets ratings and homework only.
  await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Whole class' }).click();
  await page.locator('.pp-chip:has(svg)').nth(1).click();
  await expect(page.getByText('1 without a note. They\'ll get ratings and homework only.')).toBeVisible();
  await page.getByRole('button', { name: 'Send 1 report card' }).click();
  await expect(page.getByRole('button', { name: 'All sent' })).toBeVisible();
  expect(sql(`select jsonb_array_length(homework) from report_cards where booking_id = '${b}'`)).toBe('1');
  expect(sql(`select status from bookings where id = '${b}'`)).toBe('checked_in');
  expect(sql(`select count(*) from session_notes where booking_id = '${b}'`)).toBe('0');
});
