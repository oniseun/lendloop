import nextEnv from '@next/env';
import { defineConfig, devices } from '@playwright/test';

// Loads .env.local the same way `next dev` does, so the suite sees the
// Clerk keys, Convex URLs and E2E_PASSWORD.
nextEnv.loadEnvConfig(process.cwd());

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global.setup.ts',
  // The specs share one Convex deployment and walk a loan through its
  // states, so they run one at a time.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  // Starts Next.js unless E2E_BASE_URL points at a running app. Convex
  // (and optionally n8n + Mailpit) must already be running.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: process.env.CI ? 'npm run start' : 'npm run dev:frontend',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
