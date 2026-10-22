import { describe, expect, it } from 'vitest';
import type { Room, Seat } from '../types';
import {
  alignSeats,
  applyChanges,
  changes,
  clipSelection,
  distributeSeats,
  duplicateSelection,
  insertVertex,
  isAxisRect,
  moveEdge,
  moveVertex,
  pasteClip,
  pasteOffset,
  relabel,
  removeVertex,
  resizePolygon,
  seatRow,
  inverse,
  isEmpty,
  moveSelection,
  nextSeatLabel,
  nextRoomSeatLabel,
  renumberSeats,
  roomNumber,
  rotateSeats,
  seatLabelAt,
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

describe('copy and paste', () => {
  let n = 0;
  const id = () => `new${++n}`;
  const copyName = (name: string) => `${name} copy`;

  it('pasting on another floor keeps names and renumbers labels to that level', () => {
    const clip = clipSelection(
      { rooms: [room('r1', 0)], seats: [seat('s1', 50, '1.04')] },
      { rooms: ['r1'], seats: ['s1'] },
      1,
    );
    const other = { rooms: [], seats: [seat('x', 900, '2.04')] };
    expect(pasteOffset(other, clip, 80)).toEqual({ x: 0, y: 0 });
    const { changes: c, selection } = pasteClip(other, clip, 2, 0, 0, id, copyName);
    expect(c.rooms.create[0]).toMatchObject({ name: 'r1', polygon: room('r1', 0).polygon });
    // 2.04 is taken on the target floor, so the copy gets the next free label
    expect(c.seats.create.map((s) => [s.label, s.x])).toEqual([['2.05', 50]]);
    expect(selection.rooms).toHaveLength(1);
    expect(relabel('1.04', 1, 2)).toBe('2.04');
    expect(relabel('Desk A', 1, 2)).toBe('Desk A');
  });

  it('pasting on the same floor moves the copy aside until it lands on free space', () => {
    const clip = clipSelection(doc, { rooms: [], seats: ['s1'] }, 1);
    expect(pasteOffset(doc, clip, 80)).toEqual({ x: 80, y: 0 });
    const twice = { ...doc, seats: [...doc.seats, seat('c', 130)] };
    expect(pasteOffset(twice, clip, 80)).toEqual({ x: 160, y: 0 });
  });
});

describe('room shapes', () => {
  const rect = room('r', 0).polygon; // (0,0) (100,0) (100,100) (0,100)

  it('dragging a corner keeps a rectangle rectangular', () => {
    expect(isAxisRect(rect)).toBe(true);
    expect(moveVertex(rect, 2, { x: 150, y: 120 })).toEqual([
      { x: 0, y: 0 },
      { x: 150, y: 0 },
      { x: 150, y: 120 },
      { x: 0, y: 120 },
    ]);
  });

  it('dragging a corner of other shapes moves only that corner', () => {
    const tri = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 80 },
    ];
    expect(moveVertex(tri, 2, { x: 60, y: 90 })).toEqual([tri[0], tri[1], { x: 60, y: 90 }]);
  });

  it('dragging a side moves both its corners', () => {
    expect(moveEdge(rect, 1, { x: 180, y: 37 })).toEqual([
      { x: 0, y: 0 },
      { x: 180, y: 0 },
      { x: 180, y: 100 },
      { x: 0, y: 100 },
    ]);
    // a slanted side moves along its normal
    const slanted = moveEdge(
      [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
      0,
      { x: 100, y: 0 },
    );
    expect(slanted[0]!.x).toBeCloseTo(50);
    expect(slanted[0]!.y).toBeCloseTo(-50);
  });

  it('adds and removes corners, never below three', () => {
    const five = insertVertex(rect, 0);
    expect(five[1]).toEqual({ x: 50, y: 0 });
    expect(removeVertex(five, 1)).toEqual(rect);
    expect(removeVertex(rect.slice(0, 3), 0)).toHaveLength(3);
  });

  it('resizes from the top-left corner', () => {
    const moved = rect.map((p) => ({ x: p.x + 10, y: p.y + 20 }));
    expect(resizePolygon(moved, 300, 50)).toEqual([
      { x: 10, y: 20 },
      { x: 310, y: 20 },
      { x: 310, y: 70 },
      { x: 10, y: 70 },
    ]);
  });
});

describe('arranging seats', () => {
  const row = {
    rooms: [],
    seats: [seat('a', 0), { ...seat('b', 50), y: 80 }, { ...seat('c', 300), y: 20 }],
  };

  it('aligns on centres', () => {
    expect(alignSeats(row, ['a', 'b', 'c'], 'top').seats.update).toEqual([
      { id: 'a', y: 20 },
      { id: 'b', y: 20 },
    ]);
    expect(alignSeats(row, ['a', 'b', 'c'], 'centerX').seats.update).toHaveLength(3);
  });

  it('spreads seats evenly between the outer two', () => {
    expect(distributeSeats(row, ['a', 'b', 'c'], 'x').seats.update).toEqual([{ id: 'b', x: 150 }]);
    expect(isEmpty(distributeSeats(row, ['a', 'b'], 'x'))).toBe(true);
  });

  it('adds a row of desks with the next labels', () => {
    let n = 0;
    const first = seat('s', 100, '1.01');
    const { changes: c, selection } = seatRow(
      { rooms: [], seats: [first] },
      first,
      2,
      'right',
      1,
      { width: 64, height: 44, gap: 28 },
      () => `n${++n}`,
    );
    expect(c.seats.create.map((s) => [s.label, s.x, s.y])).toEqual([
      ['1.02', 164, 50],
      ['1.03', 228, 50],
    ]);
    expect(selection.seats).toEqual(['s', 'n1', 'n2']);
    const down = seatRow(
      { rooms: [], seats: [first] },
      { ...first, rotation: 90 },
      1,
      'down',
      1,
      { width: 64, height: 44, gap: 28 },
      () => 'd',
    );
    expect(down.changes.seats.create[0]).toMatchObject({ x: 100, y: 50 + 64 + 28 });
  });
});

describe('numbering per room', () => {
  const office = { ...room('r1', 0), name: '1.04 Open Space' };
  const plain = { ...room('r2', 200), name: 'Kitchen' };
  const at = (id: string, x: number, y: number, roomId: string | null, label = id): Seat => ({
    ...seat(id, x, label),
    y,
    roomId,
  });

  it('finds the room number in its name', () => {
    expect(roomNumber('1.04 Open Space')).toBe('1.04');
    expect(roomNumber('Büro 12')).toBe('12');
    expect(roomNumber('(B-3)')).toBe('B-3');
    expect(roomNumber('Kitchen')).toBeNull();
  });

  it('labels desks A, B, … per room and fills gaps', () => {
    const seats = [at('a', 10, 10, 'r1', '1.04-A'), at('c', 30, 10, 'r1', '1.04-C')];
    expect(nextRoomSeatLabel(seats, '1.04')).toBe('1.04-B');
    expect(nextRoomSeatLabel(seats, '1.04', new Set(['1.04-B']))).toBe('1.04-D');
    const many = Array.from({ length: 26 }, (_, i) => ({
      label: `9-${String.fromCharCode(65 + i)}`,
    }));
    expect(nextRoomSeatLabel(many, '9')).toBe('9-AA');
  });

  it('a new desk follows the floor setting and the room it lands in', () => {
    const d = { rooms: [office, plain], seats: [at('x', 10, 10, 'r1', '1.04-A')] };
    expect(seatLabelAt(d, 1, 'room', { x: 50, y: 50 })).toBe('1.04-B');
    expect(seatLabelAt(d, 1, 'room', { x: 250, y: 50 })).toBe('1.01'); // room without a number
    expect(seatLabelAt(d, 1, 'floor', { x: 50, y: 50 })).toBe('1.01');
  });

  it('renumbers room by room in reading order, sending only changed labels', () => {
    const d = {
      rooms: [plain, office],
      seats: [
        at('k1', 260, 20, 'r2', '1.07'),
        at('o2', 60, 22, 'r1', '1.01'), // same row as o1 (within tolerance), right of it
        at('o1', 20, 20, 'r1', '1.02'),
        at('o3', 20, 70, 'r1', '1.03'),
        at('free', 900, 0, null, '1.05'),
      ],
    };
    const byFloor = renumberSeats(d, 1, 'floor', 10).seats.update;
    // "1.04 Open Space" sorts before "Kitchen", seats without a room come last
    expect(Object.fromEntries(byFloor.map((u) => [u.id, u.label]))).toEqual({
      o1: '1.01',
      o2: '1.02',
      k1: '1.04',
    });
    const byRoom = renumberSeats(d, 1, 'room', 10).seats.update;
    expect(Object.fromEntries(byRoom.map((u) => [u.id, u.label]))).toEqual({
      o1: '1.04-A',
      o2: '1.04-B',
      o3: '1.04-C',
      k1: '1.01',
      free: '1.02',
    });
  });
});
