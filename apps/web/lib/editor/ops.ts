import {
  relabel,
  roomForPoint,
  type LayoutMarker,
  type LayoutRoom,
  type LayoutSeat,
  type SeatNumbering,
} from '@seatline/shared';

export { relabel };
import type { Marker, Point, Room, Seat } from '../types';

/** What the editor works on: the floor's rooms and seats. */
export interface LayoutDoc {
  rooms: Room[];
  seats: Seat[];
  markers?: Marker[];
}

type Update<T> = Partial<T> & { id: string };

/** One editor action, in the shape PATCH /floors/:id/layout accepts. */
export interface Changes {
  rooms: { create: LayoutRoom[]; update: Update<LayoutRoom>[]; delete: string[] };
  seats: { create: LayoutSeat[]; update: Update<LayoutSeat>[]; delete: string[] };
  markers: { create: LayoutMarker[]; update: Update<LayoutMarker>[]; delete: string[] };
}

export function changes(partial: {
  rooms?: Partial<Changes['rooms']>;
  seats?: Partial<Changes['seats']>;
  markers?: Partial<Changes['markers']>;
}): Changes {
  return {
    rooms: { create: [], update: [], delete: [], ...partial.rooms },
    seats: { create: [], update: [], delete: [], ...partial.seats },
    markers: { create: [], update: [], delete: [], ...partial.markers },
  };
}

export function isEmpty(c: Changes): boolean {
  return [c.rooms, c.seats, c.markers ?? changes({}).markers].every(
    (x) => !x.create.length && !x.update.length && !x.delete.length,
  );
}

const ROOM_KEYS = ['name', 'type', 'polygon', 'capacity', 'equipment', 'team'] as const;
const SEAT_KEYS = ['label', 'x', 'y', 'rotation', 'type', 'status', 'features'] as const;
const MARKER_KEYS = ['kind', 'x', 'y', 'label'] as const;

export const toLayoutRoom = (r: Room): LayoutRoom => ({
  id: r.id,
  name: r.name,
  type: r.type,
  polygon: r.polygon,
  // the newer details only when the room has them (older data / tests don't)
  ...(r.capacity !== undefined && { capacity: r.capacity }),
  ...(r.equipment !== undefined && { equipment: r.equipment }),
  ...(r.team !== undefined && { team: r.team }),
});
export const toLayoutSeat = (s: Seat): LayoutSeat => ({
  id: s.id,
  label: s.label,
  x: s.x,
  y: s.y,
  rotation: s.rotation,
  type: s.type,
  status: s.status,
  ...(s.features !== undefined && { features: s.features }),
});
export const toLayoutMarker = (m: Marker): LayoutMarker => ({
  id: m.id,
  kind: m.kind,
  x: m.x,
  y: m.y,
  label: m.label ?? null,
});

/** Apply changes locally (instant feedback); the server's answer replaces this afterwards. */
export function applyChanges(doc: LayoutDoc, c: Changes, floorId: string): LayoutDoc {
  const roomUpdates = new Map(c.rooms.update.map((u) => [u.id, u]));
  const createdRooms = new Set(c.rooms.create.map((r) => r.id));
  const createdSeats = new Set(c.seats.create.map((s) => s.id));
  // idempotent: applying changes the server already has (cache + pending overlap) is harmless
  const rooms: Room[] = [
    ...doc.rooms
      .filter((r) => !c.rooms.delete.includes(r.id) && !createdRooms.has(r.id))
      .map((r) => ({ ...r, ...roomUpdates.get(r.id) })),
    ...c.rooms.create.map((r) => ({ ...r, floorId })),
  ];
  const seatUpdates = new Map(c.seats.update.map((u) => [u.id, u]));
  const seats: Seat[] = [
    ...doc.seats
      .filter((s) => !c.seats.delete.includes(s.id) && !createdSeats.has(s.id))
      .map((s) => ({ ...s, ...seatUpdates.get(s.id) })),
    ...c.seats.create.map((s): Seat => ({
      ...s,
      floorId,
      roomId: null,
      occupancy: s.status === 'blocked' ? 'blocked' : 'free',
      currentAssignment: null,
    })),
  ].map((s) => ({
    ...s,
    roomId: roomForPoint(s, rooms)?.id ?? null,
    occupancy:
      s.status === 'blocked' ? 'blocked' : s.occupancy === 'blocked' ? 'free' : s.occupancy,
  }));
  const markerUpdates = new Map((c.markers?.update ?? []).map((u) => [u.id, u]));
  const createdMarkers = new Set((c.markers?.create ?? []).map((m) => m.id));
  const markers: Marker[] = [
    ...(doc.markers ?? [])
      .filter((m) => !c.markers?.delete.includes(m.id) && !createdMarkers.has(m.id))
      .map((m) => ({ ...m, ...markerUpdates.get(m.id) })),
    ...(c.markers?.create ?? []),
  ];
  return { rooms, seats, markers };
}

function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: readonly K[],
  only: object,
): Partial<T> {
  return Object.fromEntries(
    keys.filter((k) => k in only).map((k) => [k, obj[k]]),
  ) as unknown as Partial<T>;
}

/** The changes that undo `c`, given the layout before `c` was applied. */
export function inverse(before: LayoutDoc, c: Changes): Changes {
  const room = (id: string) => before.rooms.find((r) => r.id === id)!;
  const seat = (id: string) => before.seats.find((s) => s.id === id)!;
  const marker = (id: string) => (before.markers ?? []).find((m) => m.id === id)!;
  const m = c.markers ?? changes({}).markers;
  // something selected here may already be gone (deleted in another tab): nothing to recreate
  const known = <T extends { id: string }>(items: T[] | undefined, ids: string[]) =>
    ids.filter((id) => items?.some((x) => x.id === id));
  return changes({
    markers: {
      create: known(before.markers, m.delete).map((id) => toLayoutMarker(marker(id))),
      update: m.update.map((u) => ({ id: u.id, ...pick(marker(u.id), MARKER_KEYS, u) })),
      delete: m.create.map((x) => x.id),
    },
    rooms: {
      create: known(before.rooms, c.rooms.delete).map((id) => toLayoutRoom(room(id))),
      update: c.rooms.update.map((u) => ({ id: u.id, ...pick(room(u.id), ROOM_KEYS, u) })),
      delete: c.rooms.create.map((r) => r.id),
    },
    seats: {
      create: known(before.seats, c.seats.delete).map((id) => toLayoutSeat(seat(id))),
      update: c.seats.update.map((u) => ({ id: u.id, ...pick(seat(u.id), SEAT_KEYS, u) })),
      delete: c.seats.create.map((s) => s.id),
    },
  });
}

/** Next free label on a floor: "<level>.<nn>" continuing the highest number used. */
export function nextSeatLabel(
  seats: Pick<Seat, 'label'>[],
  level: number,
  taken = new Set<string>(),
): string {
  const used = new Set([...seats.map((s) => s.label), ...taken]);
  const prefix = `${level}.`;
  let n = Math.max(
    0,
    ...seats
      .map((s) => s.label)
      .filter((l) => l.startsWith(prefix))
      .map((l) => Number(l.slice(prefix.length)))
      .filter(Number.isFinite),
  );
  let label: string;
  do {
    n += 1;
    label = `${prefix}${String(n).padStart(2, '0')}`;
  } while (used.has(label));
  return label;
}

/** A room's number: the first word of its name with a digit in it ("1.04 Open Space" → "1.04"). */
export function roomNumber(name: string): string | null {
  const word = name.split(/\s+/).find((w) => /\d/.test(w));
  return word ? word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '') || null : null;
}

/** A, B, … Z, AA, AB, … */
function letters(i: number): string {
  let out = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26))
    out = String.fromCharCode(65 + ((n - 1) % 26)) + out;
  return out;
}

/** Next free label in a room: "<room>-A", "<room>-B", … */
export function nextRoomSeatLabel(
  seats: Pick<Seat, 'label'>[],
  room: string,
  taken = new Set<string>(),
): string {
  const used = new Set([...seats.map((s) => s.label), ...taken]);
  let i = 0;
  while (used.has(`${room}-${letters(i)}`)) i += 1;
  return `${room}-${letters(i)}`;
}

/** The label for a new desk at `point`, following the floor's numbering. */
export function seatLabelAt(
  doc: LayoutDoc,
  level: number,
  numbering: SeatNumbering,
  point: Point,
  taken = new Set<string>(),
): string {
  const room = numbering === 'room' ? roomForPoint(point, doc.rooms) : undefined;
  const number = room && roomNumber(room.name);
  return number
    ? nextRoomSeatLabel(doc.seats, number, taken)
    : nextSeatLabel(doc.seats, level, taken);
}

/** Seats in reading order: rows top to bottom (within `rowTolerance`), then left to right. */
function readingOrder<T extends Point>(seats: T[], rowTolerance: number): T[] {
  const byY = [...seats].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: T[][] = [];
  for (const s of byY) {
    const row = rows.at(-1);
    if (row && s.y - row[0]!.y <= rowTolerance) row.push(s);
    else rows.push([s]);
  }
  return rows.flatMap((row) => row.sort((a, b) => a.x - b.x));
}

/**
 * Number every desk again, room by room (rooms in name order), in reading order inside each
 * room. "floor": 1.01, 1.02, …; "room": 1.04-A, 1.04-B, … (desks outside a numbered room get
 * floor numbers). Only changed labels are sent.
 */
export function renumberSeats(
  doc: LayoutDoc,
  level: number,
  numbering: SeatNumbering,
  rowTolerance: number,
): Changes {
  const rooms = [...doc.rooms].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true }),
  );
  const groups = [
    ...rooms.map((r) => ({ room: r, seats: doc.seats.filter((s) => s.roomId === r.id) })),
    { room: null, seats: doc.seats.filter((s) => !rooms.some((r) => r.id === s.roomId)) },
  ];
  const labels = new Map<string, string>();
  let n = 0;
  const pad = doc.seats.length > 99 ? 3 : 2;
  // letters per room NUMBER, not per room: "1.04 Office" and "1.04 Meeting" share 1.04, and two
  // "1.04-A" would be refused (labels are unique per floor)
  const used = new Map<string, number>();
  for (const { room, seats } of groups) {
    const number = numbering === 'room' && room ? roomNumber(room.name) : null;
    for (const s of readingOrder(seats, rowTolerance)) {
      if (number) {
        const i = used.get(number) ?? 0;
        used.set(number, i + 1);
        labels.set(s.id, `${number}-${letters(i)}`);
      } else labels.set(s.id, `${level}.${String(++n).padStart(pad, '0')}`);
    }
  }
  return changes({
    seats: {
      update: doc.seats
        .filter((s) => labels.get(s.id) !== s.label)
        .map((s) => ({ id: s.id, label: labels.get(s.id)! })),
    },
  });
}

export const snap = (v: number, grid: number) => Math.round(v / grid) * grid;

/** Grid step in plan units: 10 cm when the floor's scale is known, else 10 units. */
export const gridStep = (scale: number | null | undefined) => (scale ? scale / 10 : 10);

export interface SelectionIds {
  seats: string[];
  rooms: string[];
}

/** Move the selection; seats standing in a moved room move with it. */
export function moveSelection(doc: LayoutDoc, sel: SelectionIds, dx: number, dy: number): Changes {
  if (dx === 0 && dy === 0) return changes({});
  const seatIds = new Set([
    ...sel.seats,
    ...doc.seats.filter((s) => s.roomId && sel.rooms.includes(s.roomId)).map((s) => s.id),
  ]);
  return changes({
    rooms: {
      update: doc.rooms
        .filter((r) => sel.rooms.includes(r.id))
        .map((r) => ({ id: r.id, polygon: r.polygon.map((p) => ({ x: p.x + dx, y: p.y + dy })) })),
    },
    seats: {
      update: doc.seats
        .filter((s) => seatIds.has(s.id))
        .map((s) => ({ id: s.id, x: s.x + dx, y: s.y + dy })),
    },
  });
}

export function rotateSeats(doc: LayoutDoc, seatIds: string[], degrees: number): Changes {
  return changes({
    seats: {
      update: doc.seats
        .filter((s) => seatIds.includes(s.id))
        .map((s) => ({ id: s.id, rotation: (((s.rotation + degrees) % 360) + 360) % 360 })),
    },
  });
}

/** Copied rooms and seats (the clipboard), with the level of the floor they came from. */
export interface Clip {
  level: number;
  rooms: LayoutRoom[];
  seats: LayoutSeat[];
}

/** The selection as a clip; seats standing in a selected room come along. */
export function clipSelection(doc: LayoutDoc, sel: SelectionIds, level: number): Clip {
  return {
    level,
    rooms: doc.rooms.filter((r) => sel.rooms.includes(r.id)).map(toLayoutRoom),
    seats: doc.seats
      .filter((s) => sel.seats.includes(s.id) || (s.roomId && sel.rooms.includes(s.roomId)))
      .map(toLayoutSeat),
  };
}

/**
 * New rooms and seats from a clip, shifted by (dx, dy), with new ids. Labels and names are
 * kept when they're free on this floor (seat labels follow the floor's level), otherwise
 * seats get the next free label and rooms a "copy" name.
 */
export function pasteClip(
  doc: LayoutDoc,
  clip: Clip,
  level: number,
  dx: number,
  dy: number,
  newId: () => string,
  copyName: (name: string) => string,
): { changes: Changes; selection: SelectionIds } {
  const names = new Set(doc.rooms.map((r) => r.name));
  const rooms = clip.rooms.map((r) => {
    const name = names.has(r.name) ? copyName(r.name) : r.name;
    names.add(name);
    return {
      ...r,
      id: newId(),
      name,
      polygon: r.polygon.map((p) => ({ x: p.x + dx, y: p.y + dy })),
    };
  });
  const used = new Set(doc.seats.map((s) => s.label));
  const seats = clip.seats.map((s) => {
    const wanted = relabel(s.label, clip.level, level);
    const label = used.has(wanted) ? nextSeatLabel(doc.seats, level, used) : wanted;
    used.add(label);
    return { ...s, id: newId(), label, x: s.x + dx, y: s.y + dy, status: 'active' as const };
  });
  return {
    changes: changes({ rooms: { create: rooms }, seats: { create: seats } }),
    selection: { rooms: rooms.map((r) => r.id), seats: seats.map((s) => s.id) },
  };
}

/**
 * Where a paste lands: in place, unless that would sit exactly on top of what's already
 * there (e.g. pasting on the same floor) — then one step further each time.
 */
export function pasteOffset(doc: LayoutDoc, clip: Clip, step: number): Point {
  const seatAt = new Set(doc.seats.map((s) => `${s.x},${s.y}`));
  const roomAt = new Set(doc.rooms.map((r) => JSON.stringify(r.polygon)));
  for (let k = 0; k < 100; k++) {
    const d = k * step;
    const clash =
      clip.seats.some((s) => seatAt.has(`${s.x + d},${s.y}`)) ||
      clip.rooms.some((r) =>
        roomAt.has(JSON.stringify(r.polygon.map((p) => ({ x: p.x + d, y: p.y })))),
      );
    if (!clash) return { x: d, y: 0 };
  }
  return { x: 0, y: 0 };
}

/** Copies of the selection, shifted by (dx, dy), with new ids and the next free seat labels. */
export function duplicateSelection(
  doc: LayoutDoc,
  sel: SelectionIds,
  level: number,
  dx: number,
  dy: number,
  newId: () => string,
  copyName: (name: string) => string,
): { changes: Changes; selection: SelectionIds } {
  return pasteClip(doc, clipSelection(doc, sel, level), level, dx, dy, newId, copyName);
}

// ---- room shapes -------------------------------------------------------------

export function polygonBounds(polygon: Point[]) {
  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { minX, minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

/** Four corners with only horizontal and vertical sides. */
export function isAxisRect(polygon: Point[]): boolean {
  return (
    polygon.length === 4 &&
    polygon.every((p, i) => {
      const q = polygon[(i + 1) % 4]!;
      return p.x === q.x || p.y === q.y;
    })
  );
}

/** Move one corner. Rectangles stay rectangles: the two neighbouring corners follow. */
export function moveVertex(polygon: Point[], index: number, to: Point): Point[] {
  const from = polygon[index]!;
  const rect = isAxisRect(polygon);
  const n = polygon.length;
  return polygon.map((p, i) => {
    if (i === index) return to;
    if (!rect || (i !== (index + 1) % n && i !== (index + n - 1) % n)) return p;
    return { x: p.x === from.x ? to.x : p.x, y: p.y === from.y ? to.y : p.y };
  });
}

/** Push one side (corner `index` to the next) outwards or inwards so it passes through `to`. */
export function moveEdge(polygon: Point[], index: number, to: Point): Point[] {
  const n = polygon.length;
  const a = polygon[index]!;
  const b = polygon[(index + 1) % n]!;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len === 0) return polygon;
  const normal = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
  const d = (to.x - a.x) * normal.x + (to.y - a.y) * normal.y;
  // exact for horizontal/vertical sides, so snapping to the grid stays on the grid
  const shift =
    a.y === b.y ? { x: 0, y: to.y - a.y } : a.x === b.x ? { x: to.x - a.x, y: 0 } : null;
  const move = (p: Point) =>
    shift
      ? { x: p.x + shift.x, y: p.y + shift.y }
      : { x: p.x + normal.x * d, y: p.y + normal.y * d };
  return polygon.map((p, i) => (i === index || i === (index + 1) % n ? move(p) : p));
}

/** A new corner in the middle of side `index`. */
export function insertVertex(polygon: Point[], index: number): Point[] {
  const a = polygon[index]!;
  const b = polygon[(index + 1) % polygon.length]!;
  const mid = { x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2) };
  return [...polygon.slice(0, index + 1), mid, ...polygon.slice(index + 1)];
}

/** Remove a corner (a room keeps at least three). */
export function removeVertex(polygon: Point[], index: number): Point[] {
  return polygon.length > 3 ? polygon.filter((_, i) => i !== index) : polygon;
}

/** Stretch a room to a new width/height, keeping its top-left corner in place. */
export function resizePolygon(polygon: Point[], width: number, height: number): Point[] {
  const b = polygonBounds(polygon);
  const kx = b.width ? width / b.width : 1;
  const ky = b.height ? height / b.height : 1;
  return polygon.map((p) => ({
    x: Math.round((b.minX + (p.x - b.minX) * kx) * 100) / 100,
    y: Math.round((b.minY + (p.y - b.minY) * ky) * 100) / 100,
  }));
}

// ---- arranging seats ---------------------------------------------------------

export type Align = 'left' | 'centerX' | 'right' | 'top' | 'middle' | 'bottom';

/** Line seats up on their centres. */
export function alignSeats(doc: LayoutDoc, seatIds: string[], how: Align): Changes {
  const seats = doc.seats.filter((s) => seatIds.includes(s.id));
  if (seats.length < 2) return changes({});
  const xs = seats.map((s) => s.x);
  const ys = seats.map((s) => s.y);
  const target = {
    left: Math.min(...xs),
    right: Math.max(...xs),
    centerX: (Math.min(...xs) + Math.max(...xs)) / 2,
    top: Math.min(...ys),
    bottom: Math.max(...ys),
    middle: (Math.min(...ys) + Math.max(...ys)) / 2,
  }[how];
  const axis = how === 'left' || how === 'right' || how === 'centerX' ? 'x' : 'y';
  return changes({
    seats: {
      update: seats.filter((s) => s[axis] !== target).map((s) => ({ id: s.id, [axis]: target })),
    },
  });
}

/** Even gaps between seats, from the first to the last one along an axis. */
export function distributeSeats(doc: LayoutDoc, seatIds: string[], axis: 'x' | 'y'): Changes {
  const seats = doc.seats.filter((s) => seatIds.includes(s.id)).sort((a, b) => a[axis] - b[axis]);
  if (seats.length < 3) return changes({});
  const first = seats[0]![axis];
  const step = (seats.at(-1)![axis] - first) / (seats.length - 1);
  return changes({
    seats: {
      update: seats
        .map((s, i) => ({ id: s.id, [axis]: Math.round((first + step * i) * 100) / 100 }))
        .filter((u, i) => u[axis] !== seats[i]![axis]),
    },
  });
}

/** `count` more desks next to a seat (to the right or below), facing the same way. */
export function seatRow(
  doc: LayoutDoc,
  seat: Seat,
  count: number,
  direction: 'right' | 'down',
  level: number,
  size: { width: number; height: number; gap: number },
  newId: () => string,
  numbering: SeatNumbering = 'floor',
): { changes: Changes; selection: SelectionIds } {
  const turned = Math.round(seat.rotation / 90) % 2 !== 0;
  const w = turned ? size.height : size.width;
  const h = turned ? size.width : size.height;
  const step = direction === 'right' ? { x: w, y: 0 } : { x: 0, y: h + size.gap };
  const taken = new Set<string>();
  const seats = Array.from({ length: count }, (_, i) => {
    // the row continues the first desk's room numbering
    const label = seatLabelAt(doc, level, numbering, seat, taken);
    taken.add(label);
    return {
      ...toLayoutSeat(seat),
      id: newId(),
      label,
      x: seat.x + step.x * (i + 1),
      y: seat.y + step.y * (i + 1),
      status: 'active' as const,
    };
  });
  return {
    changes: changes({ seats: { create: seats } }),
    selection: { rooms: [], seats: [seat.id, ...seats.map((s) => s.id)] },
  };
}

export function deleteSelection(sel: SelectionIds): Changes {
  return changes({ rooms: { delete: sel.rooms }, seats: { delete: sel.seats } });
}
