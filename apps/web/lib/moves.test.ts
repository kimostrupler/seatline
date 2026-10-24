import { describe, expect, it } from 'vitest';
import { projectFloor, zurichTomorrow } from './moves';

describe('the earliest day to schedule a plan', () => {
  it('is tomorrow in Zurich, whatever the browser’s time zone', () => {
    // the night the clocks go back: 22:30 UTC on 24 Oct is already 25 Oct in Zurich, and
    // now + 24 h (22:30 UTC on 25 Oct = 23:30 in Zurich) would still be "today" there
    expect(zurichTomorrow(new Date('2026-10-24T22:30:00Z'))).toBe('2026-10-26');
    // just before midnight in Zurich
    expect(zurichTomorrow(new Date('2026-11-10T22:59:00Z'))).toBe('2026-11-11');
    expect(zurichTomorrow(new Date('2026-11-10T23:01:00Z'))).toBe('2026-11-12');
    // month and year ends
    expect(zurichTomorrow(new Date('2026-12-31T10:00:00Z'))).toBe('2027-01-01');
  });
});
import type { FloorMap, Seat } from './types';

const seat = (id: string, person?: string, extra: Partial<Seat> = {}): Seat => ({
  id,
  floorId: 'f',
  roomId: null,
  label: id,
  x: 0,
  y: 0,
  rotation: 0,
  type: 'desk',
  status: 'active',
  occupancy: person ? 'taken' : 'free',
  currentAssignment: person
    ? {
        id: `a-${person}`,
        seatId: id,
        personId: person,
        kind: 'assigned',
        reservedFor: null,
        startAt: '',
        endAt: null,
        assignedById: '',
        note: null,
        person: { id: person, displayName: person },
      }
    : null,
  ...extra,
});
const ref = (id: string) => ({
  id,
  label: id,
  floorId: 'f',
  floor: { id: 'f', name: 'F', level: 1, buildingId: 'b' },
});
const person = (id: string) => ({ id, displayName: id, department: 'Sales', active: true });
const map = { seats: [seat('s1', 'anna'), seat('s2', 'ben'), seat('s3')] } as unknown as FloorMap;

describe('the floor after a plan', () => {
  it('moves people: their old seat frees up, the new one shows them', () => {
    const { seats, changes } = projectFloor(map, [
      { personId: 'anna', person: person('anna'), fromSeat: ref('s1'), toSeat: ref('s3') },
      { personId: 'ben', person: person('ben'), fromSeat: ref('s2'), toSeat: null },
      { personId: 'carl', person: person('carl'), fromSeat: null, toSeat: ref('s2') },
    ]);
    expect(seats.map((s) => [s.id, s.occupancy, s.currentAssignment?.person?.id ?? null])).toEqual([
      ['s1', 'free', null],
      ['s2', 'taken', 'carl'],
      ['s3', 'taken', 'anna'],
    ]);
    expect([...changes]).toEqual([
      ['s1', 'out'],
      ['s2', 'swap'],
      ['s3', 'in'],
    ]);
  });

  it('people moving in from other floors, and away to other floors', () => {
    const { seats } = projectFloor(map, [
      {
        personId: 'anna',
        person: person('anna'),
        fromSeat: ref('s1'),
        toSeat: { ...ref('x9'), floorId: 'other' },
      },
    ]);
    expect(seats[0]!.occupancy).toBe('free');
  });
});
