import { Injectable } from '@nestjs/common';
import type { RequestContext } from '../auth/request-context';
import { TenantDb } from '../db/tenant-db.service';
import { seatOccupancy } from '../seats/occupancy';

const WEEKS = 12;
const LIST = 20;

/** Calendar day in Switzerland, YYYY-MM-DD. */
const zurichDay = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Europe/Zurich' });

/** Monday of the week a calendar day falls in. */
export function mondayOf(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

const SEATING_ACTIONS = {
  'assignment.create': 'assigned',
  'assignment.move': 'moved',
  'assignment.reserve': 'reserved',
  'assignment.end': 'freed',
} as const;

/** Everything the dashboard widgets show, in one round trip and one snapshot. */
@Injectable()
export class StatsService {
  constructor(private readonly db: TenantDb) {}

  get(ctx: RequestContext, now = new Date()) {
    const { tenantId } = ctx;
    return this.db.run(tenantId, async (tx) => {
      const firstWeek = new Date(`${mondayOf(zurichDay(now))}T00:00:00Z`);
      firstWeek.setUTCDate(firstWeek.getUTCDate() - 7 * (WEEKS - 1));
      // a day of slack for the time zone; bucketing below uses Swiss days
      const since = new Date(firstWeek.getTime() - 86_400_000);

      const [floors, buildings, seats, open, people, changes] = await Promise.all([
        tx.floor.findMany({ where: { tenantId }, orderBy: { level: 'asc' } }),
        tx.building.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
        tx.seat.findMany({
          where: { tenantId },
          select: { id: true, label: true, floorId: true, status: true, updatedAt: true },
          orderBy: { label: 'asc' },
        }),
        tx.seatAssignment.findMany({
          where: { tenantId, endAt: null },
          select: {
            id: true,
            seatId: true,
            personId: true,
            kind: true,
            reservedFor: true,
            startAt: true,
          },
          orderBy: { startAt: 'asc' },
        }),
        tx.person.findMany({
          where: { tenantId, active: true },
          select: { id: true, displayName: true, department: true },
          orderBy: { displayName: 'asc' },
        }),
        tx.auditLog.findMany({
          where: {
            tenantId,
            action: { in: Object.keys(SEATING_ACTIONS) },
            createdAt: { gte: since },
          },
          select: { action: true, createdAt: true },
        }),
      ]);

      const floorById = new Map(floors.map((f) => [f.id, f]));
      const buildingById = new Map(buildings.map((b) => [b.id, b]));
      const seatById = new Map(seats.map((s) => [s.id, s]));
      const where = (floorId: string) => {
        const f = floorById.get(floorId)!;
        return {
          floorId,
          floorName: f.name,
          buildingId: f.buildingId,
          buildingName: buildingById.get(f.buildingId)?.name ?? '',
        };
      };
      const openBySeat = new Map(open.map((a) => [a.seatId, a]));
      const seatOfPerson = new Map(
        open.filter((a) => a.kind === 'assigned' && a.personId).map((a) => [a.personId!, a.seatId]),
      );

      // seat changes per week (oldest first, empty weeks included)
      const weeks = Array.from({ length: WEEKS }, (_, i) => {
        const d = new Date(firstWeek);
        d.setUTCDate(d.getUTCDate() + 7 * i);
        return {
          start: d.toISOString().slice(0, 10),
          assigned: 0,
          moved: 0,
          reserved: 0,
          freed: 0,
        };
      });
      const weekByStart = new Map(weeks.map((w) => [w.start, w]));
      for (const c of changes) {
        const week = weekByStart.get(mondayOf(zurichDay(c.createdAt)));
        if (week) week[SEATING_ACTIONS[c.action as keyof typeof SEATING_ACTIONS]] += 1;
      }

      const unseated = people.filter((p) => !seatOfPerson.has(p.id));

      const reservations = open
        .filter((a) => a.kind === 'reserved')
        .map((a) => {
          const seat = seatById.get(a.seatId)!;
          return {
            id: a.id,
            seatId: seat.id,
            seatLabel: seat.label,
            ...where(seat.floorId),
            reservedFor: a.reservedFor ?? '',
            startAt: a.startAt,
          };
        });

      const blocked = seats
        .filter((s) => s.status === 'blocked')
        .map((s) => ({ seatId: s.id, label: s.label, ...where(s.floorId), since: s.updatedAt }));

      const freeByFloor = new Map<string, string[]>();
      for (const s of seats) {
        const a = openBySeat.get(s.id);
        if (seatOccupancy(s, a ? { kind: a.kind } : null) === 'free')
          freeByFloor.set(s.floorId, [...(freeByFloor.get(s.floorId) ?? []), s.label]);
      }
      const freeSeats = floors
        .filter((f) => freeByFloor.has(f.id))
        .map((f) => {
          const labels = freeByFloor.get(f.id)!;
          return { ...where(f.id), free: labels.length, labels: labels.slice(0, 8) };
        });

      // departments: how many people, how many seated, and on which floors
      const departments = new Map<
        string,
        { name: string | null; people: number; seated: number; floors: Map<string, number> }
      >();
      for (const p of people) {
        const key = p.department ?? '';
        const d = departments.get(key) ?? {
          name: p.department,
          people: 0,
          seated: 0,
          floors: new Map<string, number>(),
        };
        d.people += 1;
        const seatId = seatOfPerson.get(p.id);
        if (seatId) {
          d.seated += 1;
          const floorId = seatById.get(seatId)!.floorId;
          d.floors.set(floorId, (d.floors.get(floorId) ?? 0) + 1);
        }
        departments.set(key, d);
      }

      return {
        weeks,
        unseated: {
          total: unseated.length,
          people: unseated.slice(0, LIST),
        },
        reservations: { total: reservations.length, items: reservations.slice(0, LIST) },
        blocked: { total: blocked.length, items: blocked.slice(0, LIST) },
        freeSeats,
        departments: [...departments.values()]
          .sort((a, b) => b.people - a.people || (a.name ?? '').localeCompare(b.name ?? ''))
          .map((d) => ({
            name: d.name,
            people: d.people,
            seated: d.seated,
            floors: [...d.floors]
              .sort((a, b) => b[1] - a[1])
              .map(([floorId, count]) => ({ ...where(floorId), count })),
          })),
      };
    });
  }
}
