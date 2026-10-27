import { describe, expect, it } from 'vitest';
import { addDays, bookingDays, projectBookings } from './bookings';
import type { Seat } from './types';

const seat = (id: string, extra: Partial<Seat> = {}): Seat => ({
  id,
  floorId: 'f',
  roomId: null,
  label: id,
  x: 0,
  y: 0,
  rotation: 0,
  type: 'desk',
  status: 'active',
  occupancy: 'free',
  currentAssignment: null,
  ...extra,
});

describe('bookings on the map', () => {
  it('a booked shared desk is taken by the booker, a free one stays free, others are untouched', () => {
    const seats = [seat('a', { shared: true }), seat('b', { shared: true }), seat('c')];
    const out = projectBookings(seats, [
      { id: 'bk', seatId: 'a', personId: 'p', day: '2026-11-03', person: { displayName: 'Anna' } },
      {
        id: 'x',
        seatId: 'c',
        personId: 'q',
        day: '2026-11-03',
        person: { displayName: 'Ignored' },
      },
    ]);
    expect(out[0]).toMatchObject({
      occupancy: 'taken',
      currentAssignment: { person: { displayName: 'Anna' } },
    });
    expect(out[1]).toMatchObject({ occupancy: 'free', currentAssignment: null });
    expect(out[2]).toBe(seats[2]);
  });

  it('blocked shared desks stay blocked', () => {
    const blocked = seat('a', { shared: true, status: 'blocked', occupancy: 'blocked' });
    expect(projectBookings([blocked], [])[0]).toBe(blocked);
  });

  it('bookable days: today and 4 weeks ahead, working days only', () => {
    const days = bookingDays('2026-10-30'); // a Friday
    expect(days[0]).toBe('2026-10-30');
    expect(days[1]).toBe('2026-11-02'); // Monday
    expect(days.at(-1)! <= addDays('2026-10-30', 28)).toBe(true);
    expect(days).toHaveLength(21);
  });
});
