import { ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AssignSeatInput, EndAssignmentInput, ReserveSeatInput } from '@seatline/shared';
import type { RequestContext } from '../auth/request-context';
import { audit } from '../common/audit';
import { orNotFound } from '../common/errors';
import { TenantDb, type Tx } from '../db/tenant-db.service';
import { JobQueue } from '../jobs/job-queue.service';

const historyInclude = {
  person: { select: { id: true, displayName: true, department: true } },
  assignedBy: { select: { id: true, displayName: true } },
  seat: { select: { id: true, label: true, floorId: true } },
} satisfies Prisma.SeatAssignmentInclude;

/**
 * Seat assignments are history: rows are inserted, and later closed once by setting
 * end_at. Nothing else ever changes (the database enforces this with a trigger).
 * A move = close the old row + insert a new one, in one transaction, at the same instant.
 */
@Injectable()
export class AssignmentsService {
  constructor(
    private readonly db: TenantDb,
    private readonly jobs: JobQueue,
  ) {}

  /**
   * Gives a person a seat. If they sit somewhere else, that's a move: the old
   * assignment is closed. A reservation on the target seat is closed too.
   * The person gets a "your new desk" e-mail a little later — unless the move was undone.
   */
  async assign(ctx: RequestContext, input: AssignSeatInput) {
    const result = await this.db.run(ctx.tenantId, async (tx) => {
      await this.activeSeat(tx, ctx, input.seatId);
      const person = orNotFound(
        await tx.person.findFirst({ where: { id: input.personId, tenantId: ctx.tenantId } }),
        'Person',
      );
      if (!person.active) throw new ConflictException('This person is no longer active');

      const onSeat = await this.openOnSeat(tx, ctx, input.seatId);
      if (onSeat?.personId === person.id)
        throw new ConflictException('Already assigned to this seat');
      if (onSeat?.kind === 'assigned') throw new ConflictException('This seat is already taken');

      const now = new Date();
      const closed = [];
      if (onSeat) closed.push(await this.close(tx, ctx, onSeat.id, now)); // the reservation
      const previous = await tx.seatAssignment.findFirst({
        where: { tenantId: ctx.tenantId, personId: person.id, endAt: null },
      });
      if (previous) closed.push(await this.close(tx, ctx, previous.id, now));

      const assignment = await tx.seatAssignment.create({
        data: {
          tenantId: ctx.tenantId,
          seatId: input.seatId,
          personId: person.id,
          kind: 'assigned',
          startAt: now,
          assignedById: ctx.actorId,
          note: input.note,
        },
      });
      await audit(tx, ctx, {
        action: previous ? 'assignment.move' : 'assignment.create',
        entityType: 'seat_assignment',
        entityId: assignment.id,
        before: closed.length ? closed : undefined,
        after: assignment,
      });
      return { assignment, closed };
    });
    await this.jobs.enqueueDeskMail(ctx.tenantId, [result.assignment.id]);
    return result;
  }

  /** Holds a free seat for someone not in the directory yet (new hire, team…). */
  reserve(ctx: RequestContext, input: ReserveSeatInput) {
    return this.db.run(ctx.tenantId, async (tx) => {
      await this.activeSeat(tx, ctx, input.seatId);
      if (await this.openOnSeat(tx, ctx, input.seatId)) {
        throw new ConflictException('This seat is not free');
      }
      const assignment = await tx.seatAssignment.create({
        data: {
          tenantId: ctx.tenantId,
          seatId: input.seatId,
          kind: 'reserved',
          reservedFor: input.reservedFor,
          assignedById: ctx.actorId,
          note: input.note,
        },
      });
      await audit(tx, ctx, {
        action: 'assignment.reserve',
        entityType: 'seat_assignment',
        entityId: assignment.id,
        after: assignment,
      });
      return assignment;
    });
  }

  /** Frees the seat: closes an open assignment or reservation. */
  end(ctx: RequestContext, id: string, input: EndAssignmentInput) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const open = orNotFound(
        await tx.seatAssignment.findFirst({ where: { id, tenantId: ctx.tenantId } }),
        'Assignment',
      );
      if (open.endAt) throw new ConflictException('This assignment has already ended');
      const closed = await this.close(tx, ctx, id, new Date());
      await audit(tx, ctx, {
        action: 'assignment.end',
        entityType: 'seat_assignment',
        entityId: id,
        before: open,
        after: { ...closed, endNote: input.note },
      });
      return closed;
    });
  }

  seatHistory(ctx: RequestContext, seatId: string) {
    return this.db.run(ctx.tenantId, async (tx) => {
      orNotFound(
        await tx.seat.findFirst({ where: { id: seatId, tenantId: ctx.tenantId } }),
        'Seat',
      );
      return tx.seatAssignment.findMany({
        where: { tenantId: ctx.tenantId, seatId },
        include: historyInclude,
        orderBy: { startAt: 'desc' },
      });
    });
  }

  personHistory(ctx: RequestContext, personId: string) {
    return this.db.run(ctx.tenantId, async (tx) => {
      orNotFound(
        await tx.person.findFirst({ where: { id: personId, tenantId: ctx.tenantId } }),
        'Person',
      );
      return tx.seatAssignment.findMany({
        where: { tenantId: ctx.tenantId, personId },
        include: historyInclude,
        orderBy: { startAt: 'desc' },
      });
    });
  }

  private async activeSeat(tx: Tx, ctx: RequestContext, seatId: string) {
    const seat = orNotFound(
      await tx.seat.findFirst({ where: { id: seatId, tenantId: ctx.tenantId } }),
      'Seat',
    );
    if (seat.status === 'blocked') throw new ConflictException('This seat is blocked');
    if (seat.shared)
      throw new ConflictException({
        message: 'This desk is shared: people book it by the day',
        code: 'shared_desk',
      });
    return seat;
  }

  private openOnSeat(tx: Tx, ctx: RequestContext, seatId: string) {
    return tx.seatAssignment.findFirst({ where: { tenantId: ctx.tenantId, seatId, endAt: null } });
  }

  /** The one allowed change to a history row. */
  private async close(tx: Tx, ctx: RequestContext, id: string, at: Date) {
    try {
      return await tx.seatAssignment.update({
        where: { id, tenantId: ctx.tenantId, endAt: null },
        data: { endAt: at },
      });
    } catch (error) {
      // someone else closed it a moment ago (two admins moving the same person)
      if ((error as { code?: string }).code === 'P2025')
        throw new ConflictException('This seat was just changed by someone else — reload');
      throw error;
    }
  }
}
