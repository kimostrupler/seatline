import type { NestExpressApplication } from '@nestjs/platform-express';

/** What main.ts and the tests both do to a freshly created app. */
export function setupApp(app: NestExpressApplication) {
  // the schemas allow 2000 seats or people in one request (~300 KB); Express's default is 100 KB
  app.useBodyParser('json', { limit: '2mb' });
  return app;
}
