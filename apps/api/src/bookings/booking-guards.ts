import { ConflictException } from '@nestjs/common';
import { audit } from '../common/audit';
import type { Tx } from '../db/tenant-db.service';
import { zurichToday } from '../moves/moves.service';

/**
 * Desks with bookings can't be deleted (the bookings are history), and a desk with bookings
 * still to come can't stop being shared or be blocked: cancel those bookings first.
 */
export async function guardBookings(
  tx: Tx,
  tenantId: string,
  deleting: string[],
  closing: string[],
  label: (id: string) => string,
) {
  if (deleting.length) {
    const booked = await tx.deskBooking.findMany({
      where: { tenantId, seatId: { in: deleting } },
      select: { seatId: true },
      distinct: ['seatId'],
    });
    if (booked.length)
      throw new ConflictException(
        `Desks with bookings can't be deleted — block them instead: ${booked.map((b) => label(b.seatId)).join(', ')}`,
      );
  }
  if (closing.length) {
    const coming = await tx.deskBooking.findMany({
      where: {
        tenantId,
        seatId: { in: closing },
        cancelledAt: null,
        day: { gte: new Date(`${zurichToday()}T00:00:00Z`) },
      },
      select: { seatId: true },
      distinct: ['seatId'],
    });
    if (coming.length)
      throw new ConflictException({
        message: `These desks are booked for coming days — cancel the bookings first: ${coming.map((b) => label(b.seatId)).join(', ')}`,
        code: 'has_bookings',
      });
  }
}

/** People who leave give up the desks they booked for coming days (cancelled, kept). */
export async function cancelFutureBookings(
  tx: Tx,
  actor: { tenantId: string; actorId: string | null },
  personIds: string[],
) {
  if (!personIds.length) return;
  const coming = await tx.deskBooking.findMany({
    where: {
      tenantId: actor.tenantId,
      personId: { in: personIds },
      cancelledAt: null,
      day: { gte: new Date(`${zurichToday()}T00:00:00Z`) },
    },
    include: { seat: { select: { label: true } } },
  });
  for (const b of coming) {
    await tx.deskBooking.update({
      where: { id: b.id },
      data: { cancelledAt: new Date(), cancelledBy: actor.actorId },
    });
    await audit(tx, actor, {
      action: 'booking.cancel',
      entityType: 'seat',
      entityId: b.seatId,
      before: {
        bookingId: b.id,
        personId: b.personId,
        day: b.day.toISOString().slice(0, 10),
        label: b.seat.label,
      },
      after: { reason: 'left' },
    });
  }
}
