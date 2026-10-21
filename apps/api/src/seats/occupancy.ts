import type { SeatOccupancy } from '@seatline/shared';

/** Map colour for a seat: blocked > reserved/taken (open assignment) > free. */
export function seatOccupancy(
  seat: { status: 'active' | 'blocked' },
  open: { kind: 'assigned' | 'reserved' } | null | undefined,
): SeatOccupancy {
  if (seat.status === 'blocked') return 'blocked';
  if (!open) return 'free';
  return open.kind === 'reserved' ? 'reserved' : 'taken';
}
