import { defineConfig, devices } from '@playwright/test';

// End-to-end tests: the real web app + real API against a separate database
// (seatline_e2e), which every test resets and re-seeds. Run `pnpm build` first.
const E2E_APP_DATABASE_URL =
  process.env.E2E_APP_DATABASE_URL ??
  'postgresql://seatline_app:seatline_app@localhost:5432/seatline_e2e';
const WEB_PORT = 3100;
const API_PORT = 3101;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1, // one shared database
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    {
      command: 'node ../api/dist/main.js',
      url: `http://localhost:${API_PORT}/health`,
      env: { PORT: String(API_PORT), APP_DATABASE_URL: E2E_APP_DATABASE_URL, DEV_AUTH: 'true' },
      reuseExistingServer: false,
    },
    {
      command: `pnpm exec next start --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      env: { API_URL: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
    },
  ],
});
