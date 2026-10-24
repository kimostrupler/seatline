import { describe, expect, it } from 'vitest';
import { asClip } from './clipboard';

describe('layout clipboard', () => {
  it('ignores anything that is not a clip we wrote', () => {
    const clip = { level: 1, rooms: [], seats: [] };
    expect(asClip(clip)).toBe(clip);
    for (const bad of [
      null,
      5,
      'x',
      {},
      { rooms: [], seats: [] },
      { level: 1, rooms: {}, seats: [] },
    ])
      expect(asClip(bad)).toBeNull();
  });
});
