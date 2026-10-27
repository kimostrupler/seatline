import { BOOKING_DAYS_AHEAD } from '@seatline/shared/dist/booking';
import type { Seat } from './types';

/** A shared desk booked for one day (GET /bookings?floorId=&day=). */
export interface Booking {
  id: string;
  seatId: string;
  personId: string;
  day: string;
  person: { displayName: string };
}

/** My bookings from today on (GET /bookings/mine). */
export interface MyBooking {
  id: string;
  seatId: string;
  day: string;
  seat: {
    label: string;
    floor: { id: string; name: string; building: { id: string; name: string } };
  };
}

/** Today in Zurich, as YYYY-MM-DD. */
export const zurichDay = (now = new Date()) =>
  now.toLocaleDateString('en-CA', { timeZone: 'Europe/Zurich' });

/** `day` plus `n` days, as YYYY-MM-DD. */
export const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** The days one can book: today and the next BOOKING_DAYS_AHEAD days, weekends left out. */
export function bookingDays(today: string): string[] {
  const days: string[] = [];
  for (let i = 0; i <= BOOKING_DAYS_AHEAD; i++) {
    const day = addDays(today, i);
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    if (weekday !== 0 && weekday !== 6) days.push(day);
  }
  return days;
}

/**
 * The floor on `day`: a shared desk is taken by whoever booked it, else free. The booking
 * stands in for the assignment, so the map, its colours, the accessible list and the legend
 * show bookings like seating. Other desks stay as they are.
 */
export function projectBookings(seats: Seat[], bookings: Booking[]): Seat[] {
  const bySeat = new Map(bookings.map((b) => [b.seatId, b]));
  return seats.map((seat) => {
    if (!seat.shared || seat.status === 'blocked') return seat;
    const b = bySeat.get(seat.id);
    return {
      ...seat,
      occupancy: b ? 'taken' : 'free',
      currentAssignment: b
        ? {
            id: b.id,
            seatId: seat.id,
            personId: b.personId,
            kind: 'assigned',
            reservedFor: null,
            startAt: `${b.day}T00:00:00Z`,
            endAt: null,
            assignedById: b.personId,
            note: null,
            person: { id: b.personId, displayName: b.person.displayName },
          }
        : null,
    };
  });
}
