import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Floor, Prisma } from '@prisma/client';
import { relabel, type CreateFloorInput, type UpdateFloorInput } from '@seatline/shared';
import type { RequestContext } from '../auth/request-context';
import { audit } from '../common/audit';
import { orNotFound } from '../common/errors';
import { BIG_BATCH, TenantDb } from '../db/tenant-db.service';
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
      const [rooms, seats, markers] = await Promise.all([
        tx.room.findMany({
          where: { tenantId: ctx.tenantId, floorId: id },
          orderBy: { name: 'asc' },
        }),
        tx.seat.findMany({
          where: { tenantId: ctx.tenantId, floorId: id },
          include: withCurrent,
          orderBy: { label: 'asc' },
        }),
        tx.floorMarker.findMany({
          where: { tenantId: ctx.tenantId, floorId: id },
          select: { id: true, kind: true, x: true, y: true, label: true },
          orderBy: { createdAt: 'asc' },
        }),
      ]);
      return { floor, rooms, seats: seats.map(present), markers };
    });
  }

  /**
   * A new floor — empty, or a copy of another floor's layout: its rooms, seats (labels follow
   * the new level, e.g. 1.04 → 2.04), plan image and scale. People are never copied.
   */
  async create(ctx: RequestContext, input: CreateFloorInput) {
    const { copyFromFloorId, ...data } = input;
    const id = randomUUID();
    const source = copyFromFloorId ? await this.get(ctx, copyFromFloorId) : null;
    // the plan file is copied first; if the floor can't be created it's removed again
    let planFileKey: string | null = null;
    if (source?.planFileKey) {
      planFileKey = `${ctx.tenantId}/floors/${id}/${randomUUID()}${extname(source.planFileKey)}`;
      await this.storage.copy(source.planFileKey, planFileKey);
    }
    try {
      return await this.db.run(
        ctx.tenantId,
        async (tx) => {
          orNotFound(
            await tx.building.findFirst({ where: { id: data.buildingId, tenantId: ctx.tenantId } }),
            'Building',
          );
          const floor = await tx.floor.create({
            data: {
              ...(source && {
                planWidth: source.planWidth,
                planHeight: source.planHeight,
                scale: source.scale,
                deskWidth: source.deskWidth,
                deskDepth: source.deskDepth,
                seatNumbering: source.seatNumbering,
              }),
              ...data,
              planFileKey,
              id,
              tenantId: ctx.tenantId,
            },
          });
          await audit(tx, ctx, {
            action: 'floor.create',
            entityType: 'floor',
            entityId: floor.id,
            after: source ? { ...floor, copiedFromFloorId: source.id } : floor,
          });
          if (source) await this.copyLayout(tx, ctx, source, floor);
          return floor;
        },
        BIG_BATCH,
      );
    } catch (error) {
      if (source?.planFileKey && planFileKey) await this.storage.delete(planFileKey);
      throw error;
    }
  }

  private async copyLayout(
    tx: Prisma.TransactionClient,
    ctx: RequestContext,
    source: Floor,
    floor: Floor,
  ) {
    const { tenantId } = ctx;
    const [rooms, seats, markers] = await Promise.all([
      tx.room.findMany({ where: { tenantId, floorId: source.id } }),
      tx.seat.findMany({ where: { tenantId, floorId: source.id }, orderBy: { label: 'asc' } }),
      tx.floorMarker.findMany({ where: { tenantId, floorId: source.id } }),
    ]);
    if (markers.length)
      await tx.floorMarker.createMany({
        data: markers.map((m) => ({
          tenantId,
          floorId: floor.id,
          kind: m.kind,
          x: m.x,
          y: m.y,
          label: m.label,
        })),
      });
    const roomIds = new Map<string, string>();
    for (const r of rooms) {
      const room = await tx.room.create({
        data: {
          tenantId,
          floorId: floor.id,
          name: r.name,
          type: r.type,
          polygon: r.polygon as Prisma.InputJsonValue,
          capacity: r.capacity,
          equipment: r.equipment,
          team: r.team,
        },
      });
      roomIds.set(r.id, room.id);
      await audit(tx, ctx, {
        action: 'layout.room.create',
        entityType: 'room',
        entityId: room.id,
        after: room,
      });
    }
    const used = new Set<string>();
    for (const s of seats) {
      let label = relabel(s.label, source.level, floor.level);
      // labels are unique per floor: "2.04" may already come from the source as-is
      for (let n = 2; used.has(label); n++)
        label = `${relabel(s.label, source.level, floor.level)} (${n})`;
      used.add(label);
      const seat = await tx.seat.create({
        data: {
          tenantId,
          floorId: floor.id,
          roomId: s.roomId ? (roomIds.get(s.roomId) ?? null) : null,
          label,
          x: s.x,
          y: s.y,
          rotation: s.rotation,
          features: s.features,
          type: s.type,
          status: s.status,
        },
      });
      await audit(tx, ctx, {
        action: 'layout.seat.create',
        entityType: 'seat',
        entityId: seat.id,
        after: seat,
      });
    }
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
  /** A new background image; from a plan import also its scale (null = keep the floor's). */
  async uploadPlan(
    ctx: RequestContext,
    id: string,
    data: Buffer,
    imported?: { source: string; scale: number | null },
  ) {
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
          data: {
            planFileKey: key,
            planWidth: image.width,
            planHeight: image.height,
            ...(imported?.scale ? { scale: imported.scale } : {}),
          },
        });
        await audit(tx, ctx, {
          action: imported ? 'floor.plan.import' : 'floor.plan.upload',
          entityType: 'floor',
          entityId: id,
          before: { planFileKey: before.planFileKey, scale: before.scale },
          after: {
            planFileKey: key,
            planWidth: image.width,
            planHeight: image.height,
            bytes: data.length,
            ...(imported ? { source: imported.source, scale: floor.scale } : {}),
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
    const file = await this.storage.get(floor.planFileKey);
    if (!file) throw new NotFoundException('No plan');
    return { key: floor.planFileKey, file };
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
