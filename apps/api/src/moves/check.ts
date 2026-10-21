/** What a move plan would do to the current seating — shared by the preview and by "apply". */

export interface PlanItem {
  personId: string;
  /** null = the person gives up their seat */
  toSeatId: string | null;
}

export interface Seating {
  seats: Map<string, { status: 'active' | 'blocked' }>;
  /** open assignments and reservations (one per seat, one per person) */
  open: Array<{
    id: string;
    seatId: string;
    personId: string | null;
    kind: 'assigned' | 'reserved';
    reservedFor?: string | null;
  }>;
  activePeople: Set<string>;
}

/** Stops the plan from being applied. */
export interface Problem {
  code: 'seat_taken' | 'seat_blocked' | 'seat_double' | 'seat_missing';
  personId: string;
  seatId: string;
  /** seat_taken: who sits there and isn't moving away */
  byPersonId?: string;
}

/** Worth knowing, but the plan still works. */
export interface Note {
  code: 'person_left' | 'no_change' | 'reservation_replaced';
  personId: string;
  seatId?: string;
  reservedFor?: string;
}

export interface PlanCheck {
  problems: Problem[];
  notes: Note[];
  /** the moves that will really happen (people who left and no-op moves are dropped) */
  moves: PlanItem[];
}

export function checkPlan(seating: Seating, items: PlanItem[]): PlanCheck {
  const problems: Problem[] = [];
  const notes: Note[] = [];
  const onSeat = new Map(seating.open.map((a) => [a.seatId, a]));
  const seatOf = new Map(
    seating.open
      .filter((a) => a.kind === 'assigned' && a.personId)
      .map((a) => [a.personId!, a.seatId]),
  );

  const moves = items.filter((item) => {
    if (!seating.activePeople.has(item.personId)) {
      notes.push({ code: 'person_left', personId: item.personId });
      return false;
    }
    if ((seatOf.get(item.personId) ?? null) === item.toSeatId) {
      notes.push({
        code: 'no_change',
        personId: item.personId,
        seatId: item.toSeatId ?? undefined,
      });
      return false;
    }
    return true;
  });

  const moving = new Set(moves.map((m) => m.personId));
  const wanted = new Map<string, number>();
  for (const m of moves) if (m.toSeatId) wanted.set(m.toSeatId, (wanted.get(m.toSeatId) ?? 0) + 1);

  for (const m of moves) {
    const seatId = m.toSeatId;
    if (!seatId) continue;
    const seat = seating.seats.get(seatId);
    if (!seat) {
      problems.push({ code: 'seat_missing', personId: m.personId, seatId });
      continue;
    }
    if (seat.status === 'blocked')
      problems.push({ code: 'seat_blocked', personId: m.personId, seatId });
    if ((wanted.get(seatId) ?? 0) > 1)
      problems.push({ code: 'seat_double', personId: m.personId, seatId });
    const there = onSeat.get(seatId);
    if (there?.kind === 'assigned' && there.personId && !moving.has(there.personId))
      problems.push({
        code: 'seat_taken',
        personId: m.personId,
        seatId,
        byPersonId: there.personId,
      });
    if (there?.kind === 'reserved')
      notes.push({
        code: 'reservation_replaced',
        personId: m.personId,
        seatId,
        reservedFor: there.reservedFor ?? undefined,
      });
  }
  return { problems, notes, moves };
}

/**
 * Seats a team on a floor: people in name order onto free seats, room by room so the team
 * sits together. People already (or already planned to be) on that floor are left alone.
 */
export function placeTeam(input: {
  people: Array<{ id: string; displayName: string }>;
  /** seats of the target floor, in the order to fill them */
  floorSeats: Array<{ id: string; status: 'active' | 'blocked' }>;
  seating: Seating;
  items: PlanItem[];
  floorSeatIds: Set<string>;
}): { placed: PlanItem[]; unplaced: string[] } {
  const { seating, items, floorSeatIds } = input;
  const planned = new Map(items.map((i) => [i.personId, i.toSeatId]));
  const seatOf = new Map(
    seating.open
      .filter((a) => a.kind === 'assigned' && a.personId)
      .map((a) => [a.personId!, a.seatId]),
  );
  const whereAfter = (personId: string) =>
    planned.has(personId) ? planned.get(personId)! : (seatOf.get(personId) ?? null);

  // a seat is free after the plan if nobody will sit there and it isn't reserved
  const taken = new Set<string>();
  for (const a of seating.open) {
    if (a.kind === 'reserved') taken.add(a.seatId);
    else if (a.personId && whereAfter(a.personId) === a.seatId) taken.add(a.seatId);
  }
  for (const i of items) if (i.toSeatId) taken.add(i.toSeatId);
  const free = input.floorSeats.filter((s) => s.status === 'active' && !taken.has(s.id));

  const placed: PlanItem[] = [];
  const unplaced: string[] = [];
  const people = [...input.people]
    .filter((p) => {
      const after = whereAfter(p.id);
      return !(after && floorSeatIds.has(after));
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  for (const p of people) {
    const seat = free.shift();
    if (seat) placed.push({ personId: p.id, toSeatId: seat.id });
    else unplaced.push(p.id);
  }
  return { placed, unplaced };
}
