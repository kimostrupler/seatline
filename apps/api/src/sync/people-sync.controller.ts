import { ConflictException, Controller, HttpCode, Post } from '@nestjs/common';
import { AdminOnly, Ctx } from '../auth/decorators';
import type { RequestContext } from '../auth/request-context';
import { TenantDb } from '../db/tenant-db.service';
import { JobQueue } from '../jobs/job-queue.service';

@Controller('people/sync')
export class PeopleSyncController {
  constructor(
    private readonly db: TenantDb,
    private readonly jobs: JobQueue,
  ) {}

  /** "Sync now": refresh people from Microsoft 365. Progress shows on GET /tenant. */
  @AdminOnly()
  @Post()
  @HttpCode(202)
  async syncNow(@Ctx() ctx: RequestContext) {
    const tenant = await this.db.run(ctx.tenantId, (tx) =>
      tx.tenant.findUnique({ where: { id: ctx.tenantId } }),
    );
    if (!tenant?.entraTenantId)
      throw new ConflictException('This workspace is not connected to Microsoft 365');
    await this.jobs.enqueuePeopleSync(ctx.tenantId);
    return { queued: true };
  }
}
