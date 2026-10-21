import { describe, expect, it } from 'vitest';
import { teamSlots, withAlpha } from './team-colors';

describe('team colours', () => {
  it('the four largest named departments get slots 1–4, by size then name', () => {
    const slots = teamSlots([
      { name: 'Sales', people: 3 },
      { name: null, people: 9 },
      { name: 'HR', people: 1 },
      { name: 'Finance', people: 5 },
      { name: 'Engineering', people: 5 },
      { name: 'Legal', people: 2 },
    ]);
    expect([...slots]).toEqual([
      ['Engineering', 1],
      ['Finance', 2],
      ['Sales', 3],
      ['Legal', 4],
    ]);
    expect(slots.has('HR')).toBe(false);
  });

  it('turns hex colours into translucent fills', () => {
    expect(withAlpha('#2a78d6', 0.2)).toBe('rgba(42, 120, 214, 0.2)');
    expect(withAlpha('rgb(1,2,3)', 0.2)).toBe('rgb(1,2,3)');
  });
});
