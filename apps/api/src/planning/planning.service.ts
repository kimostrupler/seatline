import { Injectable } from '@nestjs/common';
import type { SetTeamPlanInput } from '@seatline/shared';
import type { RequestContext } from '../auth/request-context';
import { audit } from '../common/audit';
import { TenantDb } from '../db/tenant-db.service';
import { spacePlan } from './plan';

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** Space planning: expected headcount per team vs the desks there are (editors and admins). */
@Injectable()
export class PlanningService {
  constructor(private readonly db: TenantDb) {}

  get(ctx: RequestContext) {
    const tenantId = ctx.tenantId;
    return this.db.run(tenantId, async (tx) => {
      const [people, seats, open, rooms, floors, plans] = await Promise.all([
        tx.person.findMany({
          where: { tenantId, active: true },
          select: { id: true, department: true },
        }),
        tx.seat.findMany({
          where: { tenantId },
          select: { id: true, status: true, floorId: true, roomId: true },
        }),
        tx.seatAssignment.findMany({
          where: { tenantId, endAt: null },
          select: { seatId: true, personId: true, kind: true },
        }),
        tx.room.findMany({ where: { tenantId }, select: { id: true, team: true } }),
        tx.floor.findMany({
          where: { tenantId },
          select: { id: true, name: true, level: true, building: { select: { name: true } } },
          orderBy: [{ building: { name: 'asc' } }, { level: 'asc' }],
        }),
        tx.teamPlan.findMany({ where: { tenantId } }),
      ]);
      const seatedPeople = new Set(
        open.filter((a) => a.kind === 'assigned').map((a) => a.personId),
      );
      const onSeat = new Map(open.map((a) => [a.seatId, a.kind]));
      const zoneOf = new Map(rooms.map((r) => [r.id, r.team]));
      return spacePlan({
        people: people.map((p) => ({ department: p.department, seated: seatedPeople.has(p.id) })),
        seats: seats.map((s) => ({
          status: s.status,
          open: onSeat.get(s.id) ?? null,
          floorId: s.floorId,
          zone: (s.roomId && zoneOf.get(s.roomId)) || null,
        })),
        floors: floors.map((f) => ({ id: f.id, name: f.name, building: f.building.name })),
        plans: plans.map((p) => ({ team: p.team, headcount: p.headcount, byDate: day(p.byDate) })),
      });
    });
  }

  /** Set (or remove, headcount null) a team's expected headcount. */
  async setTeam(ctx: RequestContext, input: SetTeamPlanInput) {
    await this.db.run(ctx.tenantId, async (tx) => {
      const where = { tenantId_team: { tenantId: ctx.tenantId, team: input.team } };
      const before = await tx.teamPlan.findUnique({ where });
      if (input.headcount === null) {
        if (before) await tx.teamPlan.delete({ where });
      } else {
        const data = {
          headcount: input.headcount,
          byDate: input.byDate ? new Date(`${input.byDate}T00:00:00Z`) : null,
        };
        await tx.teamPlan.upsert({
          where,
          create: { tenantId: ctx.tenantId, team: input.team, ...data },
          update: data,
        });
      }
      await audit(tx, ctx, {
        action: 'team_plan.set',
        entityType: 'team_plan',
        entityId: before?.id ?? ctx.tenantId,
        before: before && {
          team: before.team,
          headcount: before.headcount,
          byDate: day(before.byDate),
        },
        after: input.headcount === null ? undefined : input,
      });
    });
    return this.get(ctx);
  }
}
