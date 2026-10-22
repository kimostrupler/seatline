import { roomForPoint } from '@seatline/shared';
import { describe, expect, it } from 'vitest';
import { FLOOR_TEMPLATES, templateChanges, templateDesks, type FloorTemplate } from './templates';

const names = {
  openSpace: (n: number) => `Open space ${String.fromCharCode(64 + n)}`,
  meeting: (n: number) => `Meeting ${n}`,
  office: (n: number) => `Office 1${n}`,
  common: 'Reception',
};
const empty = { rooms: [], seats: [] };
const make = (
  id: FloorTemplate,
  numbering: 'floor' | 'room' = 'floor',
  size?: { w: number; h: number },
) => {
  let n = 0;
  return templateChanges(id, {
    doc: empty,
    level: 2,
    numbering,
    size,
    names,
    newId: () => `id-${++n}`,
  });
};

describe('floor templates', () => {
  it('has the promised number of desks', () => {
    expect(FLOOR_TEMPLATES.map(templateDesks)).toEqual([12, 33, 74]);
    for (const id of FLOOR_TEMPLATES) expect(make(id).seats.create).toHaveLength(templateDesks(id));
  });

  it('puts every desk inside a room, and no two desks on top of each other', () => {
    for (const id of FLOOR_TEMPLATES) {
      const c = make(id);
      const rooms = c.rooms.create.map((r) => ({ ...r, floorId: '' }));
      // the whole desk, not just its centre
      for (const s of c.seats.create)
        for (const [dx, dy] of [
          [-32, -22],
          [32, -22],
          [-32, 22],
          [32, 22],
        ] as const)
          expect(roomForPoint({ x: s.x + dx, y: s.y + dy }, rooms)).toBeDefined();
      const seats = c.seats.create;
      for (let i = 0; i < seats.length; i++)
        for (let j = i + 1; j < seats.length; j++) {
          const a = seats[i]!;
          const b = seats[j]!;
          expect(Math.abs(a.x - b.x) >= 64 || Math.abs(a.y - b.y) >= 44).toBe(true);
        }
      for (const m of c.markers.create) expect(roomForPoint(m, rooms)?.name).toBe('Reception');
    }
  });

  it('labels desks like the floor numbers them, all different', () => {
    const labels = make('medium').seats.create.map((s) => s.label);
    expect(new Set(labels).size).toBe(labels.length);
    const byRoom = make('large', 'room').seats.create.map((s) => s.label);
    expect(new Set(byRoom).size).toBe(byRoom.length);
    expect(labels[0]).toBe('2.01');
    // room numbering: the office (named "Office 11") gets 11-A
    const office = make('medium', 'room').seats.create.find((s) => s.type === 'office');
    expect(office?.label).toBe('11-A');
  });

  it('scales to the floor’s desk size', () => {
    const plain = make('small').seats.create[1]!;
    const big = make('small', 'floor', { w: 128, h: 88 }).seats.create[1]!;
    expect(big.x).toBeCloseTo(plain.x * 2);
    expect(big.y).toBeCloseTo(plain.y * 2);
  });

  it('creates meeting rooms with their capacity and ids for undo', () => {
    const c = make('large');
    expect(c.rooms.create.filter((r) => r.type === 'meeting').map((r) => r.capacity)).toEqual([
      12, 6, 4,
    ]);
    const ids = [...c.rooms.create, ...c.seats.create, ...c.markers.create].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
