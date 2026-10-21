import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PgBoss } from 'pg-boss';
import { loadConfig } from '../config';
import { PeopleSyncService } from '../sync/people-sync.service';

const PEOPLE_SYNC = 'people-sync';

/**
 * Background jobs in Postgres (pg-boss, schema "pgboss") — no Redis needed (Plan A).
 * Keep all queue code in this file so a move to Redis/BullMQ later only touches it.
 */
@Injectable()
export class JobQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobQueue.name);
  private readonly config = loadConfig();
  private boss: PgBoss | null = null;

  constructor(private readonly sync: PeopleSyncService) {}

  async onModuleInit() {
    if (!this.config.JOBS_ENABLED) return;
    const boss = new PgBoss({
      connectionString: this.config.APP_DATABASE_URL,
      schema: 'pgboss',
      createSchema: false, // created by our migration, owned by the API role
      schedule: false, // the nightly sync runs as its own scheduled job (works with scale-to-zero)
    });
    boss.on('error', (error) => this.logger.error(error));
    await boss.start();
    // one queued/running sync per workspace at a time
    await boss.createQueue(PEOPLE_SYNC, { policy: 'stately' });
    await boss.work<{ tenantId: string }>(
      PEOPLE_SYNC,
      { pollingIntervalSeconds: 1 },
      async (jobs) => {
        for (const job of jobs) await this.sync.syncTenant(job.data.tenantId);
      },
    );
    this.boss = boss;
  }

  async onModuleDestroy() {
    await this.boss?.stop({ graceful: true, timeout: 10_000 });
  }

  /** Queue a people sync for a workspace. Runs within a few seconds in this process. */
  async enqueuePeopleSync(tenantId: string): Promise<void> {
    if (!this.boss) {
      await this.sync.syncTenant(tenantId); // jobs disabled (e.g. one-off scripts): run now
      return;
    }
    await this.boss.send(PEOPLE_SYNC, { tenantId }, { singletonKey: tenantId, retryLimit: 1 });
  }
}
