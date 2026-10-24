import type { FloorMap, MoveItem, Seat } from './types';

/**
 * The earliest day a plan can be scheduled: tomorrow in Zurich (YYYY-MM-DD), whatever the
 * browser's time zone. One calendar day after today there — not now + 24 h, which is still
 * today on the night the clocks go back.
 */
export function zurichTomorrow(now = new Date()): string {
  const today = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Zurich' });
  const day = new Date(`${today}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

/** How a seat changes in a plan: someone arrives, someone leaves, or both. */
export type PlannedChange = 'in' | 'out' | 'swap';

/**
 * The floor as it will look after the plan: people leave the seats they move away from and
 * appear on their planned seats (a reservation there is replaced). `changes` marks the seats
 * the plan touches, for the map's highlight.
 */
export function projectFloor(
  map: FloorMap,
  items: Pick<MoveItem, 'personId' | 'person' | 'fromSeat' | 'toSeat'>[],
): { seats: Seat[]; changes: Map<string, PlannedChange> } {
  const arriving = new Map<string, (typeof items)[number]>();
  const leaving = new Set<string>();
  for (const i of items) {
    if (i.fromSeat && i.fromSeat.id !== i.toSeat?.id) leaving.add(i.fromSeat.id);
    if (i.toSeat && i.toSeat.id !== i.fromSeat?.id) arriving.set(i.toSeat.id, i);
  }
  const changes = new Map<string, PlannedChange>();
  const seats = map.seats.map((seat): Seat => {
    const comes = arriving.get(seat.id);
    const goes = leaving.has(seat.id);
    if (comes) changes.set(seat.id, goes ? 'swap' : 'in');
    else if (goes) changes.set(seat.id, 'out');
    if (comes)
      return {
        ...seat,
        occupancy: seat.status === 'blocked' ? 'blocked' : 'taken',
        currentAssignment: {
          id: `planned:${comes.personId}`,
          seatId: seat.id,
          personId: comes.personId,
          kind: 'assigned',
          reservedFor: null,
          startAt: '',
          endAt: null,
          assignedById: '',
          note: null,
          person: {
            id: comes.person.id,
            displayName: comes.person.displayName,
            department: comes.person.department,
          },
        },
      };
    if (goes && seat.currentAssignment?.kind === 'assigned')
      return {
        ...seat,
        occupancy: seat.status === 'blocked' ? 'blocked' : 'free',
        currentAssignment: null,
      };
    return seat;
  });
  return { seats, changes };
}
