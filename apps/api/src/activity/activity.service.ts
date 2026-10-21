import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { ActivityKind, ActivityQuery } from '@seatline/shared';
import type { RequestContext } from '../auth/request-context';
import { TenantDb } from '../db/tenant-db.service';

const KIND_TYPES: Record<ActivityKind, string[]> = {
  seating: ['seat_assignment'],
  layout: ['room', 'seat'],
  places: ['building', 'floor'],
  people: ['person', 'tenant'],
};

/** Midnight at the start of a calendar day in Switzerland (the product's home time zone). */
export function zurichMidnight(day: string): Date {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const utc = Date.UTC(y, m - 1, d);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Zurich',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(utc));
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const shown = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return new Date(utc - (shown - utc));
}

const nextDay = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

type Snapshot = Record<string, unknown>;
const snapshots = (value: Prisma.JsonValue | null): Snapshot[] =>
  Array.isArray(value)
    ? (value.filter((v) => v && typeof v === 'object') as Snapshot[])
    : value && typeof value === 'object'
      ? [value as Snapshot]
      : [];
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

/**
 * The workspace's change history (audit log), newest first, with the current names of the
 * people, seats, rooms, floors and buildings it mentions (deleted ones are named from the
 * log's own snapshots on the client).
 */
@Injectable()
export class ActivityService {
  constructor(private readonly db: TenantDb) {}

  list(ctx: RequestContext, q: ActivityQuery) {
    const { tenantId } = ctx;
    return this.db.run(tenantId, async (tx) => {
      const where: Prisma.AuditLogWhereInput = {
        tenantId,
        ...(q.kind && { entityType: { in: KIND_TYPES[q.kind] } }),
        ...((q.from || q.to) && {
          createdAt: {
            ...(q.from && { gte: zurichMidnight(q.from) }),
            ...(q.to && { lt: zurichMidnight(nextDay(q.to)) }),
          },
        }),
        ...(q.personId && {
          OR: [
            { actorId: q.personId },
            { entityId: q.personId },
            { after: { path: ['personId'], equals: q.personId } },
            { before: { path: ['personId'], equals: q.personId } },
          ],
        }),
      };
      const rows = await tx.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: q.limit + 1,
        ...(q.cursor && { cursor: { id: q.cursor }, skip: 1 }),
      });
      const items = rows.slice(0, q.limit);

      // everything the entries mention, looked up in one go per kind
      const ids = {
        people: new Set<string>(),
        seats: new Set<string>(),
        rooms: new Set<string>(),
        floors: new Set<string>(),
        buildings: new Set<string>(),
      };
      for (const e of items) {
        if (e.actorId) ids.people.add(e.actorId);
        if (e.entityType === 'person') ids.people.add(e.entityId);
        if (e.entityType === 'seat') ids.seats.add(e.entityId);
        if (e.entityType === 'room') ids.rooms.add(e.entityId);
        if (e.entityType === 'floor') ids.floors.add(e.entityId);
        if (e.entityType === 'building') ids.buildings.add(e.entityId);
        for (const snap of [...snapshots(e.before), ...snapshots(e.after)]) {
          const add = (set: Set<string>, v: unknown) => str(v) && set.add(str(v)!);
          add(ids.people, snap.personId);
          add(ids.people, snap.assignedBy);
          add(ids.seats, snap.seatId);
          add(ids.floors, snap.floorId);
          add(ids.buildings, snap.buildingId);
        }
      }
      const seats = await tx.seat.findMany({
        where: { tenantId, id: { in: [...ids.seats] } },
        select: { id: true, label: true, floorId: true },
      });
      seats.forEach((s) => ids.floors.add(s.floorId));
      const rooms = await tx.room.findMany({
        where: { tenantId, id: { in: [...ids.rooms] } },
        select: { id: true, name: true, floorId: true },
      });
      rooms.forEach((r) => ids.floors.add(r.floorId));
      const floors = await tx.floor.findMany({
        where: { tenantId, id: { in: [...ids.floors] } },
        select: { id: true, name: true, buildingId: true },
      });
      floors.forEach((f) => ids.buildings.add(f.buildingId));
      const [people, buildings] = await Promise.all([
        tx.person.findMany({
          where: { tenantId, id: { in: [...ids.people] } },
          select: { id: true, displayName: true },
        }),
        tx.building.findMany({
          where: { tenantId, id: { in: [...ids.buildings] } },
          select: { id: true, name: true },
        }),
      ]);
      const byId = <T extends { id: string }>(list: T[]) =>
        Object.fromEntries(list.map(({ id, ...rest }) => [id, rest]));

      return {
        items,
        nextCursor: rows.length > q.limit ? items.at(-1)!.id : null,
        refs: {
          people: byId(people),
          seats: byId(seats),
          rooms: byId(rooms),
          floors: byId(floors),
          buildings: byId(buildings),
        },
      };
    });
  }
}
