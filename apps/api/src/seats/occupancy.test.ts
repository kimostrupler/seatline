import { describe, expect, it } from 'vitest';
import { seatOccupancy } from './occupancy';

describe('seatOccupancy', () => {
  it('maps seat + open assignment to a map colour', () => {
    expect(seatOccupancy({ status: 'active' }, null)).toBe('free');
    expect(seatOccupancy({ status: 'active' }, { kind: 'assigned' })).toBe('taken');
    expect(seatOccupancy({ status: 'active' }, { kind: 'reserved' })).toBe('reserved');
    expect(seatOccupancy({ status: 'blocked' }, null)).toBe('blocked');
  });
});
