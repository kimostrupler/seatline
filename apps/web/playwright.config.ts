import { defineConfig, devices } from '@playwright/test';

// End-to-end tests: the real web app + real API against a separate database
// (seatline_e2e), which every test resets and re-seeds. Run `pnpm build` first.
const E2E_APP_DATABASE_URL =
  process.env.E2E_APP_DATABASE_URL ??
  'postgresql://seatline_app:seatline_app@localhost:5432/seatline_e2e';
const WEB_PORT = 3100;
const API_PORT = 3101;
const BLOB_PORT = 10200;
// Azurite's well-known public development account (not a secret)
const BLOB_CONNECTION = `DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:${BLOB_PORT}/devstoreaccount1;`;

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
      command: `../api/node_modules/.bin/azurite-blob --blobHost 127.0.0.1 --blobPort ${BLOB_PORT} --inMemoryPersistence --silent --skipApiVersionCheck`,
      port: BLOB_PORT,
      reuseExistingServer: false,
    },
    {
      command: 'node ../api/dist/main.js',
      url: `http://localhost:${API_PORT}/health`,
      env: {
        PORT: String(API_PORT),
        APP_DATABASE_URL: E2E_APP_DATABASE_URL,
        DEV_AUTH: 'true',
        AZURE_STORAGE_CONNECTION_STRING: BLOB_CONNECTION,
        AZURE_STORAGE_CONTAINER: 'e2e-floor-plans',
      },
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
