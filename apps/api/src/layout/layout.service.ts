import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { roomForPoint, type LayoutChanges, type XY } from '@seatline/shared';
import type { RequestContext } from '../auth/request-context';
import { audit } from '../common/audit';
import { orNotFound } from '../common/errors';
import { BIG_BATCH, TenantDb, type Tx } from '../db/tenant-db.service';
import { guardBookings } from '../bookings/booking-guards';
import { OPEN_PLANS } from '../moves/moves.service';

/**
 * Applies one layout-editor action atomically: rooms and seats created, changed or
 * removed together, then every seat's room is recomputed from its position.
 */
@Injectable()
export class LayoutService {
  constructor(private readonly db: TenantDb) {}

  apply(ctx: RequestContext, floorId: string, changes: LayoutChanges) {
    const { tenantId } = ctx;
    return this.db.run(
      tenantId,
      async (tx) => {
        orNotFound(await tx.floor.findFirst({ where: { id: floorId, tenantId } }), 'Floor');
        const [rooms, seats, markers] = await Promise.all([
          tx.room.findMany({ where: { tenantId, floorId } }),
          tx.seat.findMany({
            where: { tenantId, floorId },
            include: { assignments: { where: { endAt: null }, select: { id: true } } },
          }),
          tx.floorMarker.findMany({ where: { tenantId, floorId } }),
        ]);
        const markerById = new Map(markers.map((m) => [m.id, m]));
        const roomById = new Map(rooms.map((r) => [r.id, r]));
        const seatById = new Map(seats.map((s) => [s.id, s]));
        const onFloor = (map: Map<string, unknown>, ids: string[], what: string) => {
          const missing = ids.filter((i) => !map.has(i));
          if (missing.length)
            throw new NotFoundException(`${what} not on this floor: ${missing.join(', ')}`);
        };
        onFloor(
          roomById,
          [...changes.rooms.update.map((r) => r.id), ...changes.rooms.delete],
          'Room',
        );
        onFloor(
          seatById,
          [...changes.seats.update.map((s) => s.id), ...changes.seats.delete],
          'Seat',
        );
        onFloor(
          markerById,
          [...changes.markers.update.map((m) => m.id), ...changes.markers.delete],
          'Marker',
        );

        // History must survive: seats that ever had someone can only be blocked, not deleted.
        if (changes.seats.delete.length) {
          const used = await tx.seatAssignment.groupBy({
            by: ['seatId'],
            where: { tenantId, seatId: { in: changes.seats.delete } },
          });
          if (used.length) {
            const labels = used.map((u) => seatById.get(u.seatId)?.label).join(', ');
            throw new ConflictException(
              `Seats with history can't be deleted — block them instead: ${labels}`,
            );
          }
        }
        // nor a desk someone is planned to move to: the plan would silently lose that move
        if (changes.seats.delete.length) {
          const planned = await tx.movePlanItem.findMany({
            where: {
              tenantId,
              toSeatId: { in: changes.seats.delete },
              plan: { status: { in: OPEN_PLANS } },
            },
            select: { toSeatId: true },
          });
          if (planned.length) {
            const labels = [...new Set(planned.map((p) => seatById.get(p.toSeatId!)?.label))];
            throw new ConflictException(
              `Seats in an open move plan can't be deleted — change the plan first: ${labels.join(', ')}`,
            );
          }
        }
        for (const u of changes.seats.update) {
          if (u.status === 'blocked' && seatById.get(u.id)!.assignments.length) {
            throw new ConflictException(
              `Free seat ${seatById.get(u.id)!.label} before blocking it`,
            );
          }
          // a shared desk has no permanent person
          if (u.shared && seatById.get(u.id)!.assignments.length) {
            throw new ConflictException(`Free seat ${seatById.get(u.id)!.label} before sharing it`);
          }
        }
        // bookings are history too, and coming ones must still find their desk
        await guardBookings(
          tx,
          tenantId,
          changes.seats.delete,
          changes.seats.update
            .filter((u) => u.shared === false || u.status === 'blocked')
            .map((u) => u.id),
          (id) => seatById.get(id)?.label ?? id,
        );

        const log = (
          action: string,
          entityType: string,
          entityId: string,
          before?: unknown,
          after?: unknown,
        ) => audit(tx, ctx, { action: `layout.${action}`, entityType, entityId, before, after });

        for (const r of changes.rooms.create) {
          const room = await tx.room.create({ data: { ...r, tenantId, floorId } });
          await log('room.create', 'room', room.id, undefined, room);
        }
        for (const { id, ...data } of changes.rooms.update) {
          const room = await tx.room.update({ where: { id }, data });
          await log('room.update', 'room', id, roomById.get(id), room);
        }
        for (const id of changes.seats.delete) {
          await tx.seat.delete({ where: { id } });
          const { assignments: _, ...before } = seatById.get(id)!;
          await log('seat.delete', 'seat', id, before);
        }
        // labels are unique per floor: changed labels step aside first, so a batch may swap them
        const relabelled = changes.seats.update.filter(
          (u) => u.label !== undefined && u.label !== seatById.get(u.id)!.label,
        );
        for (const u of relabelled) {
          await tx.seat.update({ where: { id: u.id }, data: { label: `~${u.id}` } });
        }
        for (const s of changes.seats.create) {
          const seat = await tx.seat.create({ data: { ...s, tenantId, floorId } });
          await log('seat.create', 'seat', seat.id, undefined, seat);
        }
        for (const { id, ...data } of changes.seats.update) {
          const seat = await tx.seat.update({ where: { id }, data });
          const { assignments: _, ...before } = seatById.get(id)!;
          await log('seat.update', 'seat', id, before, seat);
        }
        if (changes.rooms.delete.length) {
          await tx.seat.updateMany({
            where: { tenantId, roomId: { in: changes.rooms.delete } },
            data: { roomId: null },
          });
          for (const id of changes.rooms.delete) {
            await tx.room.delete({ where: { id } });
            await log('room.delete', 'room', id, roomById.get(id));
          }
        }

        for (const m of changes.markers.create) {
          const marker = await tx.floorMarker.create({ data: { ...m, tenantId, floorId } });
          await log('marker.create', 'floor', floorId, undefined, marker);
        }
        for (const { id, ...data } of changes.markers.update) {
          const marker = await tx.floorMarker.update({ where: { id }, data });
          await log('marker.update', 'floor', floorId, markerById.get(id), marker);
        }
        for (const id of changes.markers.delete) {
          await tx.floorMarker.delete({ where: { id } });
          await log('marker.delete', 'floor', floorId, markerById.get(id));
        }

        await assignRooms(tx, ctx, floorId);
      },
      BIG_BATCH,
    );
  }
}

/**
 * Seats belong to the room they stand in (smallest one, if rooms overlap). Called after every
 * change to a floor's rooms or seats (layout batch, the single room and seat routes).
 */
export async function assignRooms(tx: Tx, ctx: RequestContext, floorId: string) {
  const [rooms, seats] = await Promise.all([
    tx.room.findMany({
      where: { tenantId: ctx.tenantId, floorId },
      select: { id: true, polygon: true },
    }),
    tx.seat.findMany({
      where: { tenantId: ctx.tenantId, floorId },
      select: { id: true, x: true, y: true, roomId: true },
    }),
  ]);
  const shapes = rooms.map((r) => ({ id: r.id, polygon: r.polygon as unknown as XY[] }));
  for (const seat of seats) {
    const roomId = roomForPoint(seat, shapes)?.id ?? null;
    if (roomId === seat.roomId) continue;
    await tx.seat.update({
      where: { id: seat.id },
      data: { roomId } satisfies Prisma.SeatUncheckedUpdateInput,
    });
    await audit(tx, ctx, {
      action: 'layout.seat.room',
      entityType: 'seat',
      entityId: seat.id,
      before: { roomId: seat.roomId },
      after: { roomId },
    });
  }
}
