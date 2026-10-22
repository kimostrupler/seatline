import { roomForPoint, type PlanDraft } from '@seatline/shared';
import { changes, nextSeatLabel, type Changes, type LayoutDoc } from './ops';

/** Which suggestions the editor keeps (indexes into the draft's rooms and seats). */
export interface ImportPick {
  rooms: ReadonlySet<number>;
  seats: ReadonlySet<number>;
}

export const pickAll = (draft: PlanDraft): ImportPick => ({
  rooms: new Set(draft.rooms.map((_, i) => i)),
  seats: new Set(draft.seats.map((_, i) => i)),
});

/**
 * The kept suggestions as one editor action (so a single undo removes them). Unnamed rooms get
 * `roomName(n)`; desks keep the plan's label when it is free, else continue the floor's labels;
 * a desk in an office room is an office seat.
 */
export function importChanges(
  draft: PlanDraft,
  pick: ImportPick,
  doc: LayoutDoc,
  level: number,
  roomName: (n: number) => string,
  newId: () => string = () => crypto.randomUUID(),
): Changes {
  let unnamed = 0;
  const rooms = draft.rooms
    .filter((_, i) => pick.rooms.has(i))
    .map((r) => ({
      id: newId(),
      name: r.name.trim() || roomName(++unnamed),
      type: r.type,
      polygon: r.polygon,
    }));
  const taken = new Set<string>();
  const used = new Set(doc.seats.map((s) => s.label));
  const seats = draft.seats
    .filter((_, i) => pick.seats.has(i))
    .map((s) => {
      const own = s.label?.trim();
      const label =
        own && !used.has(own) && !taken.has(own) ? own : nextSeatLabel(doc.seats, level, taken);
      taken.add(label);
      return {
        id: newId(),
        label,
        x: s.x,
        y: s.y,
        rotation: s.rotation,
        type: roomForPoint(s, rooms)?.type === 'office' ? ('office' as const) : ('desk' as const),
        status: 'active' as const,
      };
    });
  return changes({ rooms: { create: rooms }, seats: { create: seats } });
}
