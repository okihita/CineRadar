import { defineConfig, devices } from '@playwright/test';

/**
 * CineRadar Playwright E2E & Performance Configuration
 *
 * Uses dedicated test ports (3100 for web, 3101 for studio) to avoid
 * any port collision with active dev servers on 3000/3001.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter studio exec next start -p 3101 -H 127.0.0.1',
      url: 'http://127.0.0.1:3101',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        PLAYWRIGHT_TEST: '1',
        AUTH_URL: 'http://127.0.0.1:3101',
      },
    },
    {
      command: 'pnpm --filter web exec next start -p 3100 -H 127.0.0.1',
      url: 'http://127.0.0.1:3100',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        PLAYWRIGHT_TEST: '1',
      },
    },
  ],
});
