import { defineConfig, devices } from '@playwright/test';

// End-to-end tests: the real web app + real API against a separate database
// (seatline_e2e), which every test resets and re-seeds. Run `pnpm build` first.
const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://seatline:seatline@localhost:5432/seatline_e2e';
const E2E_APP_DATABASE_URL =
  process.env.E2E_APP_DATABASE_URL ??
  'postgresql://seatline_app:seatline_app@localhost:5432/seatline_e2e';
const WEB_PORT = 3100;
const API_PORT = 3101;
const BLOB_PORT = 10200;
// Microsoft sign-in tests: a second web app in "entra" mode + a fake Microsoft login
const ENTRA_WEB_PORT = 3102;
const FAKE_MS_PORT = 3104;
const INTERNAL_AUTH_SECRET = 'e2e-internal-secret-0123456789-abcdefghij';
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
      testIgnore: /entra\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      // the same app with Microsoft sign-in (against e2e/fake-microsoft.mjs)
      name: 'entra',
      testMatch: /entra\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        baseURL: `http://localhost:${ENTRA_WEB_PORT}`,
      },
    },
  ],
  webServer: [
    {
      command: `../api/node_modules/.bin/azurite-blob --blobHost 127.0.0.1 --blobPort ${BLOB_PORT} --inMemoryPersistence --silent --skipApiVersionCheck`,
      port: BLOB_PORT,
      reuseExistingServer: false,
    },
    {
      // migrate first: the API needs the latest schema (incl. the job queue) to start
      command: 'pnpm --dir ../api exec prisma migrate deploy && node ../api/dist/main.js',
      url: `http://localhost:${API_PORT}/health`,
      env: {
        PORT: String(API_PORT),
        APP_DATABASE_URL: E2E_APP_DATABASE_URL,
        DATABASE_URL: E2E_DATABASE_URL,
        DEV_AUTH: 'true',
        AZURE_STORAGE_CONNECTION_STRING: BLOB_CONNECTION,
        AZURE_STORAGE_CONTAINER: 'e2e-floor-plans',
        INTERNAL_AUTH_SECRET,
      },
      reuseExistingServer: false,
    },
    {
      command: 'node e2e/fake-microsoft.mjs',
      url: `http://127.0.0.1:${FAKE_MS_PORT}/common/discovery/v2.0/keys`,
      env: { FAKE_MS_PORT: String(FAKE_MS_PORT) },
      reuseExistingServer: false,
    },
    {
      command: `pnpm exec next start --port ${ENTRA_WEB_PORT}`,
      url: `http://localhost:${ENTRA_WEB_PORT}/signin`,
      env: {
        AUTH_MODE: 'entra',
        API_URL: `http://localhost:${API_PORT}`,
        APP_URL: `http://localhost:${ENTRA_WEB_PORT}`,
        ENTRA_CLIENT_ID: 'e2e-client',
        ENTRA_CLIENT_SECRET: 'e2e-secret',
        ENTRA_LOGIN_URL: `http://127.0.0.1:${FAKE_MS_PORT}`,
        SESSION_SECRET: 'e2e-session-secret-0123456789-abcdefghijk',
        INTERNAL_AUTH_SECRET,
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
