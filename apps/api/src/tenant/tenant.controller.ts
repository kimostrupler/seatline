import { Body, Controller, Get, Patch } from '@nestjs/common';
import { updateTenantSchema, type UpdateTenantInput } from '@seatline/shared';
import { AdminOnly, Ctx } from '../auth/decorators';
import type { RequestContext } from '../auth/request-context';
import { audit } from '../common/audit';
import { orNotFound } from '../common/errors';
import { ZodPipe } from '../common/zod.pipe';
import { TenantDb } from '../db/tenant-db.service';

const select = {
  id: true,
  name: true,
  defaultAppRole: true,
  entraTenantId: true,
  peopleSyncedAt: true,
  peopleSyncStatus: true,
  historyRetentionMonths: true,
  notifyEmails: true,
  notifyEvents: true,
  notifyLanguage: true,
} as const;

const settings = (t: {
  name: string;
  defaultAppRole: string | null;
  historyRetentionMonths: number | null;
  notifyEmails: string[];
  notifyEvents: string[];
  notifyLanguage: string;
}) => ({
  name: t.name,
  defaultAppRole: t.defaultAppRole,
  historyRetentionMonths: t.historyRetentionMonths,
  notifyEmails: t.notifyEmails,
  notifyEvents: t.notifyEvents,
  notifyLanguage: t.notifyLanguage,
});

/** The caller's workspace and its settings. */
@Controller('tenant')
export class TenantController {
  constructor(private readonly db: TenantDb) {}

  @Get()
  get(@Ctx() ctx: RequestContext) {
    return this.db.run(ctx.tenantId, async (tx) =>
      orNotFound(await tx.tenant.findFirst({ where: { id: ctx.tenantId }, select }), 'Workspace'),
    );
  }

  @AdminOnly()
  @Patch()
  update(
    @Ctx() ctx: RequestContext,
    @Body(new ZodPipe(updateTenantSchema)) body: UpdateTenantInput,
  ) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const before = orNotFound(
        await tx.tenant.findFirst({ where: { id: ctx.tenantId }, select }),
        'Workspace',
      );
      const after = await tx.tenant.update({ where: { id: ctx.tenantId }, data: body, select });
      await audit(tx, ctx, {
        action: 'tenant.update',
        entityType: 'tenant',
        entityId: ctx.tenantId,
        before: settings(before),
        after: settings(after),
      });
      return after;
    });
  }
}
