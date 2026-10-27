import { monthlyPrice } from '@seatline/shared/dist/pricing';
import { describe, expect, it } from 'vitest';

describe('monthlyPrice (graduated)', () => {
  it('CHF 2 for the first 50 desks, CHF 0.99 for every desk after that', () => {
    expect(monthlyPrice(1)).toBe(2);
    expect(monthlyPrice(30)).toBe(60);
    expect(monthlyPrice(50)).toBe(100);
    expect(monthlyPrice(51)).toBe(100.99);
    expect(monthlyPrice(100)).toBe(149.5);
    expect(monthlyPrice(300)).toBe(347.5);
  });

  it('a desk more never costs less', () => {
    for (let n = 1; n < 500; n++) expect(monthlyPrice(n + 1)).toBeGreaterThan(monthlyPrice(n));
  });

  it('a flat price is one tier', () => {
    expect(monthlyPrice(7, [{ upTo: null, amount: 3 }])).toBe(21);
  });
});
