import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests run against the Docker-compose stack.
 * Start the stack first with `make up` (or `docker compose up -d --build`).
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
    // Frontend served by nginx inside the Docker stack
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
