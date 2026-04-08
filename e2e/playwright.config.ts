import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests run against the monolithic Docker container.
 * Start the container first with `make up` (or `make e2e` to run fully automated).
 */
export default defineConfig({
  testDir: './tests',
  // Each test file gets a fresh browser context
  fullyParallel: false,
  retries: 0,
  // Short timeout — if the app is running these should be quick
  timeout: 15_000,
  expect: { timeout: 5_000 },

  use: {
    // App served by nginx on port 80 inside the monolithic container
    baseURL: 'http://localhost:80',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
