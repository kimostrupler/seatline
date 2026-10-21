import { Controller, Get } from '@nestjs/common';
import { Ctx } from './auth/decorators';
import type { RequestContext } from './auth/request-context';
import { orNotFound } from './common/errors';
import { TenantDb } from './db/tenant-db.service';

/** Who is signed in: drives what the web app shows (e.g. viewers get no edit buttons). */
@Controller('me')
export class MeController {
  constructor(private readonly db: TenantDb) {}

  @Get()
  me(@Ctx() ctx: RequestContext) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const [person, tenant] = await Promise.all([
        tx.person.findFirst({
          where: { id: ctx.actorId, tenantId: ctx.tenantId },
          select: { id: true, displayName: true, email: true },
        }),
        tx.tenant.findFirst({ where: { id: ctx.tenantId }, select: { id: true, name: true } }),
      ]);
      return {
        person: orNotFound(person, 'Person'),
        tenant: orNotFound(tenant, 'Tenant'),
        role: ctx.role,
      };
    });
  }
}
