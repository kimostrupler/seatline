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
          select: { id: true, name: true, trialEndsAt: true, isDemo: true, preparedByOwner: true },
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

  /**
   * The other workspaces the signed-in address belongs to (e-mail sign-in only), for the
   * account menu's switcher. Microsoft workspaces keep their own sign-in, so none there.
   */
  @Get('workspaces')
  async workspaces(@Ctx() ctx: RequestContext) {
    const me = await this.db.run(ctx.tenantId, (tx) =>
      tx.person.findFirst({
        where: { id: ctx.actorId, tenantId: ctx.tenantId },
        select: { email: true, tenant: { select: { entraTenantId: true } } },
      }),
    );
    if (!me || me.tenant.entraTenantId) return [];
    return (await this.db.emailWorkspaces(me.email))
      .filter((w) => !w.microsoft && w.active)
      .map((w) => ({ id: w.tenant_id, name: w.name, current: w.tenant_id === ctx.tenantId }));
  }
}
