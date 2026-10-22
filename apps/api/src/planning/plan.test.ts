import { describe, expect, it } from 'vitest';
import { spacePlan } from './plan';

const seat = (
  open: 'assigned' | 'reserved' | null,
  zone: string | null = null,
  floorId = 'f1',
) => ({ status: 'active' as const, open, floorId, zone });

describe('space planning', () => {
  it('compares expected people per team with free desks', () => {
    const plan = spacePlan({
      people: [
        { department: 'Sales', seated: true },
        { department: 'Sales', seated: true },
        { department: 'Sales', seated: false },
        { department: 'IT', seated: true },
        { department: null, seated: false },
      ],
      seats: [
        seat('assigned', 'Sales'),
        seat('assigned', 'Sales'),
        seat(null, 'Sales'),
        seat('assigned', null, 'f2'),
        seat('reserved', null, 'f2'),
        seat(null, null, 'f2'),
        { status: 'blocked', open: null, floorId: 'f2', zone: null },
      ],
      floors: [
        { id: 'f1', name: '1', building: 'HQ' },
        { id: 'f2', name: '2', building: 'HQ' },
      ],
      plans: [
        { team: 'Sales', headcount: 6, byDate: '2027-03-01' },
        { team: 'Marketing', headcount: 2, byDate: null },
      ],
    });
    expect(plan.desks).toEqual({ total: 6, free: 2, taken: 3, reserved: 1, blocked: 1 });
    expect(plan.teams).toEqual([
      expect.objectContaining({
        name: 'Sales',
        people: 3,
        seated: 2,
        target: 6,
        needed: 4,
        zoneDesks: 3,
        zoneFree: 1,
      }),
      expect.objectContaining({ name: 'IT', people: 1, seated: 1, target: null, needed: 0 }),
      expect.objectContaining({ name: 'Marketing', people: 0, target: 2, needed: 2 }),
      expect.objectContaining({ name: null, people: 1, needed: 1 }),
    ]);
    // Sales +3, Marketing +2 → 5 more people; 7 need a desk, 2 are free
    expect(plan).toMatchObject({ growth: 5, needed: 7, short: 5 });
    expect(plan.floors).toEqual([
      { id: 'f1', name: '1', building: 'HQ', desks: 3, free: 1 },
      { id: 'f2', name: '2', building: 'HQ', desks: 3, free: 1 },
    ]);
  });

  it('a smaller target never makes desks "needed" below zero', () => {
    const plan = spacePlan({
      people: [
        { department: 'Ops', seated: true },
        { department: 'Ops', seated: true },
      ],
      seats: [seat('assigned'), seat('assigned'), seat(null)],
      floors: [],
      plans: [{ team: 'Ops', headcount: 1, byDate: null }],
    });
    expect(plan).toMatchObject({ needed: 0, growth: 0, short: 0 });
  });
});
