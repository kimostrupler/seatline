import { describe, expect, it } from 'vitest';
import {
  clampScale,
  contentBounds,
  fitView,
  initials,
  MAX_SCALE,
  seatAt,
  seatSize,
  toPlan,
  zoomAt,
} from './map-geometry';
import type { Seat } from './types';

describe('initials', () => {
  it('uses first and last name', () => {
    expect(initials('Anna Meier')).toBe('AM');
    expect(initials('Jean-Luc de la Tour')).toBe('JT');
    expect(initials('  cher ')).toBe('C');
    expect(initials('')).toBe('');
  });
});

describe('fitView', () => {
  it('centres the content in the viewport', () => {
    const view = fitView({ minX: 0, minY: 0, maxX: 1000, maxY: 500 }, 1100, 700, 50);
    expect(view.scale).toBe(1);
    // 1000x500 at scale 1 in 1100x700: 50 px left/right, 100 px top/bottom
    expect(view).toEqual({ scale: 1, x: 50, y: 100 });
  });

  it('never zooms in beyond the maximum for tiny floors', () => {
    expect(fitView({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, 1000, 1000).scale).toBe(MAX_SCALE);
  });
});

describe('zoomAt', () => {
  it('keeps the point under the cursor fixed', () => {
    const before = { scale: 1, x: 20, y: 30 };
    const cursor = { x: 300, y: 200 };
    const after = zoomAt(before, 2, cursor);
    expect(after.scale).toBe(2);
    expect(toPlan(after, cursor)).toEqual(toPlan(before, cursor));
  });

  it('clamps the scale', () => {
    expect(clampScale(100)).toBe(MAX_SCALE);
  });
});

describe('seatAt', () => {
  const seat = (id: string, x: number, y: number) => ({ id, x, y }) as Seat;
  const seats = [seat('a', 100, 100), seat('b', 300, 100)];

  it('finds the desk under a point', () => {
    expect(seatAt(seats, { x: 120, y: 110 })?.id).toBe('a');
    expect(seatAt(seats, { x: 290, y: 90 })?.id).toBe('b');
  });

  it('finds nothing between desks', () => {
    expect(seatAt(seats, { x: 200, y: 100 })).toBeUndefined();
  });
});

describe('seatSize', () => {
  it('draws desks at real size once the floor has a scale', () => {
    expect(seatSize({ scale: null, deskWidth: null, deskDepth: null })).toEqual({ w: 64, h: 44 });
    expect(seatSize({ scale: 50, deskWidth: null, deskDepth: null })).toEqual({ w: 80, h: 40 });
    expect(seatSize({ scale: 50, deskWidth: 1.4, deskDepth: 0.7 })).toEqual({ w: 70, h: 35 });
  });

  it("hit tests and frames with the floor's size", () => {
    const s = { id: 's', x: 100, y: 100 } as Seat;
    expect(seatAt([s], { x: 130, y: 100 })).toBe(s);
    expect(seatAt([s], { x: 130, y: 100 }, { w: 20, h: 10 })).toBeUndefined();
    expect(contentBounds([], [s], null, { w: 20, h: 10 })).toMatchObject({ minX: 90, maxX: 110 });
  });
});
