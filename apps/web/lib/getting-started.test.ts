import { describe, expect, it } from 'vitest';
import { setupProgress } from './getting-started';

const counts = { seats: 0, free: 0, taken: 0, reserved: 0, blocked: 0 };

describe('getting started', () => {
  it('waits for the data', () => {
    expect(setupProgress(undefined, 3)).toBeNull();
    expect(setupProgress({ ...counts, buildings: [] }, undefined)).toBeNull();
  });

  it('a brand-new workspace has nothing done; only the admin counts as no people', () => {
    expect(setupProgress({ ...counts, buildings: [] }, 1)).toEqual({
      building: false,
      desks: false,
      people: false,
      seated: false,
    });
  });

  it('ticks off what is there', () => {
    expect(setupProgress({ ...counts, seats: 12, free: 11, taken: 1, buildings: [{}] }, 5)).toEqual(
      { building: true, desks: true, people: true, seated: true },
    );
  });
});
