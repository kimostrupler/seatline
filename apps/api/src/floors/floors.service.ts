import { Injectable } from '@nestjs/common';
import type { CreateFloorInput, UpdateFloorInput } from '@seatline/shared';
import type { RequestContext } from '../auth/request-context';
import { audit } from '../common/audit';
import { orNotFound } from '../common/errors';
import { TenantDb } from '../db/tenant-db.service';
import { present, withCurrent } from '../seats/seats.service';

@Injectable()
export class FloorsService {
  constructor(private readonly db: TenantDb) {}

  list(ctx: RequestContext, buildingId?: string) {
    return this.db.run(ctx.tenantId, (tx) =>
      tx.floor.findMany({
        where: { tenantId: ctx.tenantId, ...(buildingId ? { buildingId } : {}) },
        orderBy: [{ buildingId: 'asc' }, { level: 'asc' }],
      }),
    );
  }

  get(ctx: RequestContext, id: string) {
    return this.db.run(ctx.tenantId, async (tx) =>
      orNotFound(await tx.floor.findFirst({ where: { id, tenantId: ctx.tenantId } }), 'Floor'),
    );
  }

  /** Everything the floor map needs, in one round trip and one consistent snapshot. */
  map(ctx: RequestContext, id: string) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const floor = orNotFound(
        await tx.floor.findFirst({
          where: { id, tenantId: ctx.tenantId },
          include: { building: { select: { id: true, name: true } } },
        }),
        'Floor',
      );
      const [rooms, seats] = await Promise.all([
        tx.room.findMany({
          where: { tenantId: ctx.tenantId, floorId: id },
          orderBy: { name: 'asc' },
        }),
        tx.seat.findMany({
          where: { tenantId: ctx.tenantId, floorId: id },
          include: withCurrent,
          orderBy: { label: 'asc' },
        }),
      ]);
      return { floor, rooms, seats: seats.map(present) };
    });
  }

  create(ctx: RequestContext, input: CreateFloorInput) {
    return this.db.run(ctx.tenantId, async (tx) => {
      orNotFound(
        await tx.building.findFirst({ where: { id: input.buildingId, tenantId: ctx.tenantId } }),
        'Building',
      );
      const floor = await tx.floor.create({ data: { ...input, tenantId: ctx.tenantId } });
      await audit(tx, ctx, {
        action: 'floor.create',
        entityType: 'floor',
        entityId: floor.id,
        after: floor,
      });
      return floor;
    });
  }

  update(ctx: RequestContext, id: string, input: UpdateFloorInput) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const before = orNotFound(
        await tx.floor.findFirst({ where: { id, tenantId: ctx.tenantId } }),
        'Floor',
      );
      const after = await tx.floor.update({ where: { id }, data: input });
      await audit(tx, ctx, {
        action: 'floor.update',
        entityType: 'floor',
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
        await tx.floor.findFirst({ where: { id, tenantId: ctx.tenantId } }),
        'Floor',
      );
      await tx.floor.delete({ where: { id } });
      await audit(tx, ctx, { action: 'floor.delete', entityType: 'floor', entityId: id, before });
    });
  }
}
