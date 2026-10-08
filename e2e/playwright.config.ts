import { defineConfig, devices } from '@playwright/test';

// e2e/run.sh starts the local stack and serves the three builds before this runs.
export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
    // Austin, where the partners are: class times read as the app shows them to members.
    timezoneId: 'America/Chicago',
    screenshot: 'only-on-failure',
    // A local Chromium when Playwright's own isn't installed (e.g. PW_CHROMIUM=/opt/pw-browsers/chromium).
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [
    { name: 'website', testMatch: /website\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:8083' } },
    { name: 'partner', testMatch: /partner\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:8082' } },
    // A phone-sized viewport, as members use the app.
    { name: 'member', testMatch: /member\.spec\.ts/, use: { ...devices['Pixel 7'], baseURL: 'http://127.0.0.1:8081' } },
  ],
});
