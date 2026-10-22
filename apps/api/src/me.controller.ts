import { Controller, Get } from '@nestjs/common';
import { Ctx } from './auth/decorators';
import type { RequestContext } from './auth/request-context';
import { orNotFound } from './common/errors';
import { TenantDb } from './db/tenant-db.service';
import { BillingService } from './billing/billing.service';

/** Who is signed in: drives what the web app shows (e.g. viewers get no edit buttons). */
@Controller('me')
export class MeController {
  constructor(
    private readonly db: TenantDb,
    private readonly billing: BillingService,
  ) {}

  @Get()
  me(@Ctx() ctx: RequestContext) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const [person, tenant] = await Promise.all([
        tx.person.findFirst({
          where: { id: ctx.actorId, tenantId: ctx.tenantId },
          select: { id: true, displayName: true, email: true },
        }),
        tx.tenant.findFirst({
          where: { id: ctx.tenantId },
          select: { id: true, name: true, trialEndsAt: true, isDemo: true },
        }),
      ]);
      const { trialEndsAt, ...workspace } = orNotFound(tenant, 'Tenant');
      return {
        person: orNotFound(person, 'Person'),
        tenant: workspace,
        role: ctx.role,
        // for the trial / read-only banner
        billing: { state: await this.billing.state(ctx.tenantId), trialEndsAt },
      };
    });
  }
}
