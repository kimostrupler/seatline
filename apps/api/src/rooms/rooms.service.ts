import { Injectable } from '@nestjs/common';
import type { CreateRoomInput, UpdateRoomInput } from '@seatline/shared';
import type { RequestContext } from '../auth/request-context';
import { audit } from '../common/audit';
import { orNotFound } from '../common/errors';
import { TenantDb } from '../db/tenant-db.service';

@Injectable()
export class RoomsService {
  constructor(private readonly db: TenantDb) {}

  list(ctx: RequestContext, floorId: string) {
    return this.db.run(ctx.tenantId, (tx) =>
      tx.room.findMany({ where: { tenantId: ctx.tenantId, floorId }, orderBy: { name: 'asc' } }),
    );
  }

  get(ctx: RequestContext, id: string) {
    return this.db.run(ctx.tenantId, async (tx) =>
      orNotFound(await tx.room.findFirst({ where: { id, tenantId: ctx.tenantId } }), 'Room'),
    );
  }

  create(ctx: RequestContext, input: CreateRoomInput) {
    return this.db.run(ctx.tenantId, async (tx) => {
      orNotFound(
        await tx.floor.findFirst({ where: { id: input.floorId, tenantId: ctx.tenantId } }),
        'Floor',
      );
      const room = await tx.room.create({ data: { ...input, tenantId: ctx.tenantId } });
      await audit(tx, ctx, {
        action: 'room.create',
        entityType: 'room',
        entityId: room.id,
        after: room,
      });
      return room;
    });
  }

  update(ctx: RequestContext, id: string, input: UpdateRoomInput) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const before = orNotFound(
        await tx.room.findFirst({ where: { id, tenantId: ctx.tenantId } }),
        'Room',
      );
      const after = await tx.room.update({ where: { id }, data: input });
      await audit(tx, ctx, {
        action: 'room.update',
        entityType: 'room',
        entityId: id,
        before,
        after,
      });
      return after;
    });
  }

  /** Seats in the room stay on the floor; they just no longer belong to a room. */
  remove(ctx: RequestContext, id: string) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const before = orNotFound(
        await tx.room.findFirst({ where: { id, tenantId: ctx.tenantId } }),
        'Room',
      );
      const seats = await tx.seat.findMany({
        where: { tenantId: ctx.tenantId, roomId: id },
        select: { id: true },
      });
      await tx.seat.updateMany({
        where: { tenantId: ctx.tenantId, roomId: id },
        data: { roomId: null },
      });
      await tx.room.delete({ where: { id } });
      await audit(tx, ctx, {
        action: 'room.delete',
        entityType: 'room',
        entityId: id,
        before: { ...before, unlinkedSeatIds: seats.map((s) => s.id) },
      });
    });
  }
}
