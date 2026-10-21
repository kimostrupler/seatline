import { describe, expect, it } from 'vitest';
import type { Room, Seat } from '../types';
import {
  applyChanges,
  changes,
  duplicateSelection,
  inverse,
  isEmpty,
  moveSelection,
  nextSeatLabel,
  rotateSeats,
  snap,
} from './ops';

const room = (id: string, x: number): Room => ({
  id,
  floorId: 'f',
  name: id,
  type: 'office',
  polygon: [
    { x, y: 0 },
    { x: x + 100, y: 0 },
    { x: x + 100, y: 100 },
    { x, y: 100 },
  ],
});
const seat = (id: string, x: number, label = id): Seat => ({
  id,
  floorId: 'f',
  roomId: null,
  label,
  x,
  y: 50,
  rotation: 0,
  type: 'desk',
  status: 'active',
  occupancy: 'free',
  currentAssignment: null,
});
const doc = { rooms: [room('r1', 0)], seats: [seat('s1', 50), seat('s2', 500)] };

describe('applyChanges', () => {
  it('creates, updates and deletes, and recomputes rooms', () => {
    const next = applyChanges(
      doc,
      changes({
        seats: {
          create: [
            { id: 's3', label: '1.03', x: 60, y: 50, rotation: 0, type: 'desk', status: 'active' },
          ],
          update: [{ id: 's1', x: 700 }],
          delete: ['s2'],
        },
      }),
      'f',
    );
    expect(next.seats.map((s) => [s.id, s.roomId])).toEqual([
      ['s1', null],
      ['s3', 'r1'],
    ]);
  });

  it('shows a blocked seat as blocked straight away', () => {
    const next = applyChanges(
      doc,
      changes({ seats: { update: [{ id: 's1', status: 'blocked' }] } }),
      'f',
    );
    expect(next.seats[0]!.occupancy).toBe('blocked');
  });
});

describe('inverse', () => {
  it('undoing any change restores the original layout', () => {
    const c = changes({
      rooms: {
        create: [{ id: 'r2', name: 'New', type: 'meeting', polygon: room('x', 400).polygon }],
        delete: ['r1'],
      },
      seats: {
        create: [{ id: 's9', label: '9', x: 1, y: 1, rotation: 0, type: 'desk', status: 'active' }],
        update: [{ id: 's1', x: 70, rotation: 90 }],
        delete: ['s2'],
      },
    });
    const after = applyChanges(doc, c, 'f');
    const restored = applyChanges(after, inverse(doc, c), 'f');
    const sortById = <T extends { id: string }>(xs: T[]) =>
      [...xs].sort((a, b) => a.id.localeCompare(b.id));
    expect(sortById(restored.rooms)).toEqual(sortById(applyChanges(doc, changes({}), 'f').rooms));
    expect(sortById(restored.seats).map((s) => [s.id, s.x, s.rotation, s.roomId])).toEqual([
      ['s1', 50, 0, 'r1'],
      ['s2', 500, 0, null],
    ]);
  });

  it('only reverts the fields that changed', () => {
    const inv = inverse(doc, changes({ seats: { update: [{ id: 's1', x: 1 }] } }));
    expect(inv.seats.update).toEqual([{ id: 's1', x: 50 }]);
    expect(isEmpty(changes({}))).toBe(true);
  });
});

describe('nextSeatLabel', () => {
  it('continues the floor’s numbering', () => {
    expect(nextSeatLabel([{ label: '2.01' }, { label: '2.07' }, { label: 'Window' }], 2)).toBe(
      '2.08',
    );
    expect(nextSeatLabel([], 1)).toBe('1.01');
    expect(nextSeatLabel([{ label: '1.01' }], 1, new Set(['1.02']))).toBe('1.03');
  });
});

it('snaps to the grid', () => {
  expect(snap(14, 10)).toBe(10);
  expect(snap(15, 10)).toBe(20);
});

describe('selection operations', () => {
  const inRoom = applyChanges(doc, changes({}), 'f'); // s1 is inside r1

  it('moving a room moves the seats standing in it', () => {
    const c = moveSelection(inRoom, { seats: [], rooms: ['r1'] }, 10, 5);
    expect(c.rooms.update[0]!.polygon![0]).toEqual({ x: 10, y: 5 });
    expect(c.seats.update).toEqual([{ id: 's1', x: 60, y: 55 }]);
  });

  it('rotates within 0–359', () => {
    const c = rotateSeats(
      applyChanges(doc, changes({ seats: { update: [{ id: 's1', rotation: 270 }] } }), 'f'),
      ['s1'],
      90,
    );
    expect(c.seats.update).toEqual([{ id: 's1', rotation: 0 }]);
    expect(rotateSeats(inRoom, ['s1'], -90).seats.update[0]!.rotation).toBe(270);
  });

  it('duplicates with new ids and continuing labels', () => {
    let n = 0;
    const { changes: c, selection } = duplicateSelection(
      { ...inRoom, seats: inRoom.seats.map((s, i) => ({ ...s, label: `1.0${i + 1}` })) },
      { seats: ['s1', 's2'], rooms: [] },
      1,
      100,
      0,
      () => `new${++n}`,
      (name) => `${name} copy`,
    );
    expect(c.seats.create.map((s) => [s.id, s.label, s.x])).toEqual([
      ['new1', '1.03', 150],
      ['new2', '1.04', 600],
    ]);
    expect(selection.seats).toEqual(['new1', 'new2']);
  });
});
