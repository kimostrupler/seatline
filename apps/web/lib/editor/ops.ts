import { roomForPoint, type LayoutRoom, type LayoutSeat } from '@seatline/shared';
import type { Room, Seat } from '../types';

/** What the editor works on: the floor's rooms and seats. */
export interface LayoutDoc {
  rooms: Room[];
  seats: Seat[];
}

type Update<T> = Partial<T> & { id: string };

/** One editor action, in the shape PATCH /floors/:id/layout accepts. */
export interface Changes {
  rooms: { create: LayoutRoom[]; update: Update<LayoutRoom>[]; delete: string[] };
  seats: { create: LayoutSeat[]; update: Update<LayoutSeat>[]; delete: string[] };
}

export function changes(partial: {
  rooms?: Partial<Changes['rooms']>;
  seats?: Partial<Changes['seats']>;
}): Changes {
  return {
    rooms: { create: [], update: [], delete: [], ...partial.rooms },
    seats: { create: [], update: [], delete: [], ...partial.seats },
  };
}

export function isEmpty(c: Changes): boolean {
  return [c.rooms, c.seats].every((x) => !x.create.length && !x.update.length && !x.delete.length);
}

const ROOM_KEYS = ['name', 'type', 'polygon'] as const;
const SEAT_KEYS = ['label', 'x', 'y', 'rotation', 'type', 'status'] as const;

export const toLayoutRoom = (r: Room): LayoutRoom => ({
  id: r.id,
  name: r.name,
  type: r.type,
  polygon: r.polygon,
});
export const toLayoutSeat = (s: Seat): LayoutSeat => ({
  id: s.id,
  label: s.label,
  x: s.x,
  y: s.y,
  rotation: s.rotation,
  type: s.type,
  status: s.status,
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
  return { rooms, seats };
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
  return changes({
    rooms: {
      create: c.rooms.delete.map((id) => toLayoutRoom(room(id))),
      update: c.rooms.update.map((u) => ({ id: u.id, ...pick(room(u.id), ROOM_KEYS, u) })),
      delete: c.rooms.create.map((r) => r.id),
    },
    seats: {
      create: c.seats.delete.map((id) => toLayoutSeat(seat(id))),
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
  const rooms = doc.rooms
    .filter((r) => sel.rooms.includes(r.id))
    .map((r) => ({
      ...toLayoutRoom(r),
      id: newId(),
      name: copyName(r.name),
      polygon: r.polygon.map((p) => ({ x: p.x + dx, y: p.y + dy })),
    }));
  const seatSources = doc.seats.filter(
    (s) => sel.seats.includes(s.id) || (s.roomId && sel.rooms.includes(s.roomId)),
  );
  const taken = new Set<string>();
  const seats = seatSources.map((s) => {
    const label = nextSeatLabel(doc.seats, level, taken);
    taken.add(label);
    return {
      ...toLayoutSeat(s),
      id: newId(),
      label,
      x: s.x + dx,
      y: s.y + dy,
      status: 'active' as const,
    };
  });
  return {
    changes: changes({ rooms: { create: rooms }, seats: { create: seats } }),
    selection: { rooms: rooms.map((r) => r.id), seats: seats.map((s) => s.id) },
  };
}

export function deleteSelection(sel: SelectionIds): Changes {
  return changes({ rooms: { delete: sel.rooms }, seats: { delete: sel.seats } });
}
