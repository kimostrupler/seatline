import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Tests run against a separate database (seatline_test) that they wipe freely.
try {
  process.loadEnvFile('.env'); // doesn't override variables that are already set (CI)
} catch {
  // no .env — fall back to the docker-compose defaults below
}
process.env.TEST_DATABASE_URL ??= 'postgresql://seatline:seatline@localhost:5432/seatline_test';
process.env.TEST_APP_DATABASE_URL ??=
  'postgresql://seatline_app:seatline_app@localhost:5432/seatline_test';

export default defineConfig({
  // SWC instead of esbuild: Nest needs decorator metadata for dependency injection.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globalSetup: './test/global-setup.ts',
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    // all test files share one database
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DEV_AUTH: 'true',
      APP_DATABASE_URL: process.env.TEST_APP_DATABASE_URL,
      // Azurite started by test/global-setup.ts (well-known public dev account key)
      AZURE_STORAGE_CONNECTION_STRING:
        'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10100/devstoreaccount1;',
      AZURE_STORAGE_CONTAINER: 'test-floor-plans',
    },
  },
});
