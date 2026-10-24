import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { CreateSeatInput, UpdateSeatInput } from '@seatline/shared';
import type { RequestContext } from '../auth/request-context';
import { audit } from '../common/audit';
import { orNotFound } from '../common/errors';
import { TenantDb, type Tx } from '../db/tenant-db.service';
import { OPEN_PLANS } from '../moves/moves.service';
import { seatOccupancy } from './occupancy';

/** A seat plus its open assignment (if any) — what the floor map needs. */
export const withCurrent = {
  assignments: {
    where: { endAt: null },
    take: 1,
    include: { person: { select: { id: true, displayName: true, department: true } } },
  },
} satisfies Prisma.SeatInclude;

type SeatWithCurrent = Prisma.SeatGetPayload<{ include: typeof withCurrent }>;

export function present(seat: SeatWithCurrent) {
  const { assignments, ...rest } = seat;
  const current = assignments[0] ?? null;
  return { ...rest, currentAssignment: current, occupancy: seatOccupancy(seat, current) };
}

@Injectable()
export class SeatsService {
  constructor(private readonly db: TenantDb) {}

  list(ctx: RequestContext, floorId: string) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const seats = await tx.seat.findMany({
        where: { tenantId: ctx.tenantId, floorId },
        include: withCurrent,
        orderBy: { label: 'asc' },
      });
      return seats.map(present);
    });
  }

  get(ctx: RequestContext, id: string) {
    return this.db.run(ctx.tenantId, async (tx) =>
      present(
        orNotFound(
          await tx.seat.findFirst({ where: { id, tenantId: ctx.tenantId }, include: withCurrent }),
          'Seat',
        ),
      ),
    );
  }

  create(ctx: RequestContext, input: CreateSeatInput) {
    return this.db.run(ctx.tenantId, async (tx) => {
      orNotFound(
        await tx.floor.findFirst({ where: { id: input.floorId, tenantId: ctx.tenantId } }),
        'Floor',
      );
      if (input.roomId) await this.assertRoomOnFloor(tx, ctx, input.roomId, input.floorId);
      const seat = await tx.seat.create({ data: { ...input, tenantId: ctx.tenantId } });
      await audit(tx, ctx, {
        action: 'seat.create',
        entityType: 'seat',
        entityId: seat.id,
        after: seat,
      });
      return seat;
    });
  }

  update(ctx: RequestContext, id: string, input: UpdateSeatInput) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const before = orNotFound(
        await tx.seat.findFirst({ where: { id, tenantId: ctx.tenantId }, include: withCurrent }),
        'Seat',
      );
      if (input.roomId) await this.assertRoomOnFloor(tx, ctx, input.roomId, before.floorId);
      if (input.status === 'blocked' && before.assignments.length > 0) {
        throw new ConflictException('Free the seat before blocking it');
      }
      const after = await tx.seat.update({ where: { id }, data: input });
      const { assignments: _, ...beforeSeat } = before;
      await audit(tx, ctx, {
        action: 'seat.update',
        entityType: 'seat',
        entityId: id,
        before: beforeSeat,
        after,
      });
      return after;
    });
  }

  /** Seats with history can't be deleted (the history must stay) — block them instead. */
  remove(ctx: RequestContext, id: string) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const before = orNotFound(
        await tx.seat.findFirst({ where: { id, tenantId: ctx.tenantId } }),
        'Seat',
      );
      const used = await tx.seatAssignment.count({ where: { tenantId: ctx.tenantId, seatId: id } });
      if (used > 0) {
        throw new ConflictException(
          'This seat has assignment history — block it instead of deleting',
        );
      }
      const planned = await tx.movePlanItem.count({
        where: { tenantId: ctx.tenantId, toSeatId: id, plan: { status: { in: OPEN_PLANS } } },
      });
      if (planned > 0)
        throw new ConflictException(
          'This seat is in an open move plan — change the plan before deleting it',
        );
      await tx.seat.delete({ where: { id } });
      await audit(tx, ctx, { action: 'seat.delete', entityType: 'seat', entityId: id, before });
    });
  }

  private async assertRoomOnFloor(tx: Tx, ctx: RequestContext, roomId: string, floorId: string) {
    const room = await tx.room.findFirst({ where: { id: roomId, tenantId: ctx.tenantId } });
    if (!room || room.floorId !== floorId) {
      throw new BadRequestException('The room must be on the same floor as the seat');
    }
  }
}
