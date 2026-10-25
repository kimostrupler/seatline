/**
 * Runs twice a day (cron 0 1,7 * * * UTC). The night run (01:00): people sync for every workspace connected to Microsoft 365, then HR leaving dates
 * that have come, then the scheduled move plans that are due (after the sync, so people who left are already inactive), then the
 * privacy clean-up (history older than each workspace's retention period), unused plan imports
 * (after 7 days), billing (seat counts, trial reminders), onboarding e-mails. Both runs: outreach (the operator's leads):
 * replies first; the morning run (07:00 UTC = 8 am Zurich in winter, 9 am in summer) also
 * sends the scheduled outreach e-mails and the follow-up reminder.
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
  const logger = new Logger('NightlySync');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    if (new Date().getUTCHours() < 5) await nightly(app, logger);
    const { LeadsService } = await import('../owner/leads.service');
    for (const tenantId of await app.get(TenantDb).listOutreachTenants()) {
      try {
        const r = await app.get(LeadsService).runOutreach(tenantId);
        logger.log(`${tenantId}: outreach ${JSON.stringify(r)}`);
      } catch (error) {
        logger.error(`${tenantId}: outreach failed: ${String(error)}`);
      }
    }
  } finally {
    await app.close();
  }
}

/** The night's work (see the top of this file). */
async function nightly(
  app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>,
  logger: Logger,
) {
  const { TenantDb } = await import('../db/tenant-db.service');
  const { PeopleSyncService } = await import('../sync/people-sync.service');
  const { MovesService, zurichToday } = await import('../moves/moves.service');
  const { PrivacyService } = await import('../privacy/privacy.service');
  const { BillingService } = await import('../billing/billing.service');
  {
    const tenants = await app.get(TenantDb).listSyncTenants();
    let failed = 0;
    for (const t of tenants) {
      try {
        const result = await app.get(PeopleSyncService).syncTenant(t.id);
        if (!result.ok) failed++;
        logger.log(`${t.id}: ${JSON.stringify(result)}`);
      } catch (error) {
        failed++;
        logger.error(`${t.id}: people sync failed: ${String(error)}`);
      }
    }
    logger.log(`Synced ${tenants.length - failed}/${tenants.length} workspaces`);

    const today = zurichToday();
    // HR leaving dates that have come (before moves, so a leaver's seat counts as free)
    const { PeopleService } = await import('../people/people.service');
    // One workspace's failure must never stop the others' (every step below catches per workspace).
    for (const tenantId of await app.get(TenantDb).listLeavingTenants(today)) {
      try {
        const n = await app.get(PeopleService).leaveDue(tenantId, today);
        logger.log(`${tenantId}: ${n} people left as planned`);
      } catch (error) {
        logger.error(`${tenantId}: planned leaves failed: ${String(error)}`);
      }
    }

    for (const tenantId of await app.get(TenantDb).listDueMoveTenants(today)) {
      try {
        const results = await app.get(MovesService).applyDue(tenantId, today);
        for (const r of results)
          if (r.ok) logger.log(`${tenantId}: move plan ${r.id} applied`);
          else
            logger.error(
              `${tenantId}: move plan ${r.id} could not be applied (see the Moves page)`,
            );
      } catch (error) {
        logger.error(`${tenantId}: scheduled moves failed: ${String(error)}`);
      }
    }

    // privacy: delete history older than each workspace's retention period
    for (const t of await app.get(TenantDb).listRetentionTenants()) {
      try {
        const result = await app.get(PrivacyService).purge(t.id, t.months);
        logger.log(`${t.id}: privacy clean-up ${JSON.stringify(result)}`);
      } catch (error) {
        logger.error(`${t.id}: privacy clean-up failed: ${String(error)}`);
      }
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

    // demo workspaces live a day
    const { DemoService } = await import('../demo/demo.service');
    try {
      const demos = await app.get(DemoService).purge();
      if (demos) logger.log(`Deleted ${demos} demo workspaces`);
    } catch (error) {
      logger.error(`Demo clean-up failed: ${String(error)}`);
    }

    // plan imports that were never applied or discarded (the page was closed)
    try {
      const { StorageService } = await import('../storage/storage.service');
      const old = await app.get(StorageService).deleteOldImports(7);
      if (old) logger.log(`Deleted ${old} unused plan imports`);
    } catch (error) {
      logger.error(`Clean-up of unused plan imports failed: ${String(error)}`);
    }

    // billing: tell admins their free trial ends soon (7 days, then 1 day before)
    if (billing.configured)
      for (const tenantId of await app.get(TenantDb).listTrialTenants()) {
        try {
          const days = await billing.remindTrial(tenantId);
          if (days) logger.log(`${tenantId}: trial reminder sent (${days} days left)`);
        } catch (error) {
          logger.error(`${tenantId}: could not send the trial reminder: ${String(error)}`);
        }
      }

    // onboarding: tips to new workspaces' admins on day 1, 3 and 7
    const { OnboardingService } = await import('../mail/onboarding.service');
    for (const tenantId of await app.get(TenantDb).listOnboardingTenants()) {
      try {
        const day = await app.get(OnboardingService).send(tenantId);
        if (day) logger.log(`${tenantId}: onboarding e-mail sent (day ${day})`);
      } catch (error) {
        logger.error(`${tenantId}: could not send the onboarding e-mail: ${String(error)}`);
      }
    }
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
