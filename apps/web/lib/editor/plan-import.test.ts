import type { PlanDraft } from '@seatline/shared';
import { describe, expect, it } from 'vitest';
import { importChanges, pickAll } from './plan-import';

const square = (x: number) => [
  { x, y: 0 },
  { x: x + 100, y: 0 },
  { x: x + 100, y: 100 },
  { x, y: 100 },
];
const draft: PlanDraft = {
  source: 'dxf',
  width: 400,
  height: 200,
  scale: 40,
  rooms: [
    { name: '1.01 Büro', type: 'office', polygon: square(0) },
    { name: '', type: 'other', polygon: square(200) },
    { name: '', type: 'open_space', polygon: square(300) },
  ],
  seats: [
    { x: 50, y: 50, rotation: 0, label: 'A1' },
    { x: 250, y: 50, rotation: 90, label: '2.01' },
    { x: 350, y: 50, rotation: 0, label: null },
  ],
  warnings: [],
};
let n = 0;
const ids = () => `id-${++n}`;

describe('plan import → editor action', () => {
  it('names unnamed rooms, keeps free labels, continues the floor’s numbering', () => {
    const doc = { rooms: [], seats: [{ label: '2.01' }, { label: '2.02' }] } as never;
    const c = importChanges(draft, pickAll(draft), doc, 2, (i) => `Room ${i}`, ids);
    expect(c.rooms.create.map((r) => r.name)).toEqual(['1.01 Büro', 'Room 1', 'Room 2']);
    // "2.01" is taken on this floor → next free number; "A1" is kept
    expect(c.seats.create.map((s) => s.label)).toEqual(['A1', '2.03', '2.04']);
    expect(c.seats.create.map((s) => s.type)).toEqual(['office', 'desk', 'desk']);
    expect(c.seats.create.every((s) => s.status === 'active')).toBe(true);
    expect(c.rooms.update).toEqual([]);
  });

  it('only takes what was picked', () => {
    const doc = { rooms: [], seats: [] } as never;
    const c = importChanges(
      draft,
      { rooms: new Set([0]), seats: new Set([2]) },
      doc,
      1,
      String,
      ids,
    );
    expect(c.rooms.create).toHaveLength(1);
    expect(c.seats.create).toMatchObject([{ x: 350, label: '1.01' }]);
  });
});
