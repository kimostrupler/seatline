/**
 * Nightly people sync for every workspace connected to Microsoft 365.
 * Runs as its own scheduled container (Azure Container Apps Job), so it works even
 * while the API is scaled to zero:  node dist/jobs/nightly-sync.js
 */
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

process.env.JOBS_ENABLED = 'false'; // this process only syncs, it doesn't serve the queue

async function main() {
  const { AppModule } = await import('../app.module');
  const { TenantDb } = await import('../db/tenant-db.service');
  const { PeopleSyncService } = await import('../sync/people-sync.service');
  const logger = new Logger('NightlySync');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    const tenants = await app.get(TenantDb).listSyncTenants();
    let failed = 0;
    for (const t of tenants) {
      const result = await app.get(PeopleSyncService).syncTenant(t.id);
      if (!result.ok) failed++;
      logger.log(`${t.id}: ${JSON.stringify(result)}`);
    }
    logger.log(`Synced ${tenants.length - failed}/${tenants.length} workspaces`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
