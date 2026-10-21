import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateFloorInput, UpdateFloorInput } from '@seatline/shared';
import type { RequestContext } from '../auth/request-context';
import { audit } from '../common/audit';
import { orNotFound } from '../common/errors';
import { TenantDb } from '../db/tenant-db.service';
import { present, withCurrent } from '../seats/seats.service';
import { StorageService } from '../storage/storage.service';
import { inspectPlanImage } from './plan-image';

@Injectable()
export class FloorsService {
  constructor(
    private readonly db: TenantDb,
    private readonly storage: StorageService,
  ) {}

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

  async remove(ctx: RequestContext, id: string) {
    const planKey = await this.db.run(ctx.tenantId, async (tx) => {
      const before = orNotFound(
        await tx.floor.findFirst({ where: { id, tenantId: ctx.tenantId } }),
        'Floor',
      );
      await tx.floor.delete({ where: { id } });
      await audit(tx, ctx, { action: 'floor.delete', entityType: 'floor', entityId: id, before });
      return before.planFileKey;
    });
    if (planKey) await this.storage.delete(planKey);
  }

  /**
   * Sets the floor's background plan. The image's pixel size becomes the floor's
   * coordinate space (planWidth × planHeight). Stored first, then linked in one
   * transaction; whichever file ends up unused is removed afterwards.
   */
  async uploadPlan(ctx: RequestContext, id: string, data: Buffer) {
    const image = inspectPlanImage(data);
    const key = `${ctx.tenantId}/floors/${id}/${randomUUID()}.${image.ext}`;
    await this.get(ctx, id); // 404 before storing anything
    await this.storage.put(key, data, image.contentType);
    try {
      const { floor, oldKey } = await this.db.run(ctx.tenantId, async (tx) => {
        const before = orNotFound(
          await tx.floor.findFirst({ where: { id, tenantId: ctx.tenantId } }),
          'Floor',
        );
        const floor = await tx.floor.update({
          where: { id },
          data: { planFileKey: key, planWidth: image.width, planHeight: image.height },
        });
        await audit(tx, ctx, {
          action: 'floor.plan.upload',
          entityType: 'floor',
          entityId: id,
          before: { planFileKey: before.planFileKey },
          after: {
            planFileKey: key,
            planWidth: image.width,
            planHeight: image.height,
            bytes: data.length,
          },
        });
        return { floor, oldKey: before.planFileKey };
      });
      if (oldKey) await this.storage.delete(oldKey);
      return floor;
    } catch (error) {
      await this.storage.delete(key);
      throw error;
    }
  }

  async getPlan(ctx: RequestContext, id: string) {
    const floor = await this.get(ctx, id);
    // the key prefix is a second check that a file can only be served to its own tenant
    if (!floor.planFileKey?.startsWith(`${ctx.tenantId}/`)) throw new NotFoundException('No plan');
    return { key: floor.planFileKey, file: await this.storage.get(floor.planFileKey) };
  }

  async removePlan(ctx: RequestContext, id: string) {
    const oldKey = await this.db.run(ctx.tenantId, async (tx) => {
      const before = orNotFound(
        await tx.floor.findFirst({ where: { id, tenantId: ctx.tenantId } }),
        'Floor',
      );
      await tx.floor.update({ where: { id }, data: { planFileKey: null } });
      await audit(tx, ctx, {
        action: 'floor.plan.remove',
        entityType: 'floor',
        entityId: id,
        before: { planFileKey: before.planFileKey },
      });
      return before.planFileKey;
    });
    if (oldKey) await this.storage.delete(oldKey);
  }
}
