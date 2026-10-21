import { Injectable } from '@nestjs/common';
import type { RequestContext } from '../auth/request-context';
import { TenantDb } from '../db/tenant-db.service';
import { seatOccupancy } from '../seats/occupancy';

export interface Counts {
  seats: number;
  free: number;
  taken: number;
  reserved: number;
  blocked: number;
}

const empty = (): Counts => ({ seats: 0, free: 0, taken: 0, reserved: 0, blocked: 0 });
const add = (a: Counts, b: Counts) => {
  for (const k of Object.keys(a) as (keyof Counts)[]) a[k] += b[k];
};

/** How full every building and floor is right now. */
@Injectable()
export class OverviewService {
  constructor(private readonly db: TenantDb) {}

  get(ctx: RequestContext) {
    const { tenantId } = ctx;
    return this.db.run(tenantId, async (tx) => {
      const [buildings, floors, seats, open] = await Promise.all([
        tx.building.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
        tx.floor.findMany({ where: { tenantId }, orderBy: { level: 'asc' } }),
        tx.seat.findMany({
          where: { tenantId },
          select: { id: true, floorId: true, status: true },
        }),
        tx.seatAssignment.findMany({
          where: { tenantId, endAt: null },
          select: { seatId: true, kind: true },
        }),
      ]);
      const current = new Map(open.map((a) => [a.seatId, a.kind]));
      const perFloor = new Map<string, Counts>();
      for (const s of seats) {
        const c = perFloor.get(s.floorId) ?? empty();
        const kind = current.get(s.id);
        c.seats += 1;
        c[seatOccupancy(s, kind ? { kind } : null)] += 1;
        perFloor.set(s.floorId, c);
      }
      const total = empty();
      const result = buildings.map((b) => {
        const counts = empty();
        const list = floors
          .filter((f) => f.buildingId === b.id)
          .map((f) => {
            const c = perFloor.get(f.id) ?? empty();
            add(counts, c);
            return { id: f.id, name: f.name, level: f.level, ...c };
          });
        add(total, counts);
        return { id: b.id, name: b.name, address: b.address, ...counts, floors: list };
      });
      return { ...total, buildings: result };
    });
  }
}
