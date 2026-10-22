import type { MarkerKind, RoomType, SeatNumbering } from '@seatline/shared';
import { DEFAULT_SEAT_SIZE, type SeatSize } from '../map-geometry';
import { changes, seatLabelAt, type Changes, type LayoutDoc } from './ops';

/** Ready-made offices for an empty floor (a start; everything can be changed afterwards). */
export const FLOOR_TEMPLATES = ['small', 'medium', 'large'] as const;
export type FloorTemplate = (typeof FLOOR_TEMPLATES)[number];

interface Spec {
  /** open spaces side by side: benches across × down, desks per bench row */
  openSpaces: Array<{ across: number; down: number; desks: number }>;
  meetings: number[];
  offices: number;
}

const SPECS: Record<FloorTemplate, Spec> = {
  // 2 benches × 2 rows × 3 desks = 12
  small: { openSpaces: [{ across: 1, down: 2, desks: 3 }], meetings: [6], offices: 0 },
  // 4 × 2 × 4 = 32
  medium: { openSpaces: [{ across: 2, down: 2, desks: 4 }], meetings: [8, 4], offices: 1 },
  // 2 open spaces × 6 benches × 2 rows × 3 desks = 72, + 2 offices
  large: {
    openSpaces: [
      { across: 2, down: 3, desks: 3 },
      { across: 2, down: 3, desks: 3 },
    ],
    meetings: [12, 6, 4],
    offices: 2,
  },
};

/** Desks in a template (the offices' desks included). */
export const templateDesks = (id: FloorTemplate) => {
  const s = SPECS[id];
  return s.openSpaces.reduce((n, o) => n + o.across * o.down * 2 * o.desks, 0) + s.offices;
};

export interface TemplateNames {
  openSpace: (n: number) => string;
  meeting: (n: number) => string;
  office: (n: number) => string;
  common: string;
}

// layout in default desk units (64 × 44), scaled to the floor's desk size
const GAP = 8; // between desks in a row
const AISLE = 80; // between benches
const PAD = 48; // inside a room's walls
const TOP = 64; // room name above the desks
const WALL = 24; // between rooms
const SIDE = 280; // width of a meeting rooms / offices column
const SIDE_MIN_H = 140;
const COMMON_H = 200;

type Point = { x: number; y: number };
const rect = (x: number, y: number, w: number, h: number): Point[] => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

/**
 * A template as one editor action (one undo removes it): open spaces with benches of desks
 * facing each other, meeting rooms and offices on the right, a common area along the bottom
 * (reception, kitchen, printer, exit). Desks follow the floor's numbering.
 */
export function templateChanges(
  id: FloorTemplate,
  opts: {
    doc: LayoutDoc;
    level: number;
    numbering: SeatNumbering;
    size?: SeatSize;
    names: TemplateNames;
    newId?: () => string;
  },
): Changes {
  const spec = SPECS[id];
  const newId = opts.newId ?? (() => crypto.randomUUID());
  const k = (opts.size ?? DEFAULT_SEAT_SIZE).w / DEFAULT_SEAT_SIZE.w;
  const { w: DW, h: DH } = DEFAULT_SEAT_SIZE;
  const rooms: Array<{ name: string; type: RoomType; polygon: Point[]; capacity?: number }> = [];
  const desks: Array<Point & { rotation: number; office?: boolean }> = [];

  let x = 40;
  let height = 0;
  spec.openSpaces.forEach((o, n) => {
    const benchW = o.desks * DW + (o.desks - 1) * GAP;
    const w = 2 * PAD + o.across * benchW + (o.across - 1) * AISLE;
    const h = TOP + PAD + o.down * 2 * DH + (o.down - 1) * AISLE;
    rooms.push({
      name: opts.names.openSpace(n + 1),
      type: 'open_space',
      polygon: rect(x, 40, w, h),
    });
    for (let by = 0; by < o.down; by++)
      for (let row = 0; row < 2; row++)
        for (let bx = 0; bx < o.across; bx++)
          for (let d = 0; d < o.desks; d++)
            desks.push({
              x: x + PAD + bx * (benchW + AISLE) + d * (DW + GAP) + DW / 2,
              y: 40 + TOP + by * (2 * DH + AISLE) + row * DH + DH / 2,
              // the two rows of a bench face each other
              rotation: row === 0 ? 0 : 180,
            });
    x += w + WALL;
    height = Math.max(height, h);
  });

  // meeting rooms, then offices, in columns beside the open spaces (a new column when a room
  // would get lower than SIDE_MIN_H)
  const side = [
    ...spec.meetings.map((capacity, n) => ({
      name: opts.names.meeting(n + 1),
      type: 'meeting' as const,
      capacity,
    })),
    ...Array.from({ length: spec.offices }, (_, n) => ({
      name: opts.names.office(n + 1),
      type: 'office' as const,
    })),
  ];
  const perColumn = Math.max(1, Math.floor((height + WALL) / (SIDE_MIN_H + WALL)));
  for (let c = 0; c * perColumn < side.length; c++) {
    const column = side.slice(c * perColumn, (c + 1) * perColumn);
    const roomH = (height - (column.length - 1) * WALL) / column.length;
    column.forEach((room, i) => {
      const y = 40 + i * (roomH + WALL);
      rooms.push({ ...room, polygon: rect(x, y, SIDE, roomH) });
      // an office's desk sits in the middle, below the room's name
      if (room.type === 'office')
        desks.push({ x: x + SIDE / 2, y: y + (roomH + TOP / 2) / 2, rotation: 0, office: true });
    });
    x += SIDE + WALL;
  }
  x -= SIDE + WALL;
  const right = x + SIDE;
  const commonY = 40 + height + WALL;
  rooms.push({
    name: opts.names.common,
    type: 'other',
    polygon: rect(40, commonY, right - 40, COMMON_H),
  });
  const along = (f: number) => 40 + (right - 40) * f;
  const markers: Array<{ kind: MarkerKind } & Point> = [
    { kind: 'reception', x: along(0.12), y: commonY + COMMON_H / 2 },
    { kind: 'printer', x: along(0.45), y: commonY + COMMON_H / 2 },
    { kind: 'kitchen', x: along(0.75), y: commonY + COMMON_H / 2 },
    { kind: 'exit', x: right - 40, y: commonY + COMMON_H - 40 },
  ];

  const scale = (p: Point[]) => p.map((q) => ({ x: q.x * k, y: q.y * k }));
  const created = rooms.map((r) => ({ ...r, id: newId(), polygon: scale(r.polygon) }));
  // labels like any desk added by hand (room numbering uses the new rooms' names)
  const doc: LayoutDoc = {
    rooms: [...opts.doc.rooms, ...created.map((r) => ({ ...r, floorId: '' }))],
    seats: opts.doc.seats,
  };
  const taken = new Set<string>();
  const seats = desks.map((d) => {
    const point = { x: d.x * k, y: d.y * k };
    const label = seatLabelAt(doc, opts.level, opts.numbering, point, taken);
    taken.add(label);
    return {
      id: newId(),
      label,
      ...point,
      rotation: d.rotation,
      type: d.office ? ('office' as const) : ('desk' as const),
      status: 'active' as const,
    };
  });
  return changes({
    rooms: { create: created },
    seats: { create: seats },
    markers: {
      create: markers.map((m) => ({ id: newId(), kind: m.kind, x: m.x * k, y: m.y * k })),
    },
  });
}
