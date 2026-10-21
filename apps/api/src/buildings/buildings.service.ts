import { Injectable } from '@nestjs/common';
import type { CreateBuildingInput, UpdateBuildingInput } from '@seatline/shared';
import type { RequestContext } from '../auth/request-context';
import { audit } from '../common/audit';
import { orNotFound } from '../common/errors';
import { TenantDb } from '../db/tenant-db.service';

@Injectable()
export class BuildingsService {
  constructor(private readonly db: TenantDb) {}

  list(ctx: RequestContext) {
    return this.db.run(ctx.tenantId, (tx) =>
      tx.building.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { name: 'asc' } }),
    );
  }

  get(ctx: RequestContext, id: string) {
    return this.db.run(ctx.tenantId, async (tx) =>
      orNotFound(
        await tx.building.findFirst({
          where: { id, tenantId: ctx.tenantId },
          include: { floors: { orderBy: { level: 'asc' } } },
        }),
        'Building',
      ),
    );
  }

  create(ctx: RequestContext, input: CreateBuildingInput) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const building = await tx.building.create({ data: { ...input, tenantId: ctx.tenantId } });
      await audit(tx, ctx, {
        action: 'building.create',
        entityType: 'building',
        entityId: building.id,
        after: building,
      });
      return building;
    });
  }

  update(ctx: RequestContext, id: string, input: UpdateBuildingInput) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const before = orNotFound(
        await tx.building.findFirst({ where: { id, tenantId: ctx.tenantId } }),
        'Building',
      );
      const after = await tx.building.update({ where: { id }, data: input });
      await audit(tx, ctx, {
        action: 'building.update',
        entityType: 'building',
        entityId: id,
        before,
        after,
      });
      return after;
    });
  }

  remove(ctx: RequestContext, id: string) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const before = orNotFound(
        await tx.building.findFirst({ where: { id, tenantId: ctx.tenantId } }),
        'Building',
      );
      await tx.building.delete({ where: { id } });
      await audit(tx, ctx, {
        action: 'building.delete',
        entityType: 'building',
        entityId: id,
        before,
      });
    });
  }
}
