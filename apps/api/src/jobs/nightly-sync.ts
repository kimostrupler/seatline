/**
 * Nightly: people sync for every workspace connected to Microsoft 365, then HR leaving dates
 * that have come, then the scheduled move plans that are due (after the sync, so people who left are already inactive), then the
 * privacy clean-up (history older than each workspace's retention period).
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
  const { MovesService, zurichToday } = await import('../moves/moves.service');
  const { PrivacyService } = await import('../privacy/privacy.service');
  const { BillingService } = await import('../billing/billing.service');
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

    const today = zurichToday();
    // HR leaving dates that have come (before moves, so a leaver's seat counts as free)
    const { PeopleService } = await import('../people/people.service');
    for (const tenantId of await app.get(TenantDb).listLeavingTenants(today)) {
      const n = await app.get(PeopleService).leaveDue(tenantId, today);
      logger.log(`${tenantId}: ${n} people left as planned`);
    }

    for (const tenantId of await app.get(TenantDb).listDueMoveTenants(today)) {
      const results = await app.get(MovesService).applyDue(tenantId, today);
      for (const r of results)
        if (r.ok) logger.log(`${tenantId}: move plan ${r.id} applied`);
        else
          logger.error(`${tenantId}: move plan ${r.id} could not be applied (see the Moves page)`);
    }

    // privacy: delete history older than each workspace's retention period
    for (const t of await app.get(TenantDb).listRetentionTenants()) {
      const result = await app.get(PrivacyService).purge(t.id, t.months);
      logger.log(`${t.id}: privacy clean-up ${JSON.stringify(result)}`);
    }

    // billing: the subscription follows the number of active seats
    const billing = app.get(BillingService);
    if (billing.configured)
      for (const tenantId of await app.get(TenantDb).listBilledTenants()) {
        try {
          const r = await billing.syncSeats(tenantId);
          if (r.changed) logger.log(`${tenantId}: now billed for ${r.seats} seats`);
        } catch (error) {
          logger.error(`${tenantId}: could not update the billed seats: ${String(error)}`);
        }
      }
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
