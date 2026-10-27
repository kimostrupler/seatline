import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BOOKING_DAYS_AHEAD, type CreateBookingInput } from '@seatline/shared';
import type { RequestContext } from '../auth/request-context';
import { audit } from '../common/audit';
import { orNotFound } from '../common/errors';
import { TenantDb } from '../db/tenant-db.service';
import { zurichToday } from '../moves/moves.service';

const asDate = (day: string) => new Date(`${day}T00:00:00Z`);
const asDay = (d: Date) => d.toISOString().slice(0, 10);
/** `day` plus `n` days, as YYYY-MM-DD */
export const addDays = (day: string, n: number) =>
  asDay(new Date(asDate(day).getTime() + n * 86_400_000));

const canManage = (ctx: RequestContext) => ctx.role === 'admin' || ctx.role === 'editor';

/**
 * Shared desks booked for a day. Everyone in the workspace may book for themselves (viewers
 * too); editors and admins may also book for and cancel for others. One booking per desk per
 * day and one per person per day (unique indexes); cancelling keeps the booking as history.
 */
@Injectable()
export class BookingsService {
  constructor(private readonly db: TenantDb) {}

  /** A floor's bookings on one day (for the map). */
  forFloor(ctx: RequestContext, floorId: string, day: string) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const rows = await tx.deskBooking.findMany({
        where: {
          tenantId: ctx.tenantId,
          day: asDate(day),
          cancelledAt: null,
          seat: { floorId },
        },
        select: {
          id: true,
          seatId: true,
          personId: true,
          day: true,
          person: { select: { displayName: true } },
        },
      });
      return rows.map((r) => ({ ...r, day: asDay(r.day) }));
    });
  }

  /** The caller's own bookings from today on (Home, the map's day picker). */
  mine(ctx: RequestContext) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const rows = await tx.deskBooking.findMany({
        where: {
          tenantId: ctx.tenantId,
          personId: ctx.actorId,
          cancelledAt: null,
          day: { gte: asDate(zurichToday()) },
        },
        orderBy: { day: 'asc' },
        select: {
          id: true,
          seatId: true,
          day: true,
          seat: {
            select: {
              label: true,
              floor: {
                select: { id: true, name: true, building: { select: { id: true, name: true } } },
              },
            },
          },
        },
      });
      return rows.map((r) => ({ ...r, day: asDay(r.day) }));
    });
  }

  async book(ctx: RequestContext, input: CreateBookingInput) {
    const personId = input.personId ?? ctx.actorId;
    if (personId !== ctx.actorId && !canManage(ctx))
      throw new ForbiddenException('Only editors and admins can book for someone else');
    const today = zurichToday();
    if (input.day < today || input.day > addDays(today, BOOKING_DAYS_AHEAD))
      throw new ConflictException({
        message: `Desks can be booked from today up to ${BOOKING_DAYS_AHEAD} days ahead`,
        code: 'day_out_of_range',
      });
    try {
      return await this.db.run(ctx.tenantId, async (tx) => {
        const seat = orNotFound(
          await tx.seat.findFirst({ where: { id: input.seatId, tenantId: ctx.tenantId } }),
          'Seat',
        );
        if (!seat.shared || seat.status === 'blocked')
          throw new ConflictException({
            message: 'Only shared, active desks can be booked',
            code: 'not_bookable',
          });
        const person = orNotFound(
          await tx.person.findFirst({ where: { id: personId, tenantId: ctx.tenantId } }),
          'Person',
        );
        if (!person.active) throw new ConflictException('This person is no longer active');
        const taken = await tx.deskBooking.findFirst({
          where: {
            tenantId: ctx.tenantId,
            day: asDate(input.day),
            cancelledAt: null,
            OR: [{ seatId: seat.id }, { personId }],
          },
          select: { seatId: true },
        });
        if (taken)
          throw new ConflictException(
            taken.seatId === seat.id
              ? { message: 'This desk is already booked that day', code: 'desk_booked' }
              : { message: 'You already have a desk that day', code: 'already_booked' },
          );
        const booking = await tx.deskBooking.create({
          data: {
            tenantId: ctx.tenantId,
            seatId: seat.id,
            personId,
            day: asDate(input.day),
            bookedById: ctx.actorId,
          },
        });
        await audit(tx, ctx, {
          action: 'booking.create',
          entityType: 'seat',
          entityId: seat.id,
          after: { bookingId: booking.id, personId, day: input.day, label: seat.label },
        });
        return { ...booking, day: input.day };
      });
    } catch (error) {
      // two at the same moment: the unique indexes let only one through
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException({
          message: 'Someone booked at the same moment — try again',
          code: 'desk_booked',
        });
      throw error;
    }
  }

  /** Cancel a booking (kept as history). Own bookings, or anyone's for editors and admins. */
  cancel(ctx: RequestContext, id: string) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const booking = orNotFound(
        await tx.deskBooking.findFirst({
          where: { id, tenantId: ctx.tenantId },
          include: { seat: { select: { label: true } } },
        }),
        'Booking',
      );
      if (booking.personId !== ctx.actorId && booking.bookedById !== ctx.actorId && !canManage(ctx))
        throw new ForbiddenException('Only your own bookings can be cancelled');
      if (booking.cancelledAt) throw new ConflictException('This booking is already cancelled');
      if (asDay(booking.day) < zurichToday())
        throw new ConflictException('Past bookings stay as they are');
      const updated = await tx.deskBooking.update({
        where: { id },
        data: { cancelledAt: new Date(), cancelledBy: ctx.actorId },
      });
      await audit(tx, ctx, {
        action: 'booking.cancel',
        entityType: 'seat',
        entityId: booking.seatId,
        before: {
          bookingId: id,
          personId: booking.personId,
          day: asDay(booking.day),
          label: booking.seat.label,
        },
      });
      return { ...updated, day: asDay(updated.day) };
    });
  }
}
