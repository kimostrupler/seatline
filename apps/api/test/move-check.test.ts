import { describe, expect, it } from 'vitest';
import { checkPlan, placeTeam, type Seating } from '../src/moves/check';

// seats s1..s5; anna on s1, ben on s2, s3 reserved, s4 blocked, s5 free; carl has no seat
const seating = (): Seating => ({
  seats: new Map([
    ['s1', { status: 'active' }],
    ['s2', { status: 'active' }],
    ['s3', { status: 'active' }],
    ['s4', { status: 'blocked' }],
    ['s5', { status: 'active' }],
  ]),
  open: [
    { id: 'a1', seatId: 's1', personId: 'anna', kind: 'assigned' },
    { id: 'a2', seatId: 's2', personId: 'ben', kind: 'assigned' },
    { id: 'a3', seatId: 's3', personId: null, kind: 'reserved', reservedFor: 'New hire' },
  ],
  activePeople: new Set(['anna', 'ben', 'carl']),
});

describe('checking a move plan', () => {
  it('swapping two people is fine (both move away)', () => {
    const r = checkPlan(seating(), [
      { personId: 'anna', toSeatId: 's2' },
      { personId: 'ben', toSeatId: 's1' },
    ]);
    expect(r.problems).toEqual([]);
    expect(r.moves).toHaveLength(2);
  });

  it('a seat someone keeps, a blocked seat, a seat wanted twice, a deleted seat', () => {
    const r = checkPlan(seating(), [
      { personId: 'carl', toSeatId: 's1' }, // anna stays → taken
      { personId: 'ben', toSeatId: 's4' }, // blocked
      { personId: 'anna', toSeatId: 's5' },
      { personId: 'dora', toSeatId: 's5' }, // dora isn't active → dropped, so no double
    ]);
    expect(r.problems.map((p) => p.code)).toEqual(['seat_blocked']);
    expect(r.notes).toEqual([{ code: 'person_left', personId: 'dora' }]);

    const r2 = checkPlan(seating(), [
      { personId: 'carl', toSeatId: 's2' }, // ben stays
      { personId: 'anna', toSeatId: 'gone' },
    ]);
    expect(r2.problems).toEqual([
      { code: 'seat_taken', personId: 'carl', seatId: 's2', byPersonId: 'ben' },
      { code: 'seat_missing', personId: 'anna', seatId: 'gone' },
    ]);

    const r3 = checkPlan(seating(), [
      { personId: 'carl', toSeatId: 's5' },
      { personId: 'anna', toSeatId: 's5' },
    ]);
    expect(r3.problems.map((p) => p.code)).toEqual(['seat_double', 'seat_double']);
  });

  it('notes replaced reservations and drops moves that change nothing', () => {
    const r = checkPlan(seating(), [
      { personId: 'carl', toSeatId: 's3' },
      { personId: 'anna', toSeatId: 's1' },
      { personId: 'carl2', toSeatId: null },
    ]);
    expect(r.problems).toEqual([]);
    expect(r.notes.map((n) => n.code)).toEqual([
      'no_change',
      'person_left',
      'reservation_replaced',
    ]);
    expect(r.moves).toEqual([{ personId: 'carl', toSeatId: 's3' }]);
  });
});

describe('placing a team on a floor', () => {
  it('fills free seats in order, skips people already there, reports who didn’t fit', () => {
    const r = placeTeam({
      people: [
        { id: 'carl', displayName: 'Carl' },
        { id: 'anna', displayName: 'Anna' },
        { id: 'zoe', displayName: 'Zoe' },
        { id: 'dan', displayName: 'Dan' },
      ],
      floorSeats: ['s1', 's2', 's3', 's4', 's5'].map((id) => ({
        id,
        status: id === 's4' ? ('blocked' as const) : ('active' as const),
      })),
      seating: { ...seating(), activePeople: new Set(['anna', 'ben', 'carl', 'dan', 'zoe']) },
      // ben is already planned to leave s2
      items: [{ personId: 'ben', toSeatId: null }],
      floorSeatIds: new Set(['s1', 's2', 's3', 's4', 's5']),
    });
    // anna already sits on this floor; free after the plan: s2 (ben leaves) and s5
    expect(r.placed).toEqual([
      { personId: 'carl', toSeatId: 's2' },
      { personId: 'dan', toSeatId: 's5' },
    ]);
    expect(r.unplaced).toEqual(['zoe']);
  });
});
