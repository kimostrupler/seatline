import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { DEFAULT_DASHBOARD, type Widget } from '@seatline/shared';
import type { RequestContext } from '../auth/request-context';
import { audit } from '../common/audit';
import { TenantDb } from '../db/tenant-db.service';

export type DashboardSource = 'personal' | 'company' | 'builtin';

/**
 * Home dashboards. Everyone has their own layout; until they change it they see the
 * company default (set by an admin), or the built-in one.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly db: TenantDb) {}

  get(ctx: RequestContext) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const [own, company] = await Promise.all([
        tx.dashboardLayout.findFirst({ where: { tenantId: ctx.tenantId, personId: ctx.actorId } }),
        tx.dashboardLayout.findFirst({ where: { tenantId: ctx.tenantId, personId: null } }),
      ]);
      const source: DashboardSource = own ? 'personal' : company ? 'company' : 'builtin';
      return {
        widgets:
          ((own ?? company)?.widgets as unknown as Widget[] | undefined) ?? DEFAULT_DASHBOARD,
        source,
        hasCompanyDefault: !!company,
      };
    });
  }

  /** Save the caller's own layout. */
  async save(ctx: RequestContext, widgets: Widget[]) {
    await this.write(ctx, ctx.actorId, widgets);
    return this.get(ctx);
  }

  /** Admins: the layout new people (and anyone who resets) get. */
  async saveDefault(ctx: RequestContext, widgets: Widget[]) {
    await this.write(ctx, null, widgets);
    return this.get(ctx);
  }

  /** Back to the company default (or built-in). */
  async reset(ctx: RequestContext) {
    await this.db.run(ctx.tenantId, async (tx) => {
      const own = await tx.dashboardLayout.findFirst({
        where: { tenantId: ctx.tenantId, personId: ctx.actorId },
      });
      if (!own) return;
      await tx.dashboardLayout.delete({ where: { id: own.id } });
      await audit(tx, ctx, {
        action: 'dashboard.reset',
        entityType: 'dashboard',
        entityId: own.id,
        before: { widgets: own.widgets },
      });
    });
    return this.get(ctx);
  }

  private write(ctx: RequestContext, personId: string | null, widgets: Widget[]) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const existing = await tx.dashboardLayout.findFirst({
        where: { tenantId: ctx.tenantId, personId },
      });
      const data = { widgets: widgets as unknown as Prisma.InputJsonValue };
      const saved = existing
        ? await tx.dashboardLayout.update({ where: { id: existing.id }, data })
        : await tx.dashboardLayout.create({ data: { ...data, tenantId: ctx.tenantId, personId } });
      await audit(tx, ctx, {
        action: personId ? 'dashboard.update' : 'dashboard.default',
        entityType: 'dashboard',
        entityId: saved.id,
        before: existing ? { widgets: existing.widgets } : undefined,
        after: { widgets: saved.widgets, personId },
      });
    });
  }
}
