import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { Prisma, type MovePlan } from '@prisma/client';
import type {
  CreateMovePlanInput,
  ListMovePlansQuery,
  MovePlanItemsInput,
  PlaceTeamInput,
  UpdateMovePlanInput,
} from '@seatline/shared';
import type { RequestContext } from '../auth/request-context';
import { audit } from '../common/audit';
import { orNotFound } from '../common/errors';
import { TenantDb, type Tx } from '../db/tenant-db.service';
import { checkPlan, placeTeam, type PlanCheck, type PlanItem, type Seating } from './check';

/** Calendar day in Switzerland, YYYY-MM-DD. */
export const zurichToday = (now = new Date()) =>
  now.toLocaleDateString('en-CA', { timeZone: 'Europe/Zurich' });
const asDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

const seatRef = {
  select: {
    id: true,
    label: true,
    floorId: true,
    floor: { select: { id: true, name: true, level: true, buildingId: true } },
  },
} satisfies Prisma.SeatDefaultArgs;
const personRef = { select: { id: true, displayName: true } } satisfies Prisma.PersonDefaultArgs;

type Actor = Pick<RequestContext, 'tenantId'> & { actorId: string | null };
type Named = { code: string; personId?: string; seatId?: string; byPersonId?: string };

/**
 * Move plans: seat changes prepared as a draft, checked, then applied together — now, or
 * scheduled for a day (the nightly job applies them early that morning). Applying is all or
 * nothing and writes history exactly like single moves (close the old row, open a new one).
 */
@Injectable()
export class MovesService {
  private readonly logger = new Logger(MovesService.name);

  constructor(private readonly db: TenantDb) {}

  list(ctx: RequestContext, query: ListMovePlansQuery) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const open = ['draft', 'scheduled', 'failed'] as const;
      const done = ['applied', 'cancelled'] as const;
      const plans = await tx.movePlan.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(query.status && { status: { in: [...(query.status === 'open' ? open : done)] } }),
        },
        include: { createdBy: personRef, _count: { select: { items: true } } },
        orderBy: [{ effectiveDate: { sort: 'asc', nulls: 'last' } }, { updatedAt: 'desc' }],
        take: 200,
      });
      return plans.map(({ _count, ...p }) => ({
        ...this.present(p),
        createdBy: p.createdBy,
        moves: _count.items,
      }));
    });
  }

  create(ctx: RequestContext, input: CreateMovePlanInput) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const plan = await tx.movePlan.create({
        data: {
          tenantId: ctx.tenantId,
          name: input.name,
          note: input.note,
          createdById: ctx.actorId,
        },
      });
      await audit(tx, ctx, {
        action: 'move_plan.create',
        entityType: 'move_plan',
        entityId: plan.id,
        after: plan,
      });
      return this.present(plan);
    });
  }

  /** The plan, each person's move (from their seat now → planned seat) and what would go wrong. */
  get(ctx: RequestContext, id: string) {
    return this.db.run(ctx.tenantId, (tx) => this.detail(tx, ctx.tenantId, id));
  }

  update(ctx: RequestContext, id: string, input: UpdateMovePlanInput) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const before = await this.editable(tx, ctx.tenantId, id, ['draft', 'scheduled']);
      const after = await tx.movePlan.update({ where: { id }, data: input });
      await audit(tx, ctx, {
        action: 'move_plan.update',
        entityType: 'move_plan',
        entityId: id,
        before: { name: before.name, note: before.note },
        after: { name: after.name, note: after.note, oldName: before.name },
      });
      return this.detail(tx, ctx.tenantId, id);
    });
  }

  /** Add or change moves (one per person). */
  setItems(ctx: RequestContext, id: string, input: MovePlanItemsInput) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const plan = await this.editable(tx, ctx.tenantId, id, ['draft']);
      await this.upsertItems(tx, ctx, plan, input.items);
      return this.detail(tx, ctx.tenantId, id);
    });
  }

  removeItem(ctx: RequestContext, id: string, personId: string) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const plan = await this.editable(tx, ctx.tenantId, id, ['draft']);
      const { count } = await tx.movePlanItem.deleteMany({
        where: { tenantId: ctx.tenantId, planId: id, personId },
      });
      if (count)
        await audit(tx, ctx, {
          action: 'move_plan.items',
          entityType: 'move_plan',
          entityId: id,
          after: { name: plan.name, removed: [personId] },
        });
      return this.detail(tx, ctx.tenantId, id);
    });
  }

  /** Seat a whole department on a floor (free seats, room by room). */
  placeTeam(ctx: RequestContext, id: string, input: PlaceTeamInput) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const plan = await this.editable(tx, ctx.tenantId, id, ['draft']);
      const floor = orNotFound(
        await tx.floor.findFirst({ where: { id: input.floorId, tenantId: ctx.tenantId } }),
        'Floor',
      );
      const [people, floorSeats, seating, items] = await Promise.all([
        tx.person.findMany({
          where: { tenantId: ctx.tenantId, active: true, department: input.department },
          select: { id: true, displayName: true },
        }),
        tx.seat.findMany({
          where: { tenantId: ctx.tenantId, floorId: floor.id },
          select: { id: true, status: true, roomId: true, label: true },
          orderBy: [{ roomId: { sort: 'asc', nulls: 'last' } }, { label: 'asc' }],
        }),
        this.seating(tx, ctx.tenantId),
        this.items(tx, ctx.tenantId, id),
      ]);
      const result = placeTeam({
        people,
        floorSeats,
        seating,
        items,
        floorSeatIds: new Set(floorSeats.map((s) => s.id)),
      });
      if (result.placed.length) await this.upsertItems(tx, ctx, plan, result.placed);
      return {
        ...(await this.detail(tx, ctx.tenantId, id)),
        placed: result.placed.length,
        unplaced: result.unplaced.length,
      };
    });
  }

  schedule(ctx: RequestContext, id: string, effectiveDate: string) {
    if (effectiveDate <= zurichToday())
      throw new BadRequestException('Pick tomorrow or later — or apply the plan now');
    return this.db.run(ctx.tenantId, async (tx) => {
      const plan = await this.editable(tx, ctx.tenantId, id, ['draft', 'scheduled', 'failed']);
      const check = await this.check(tx, ctx.tenantId, id);
      if (!check.moves.length) throw new ConflictException('This plan has no moves');
      if (check.problems.length) throw new ConflictException('Fix the problems in this plan first');
      const after = await tx.movePlan.update({
        where: { id },
        data: {
          status: 'scheduled',
          effectiveDate: new Date(`${effectiveDate}T00:00:00Z`),
          scheduledById: ctx.actorId,
          problems: Prisma.DbNull,
        },
      });
      await audit(tx, ctx, {
        action: 'move_plan.schedule',
        entityType: 'move_plan',
        entityId: id,
        before: { status: plan.status, effectiveDate: asDay(plan.effectiveDate) },
        after: { status: after.status, effectiveDate, name: after.name },
      });
      return this.detail(tx, ctx.tenantId, id);
    });
  }

  /** Back to draft (to change it). */
  unschedule(ctx: RequestContext, id: string) {
    return this.setStatus(ctx, id, ['scheduled', 'failed'], 'draft', 'move_plan.unschedule');
  }

  cancel(ctx: RequestContext, id: string) {
    return this.setStatus(
      ctx,
      id,
      ['draft', 'scheduled', 'failed'],
      'cancelled',
      'move_plan.cancel',
    );
  }

  /** Apply now (any open plan). All or nothing: any problem → nothing changes. */
  applyNow(ctx: RequestContext, id: string) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const plan = await this.editable(tx, ctx.tenantId, id, ['draft', 'scheduled', 'failed']);
      const check = await this.check(tx, ctx.tenantId, id);
      if (!check.moves.length) throw new ConflictException('This plan has no moves');
      if (check.problems.length) throw new ConflictException('Fix the problems in this plan first');
      await this.apply(tx, ctx, ctx.actorId, plan, check);
      return this.detail(tx, ctx.tenantId, id);
    });
  }

  /**
   * The nightly job: apply this workspace's scheduled plans that are due. A plan that can't be
   * applied (someone took a seat meanwhile…) is marked failed with its problems; nothing of it
   * is applied, and editors see it on the Moves page.
   */
  async applyDue(tenantId: string, today = zurichToday()) {
    const due = await this.db.run(tenantId, (tx) =>
      tx.movePlan.findMany({
        where: {
          tenantId,
          status: 'scheduled',
          effectiveDate: { lte: new Date(`${today}T00:00:00Z`) },
        },
        orderBy: [{ effectiveDate: 'asc' }, { createdAt: 'asc' }],
      }),
    );
    const results: Array<{ id: string; ok: boolean }> = [];
    for (const plan of due) {
      const system: Actor = { tenantId, actorId: null };
      const ok = await this.db.run(tenantId, async (tx) => {
        const check = await this.check(tx, tenantId, plan.id);
        if (check.problems.length || !check.moves.length) {
          const problems = check.moves.length ? check.problems : [{ code: 'no_moves' }];
          await tx.movePlan.update({
            where: { id: plan.id },
            data: { status: 'failed', problems: problems as unknown as Prisma.InputJsonValue },
          });
          await audit(tx, system, {
            action: 'move_plan.failed',
            entityType: 'move_plan',
            entityId: plan.id,
            after: { name: plan.name, problems },
          });
          return false;
        }
        // the person who scheduled it is recorded as having made the moves
        await this.apply(tx, system, plan.scheduledById ?? plan.createdById, plan, check);
        return true;
      });
      if (!ok) this.logger.warn(`Move plan ${plan.id} (${tenantId}) could not be applied`);
      results.push({ id: plan.id, ok });
    }
    return results;
  }

  // ---- internals ------------------------------------------------------------------

  private async apply(
    tx: Tx,
    actor: Actor,
    assignedById: string,
    plan: MovePlan,
    check: PlanCheck,
  ) {
    const now = new Date();
    const tenantId = actor.tenantId;
    const open = await tx.seatAssignment.findMany({ where: { tenantId, endAt: null } });
    const ofPerson = new Map(
      open.filter((a) => a.kind === 'assigned' && a.personId).map((a) => [a.personId!, a]),
    );
    const onSeat = new Map(open.map((a) => [a.seatId, a]));
    const close = (id: string) =>
      tx.seatAssignment.update({ where: { id, tenantId, endAt: null }, data: { endAt: now } });

    // 1. close everything that ends (people's old seats, reservations on target seats) first,
    //    so the one-open-per-seat/person rules hold while the new rows go in
    const closedOf = new Map<string, Awaited<ReturnType<typeof close>>[]>();
    for (const m of check.moves) {
      const rows = [];
      const previous = ofPerson.get(m.personId);
      if (previous) rows.push(await close(previous.id));
      const reservation = m.toSeatId ? onSeat.get(m.toSeatId) : undefined;
      if (reservation?.kind === 'reserved') rows.push(await close(reservation.id));
      closedOf.set(m.personId, rows);
    }
    // 2. open the new seats, each with its own history entry
    for (const m of check.moves) {
      const closed = closedOf.get(m.personId) ?? [];
      const previous = ofPerson.get(m.personId);
      if (!m.toSeatId) {
        if (previous)
          await audit(tx, actor, {
            action: 'assignment.end',
            entityType: 'seat_assignment',
            entityId: previous.id,
            before: previous,
            after: { ...closed[0], endNote: plan.name, movePlanId: plan.id },
          });
        continue;
      }
      const assignment = await tx.seatAssignment.create({
        data: {
          tenantId,
          seatId: m.toSeatId,
          personId: m.personId,
          kind: 'assigned',
          startAt: now,
          assignedById,
          note: plan.name,
        },
      });
      await audit(tx, actor, {
        action: previous ? 'assignment.move' : 'assignment.create',
        entityType: 'seat_assignment',
        entityId: assignment.id,
        before: closed.length ? closed : undefined,
        after: { ...assignment, movePlanId: plan.id },
      });
    }
    await tx.movePlan.update({
      where: { id: plan.id },
      data: { status: 'applied', appliedAt: now, problems: Prisma.DbNull },
    });
    await audit(tx, actor, {
      action: 'move_plan.apply',
      entityType: 'move_plan',
      entityId: plan.id,
      after: { name: plan.name, moves: check.moves.length },
    });
  }

  private async setStatus(
    ctx: RequestContext,
    id: string,
    from: MovePlan['status'][],
    to: MovePlan['status'],
    action: string,
  ) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const plan = await this.editable(tx, ctx.tenantId, id, from);
      await tx.movePlan.update({ where: { id }, data: { status: to } });
      await audit(tx, ctx, {
        action,
        entityType: 'move_plan',
        entityId: id,
        before: { status: plan.status },
        after: { status: to, name: plan.name },
      });
      return this.detail(tx, ctx.tenantId, id);
    });
  }

  private async editable(tx: Tx, tenantId: string, id: string, allowed: MovePlan['status'][]) {
    const plan = orNotFound(await tx.movePlan.findFirst({ where: { id, tenantId } }), 'Move plan');
    if (!allowed.includes(plan.status))
      throw new ConflictException(
        plan.status === 'scheduled'
          ? 'This plan is scheduled — move it back to draft to change it'
          : `This plan is ${plan.status}`,
      );
    return plan;
  }

  private async upsertItems(tx: Tx, ctx: RequestContext, plan: MovePlan, items: PlanItem[]) {
    const tenantId = ctx.tenantId;
    const planId = plan.id;
    const personIds = [...new Set(items.map((i) => i.personId))];
    const seatIds = [...new Set(items.flatMap((i) => (i.toSeatId ? [i.toSeatId] : [])))];
    const [people, seats] = await Promise.all([
      tx.person.count({ where: { tenantId, id: { in: personIds } } }),
      tx.seat.count({ where: { tenantId, id: { in: seatIds } } }),
    ]);
    if (people !== personIds.length) throw new BadRequestException('Unknown person');
    if (seats !== seatIds.length) throw new BadRequestException('Unknown seat');
    for (const i of items)
      await tx.movePlanItem.upsert({
        where: { planId_personId: { planId, personId: i.personId } },
        create: { tenantId, planId, personId: i.personId, toSeatId: i.toSeatId },
        update: { toSeatId: i.toSeatId },
      });
    await tx.movePlan.update({ where: { id: planId }, data: { updatedAt: new Date() } });
    await audit(tx, ctx, {
      action: 'move_plan.items',
      entityType: 'move_plan',
      entityId: planId,
      after: { name: plan.name, set: items },
    });
  }

  private items(tx: Tx, tenantId: string, planId: string): Promise<PlanItem[]> {
    return tx.movePlanItem.findMany({
      where: { tenantId, planId },
      select: { personId: true, toSeatId: true },
    });
  }

  private async seating(tx: Tx, tenantId: string): Promise<Seating> {
    const [seats, open, people] = await Promise.all([
      tx.seat.findMany({ where: { tenantId }, select: { id: true, status: true } }),
      tx.seatAssignment.findMany({
        where: { tenantId, endAt: null },
        select: { id: true, seatId: true, personId: true, kind: true, reservedFor: true },
      }),
      tx.person.findMany({ where: { tenantId, active: true }, select: { id: true } }),
    ]);
    return {
      seats: new Map(seats.map((s) => [s.id, { status: s.status }])),
      open,
      activePeople: new Set(people.map((p) => p.id)),
    };
  }

  private async check(tx: Tx, tenantId: string, planId: string) {
    const [seating, items] = await Promise.all([
      this.seating(tx, tenantId),
      this.items(tx, tenantId, planId),
    ]);
    return checkPlan(seating, items);
  }

  private async detail(tx: Tx, tenantId: string, id: string) {
    const plan = orNotFound(
      await tx.movePlan.findFirst({
        where: { id, tenantId },
        include: { createdBy: personRef, scheduledBy: personRef },
      }),
      'Move plan',
    );
    const items = await tx.movePlanItem.findMany({
      where: { tenantId, planId: id },
      include: {
        person: { select: { id: true, displayName: true, department: true, active: true } },
        toSeat: seatRef,
      },
    });
    const current = await tx.seatAssignment.findMany({
      where: {
        tenantId,
        endAt: null,
        kind: 'assigned',
        personId: { in: items.map((i) => i.personId) },
      },
      include: { seat: seatRef },
    });
    const fromOf = new Map(current.map((a) => [a.personId!, a.seat]));
    const open = plan.status === 'draft' || plan.status === 'scheduled' || plan.status === 'failed';
    const check = open ? await this.check(tx, tenantId, id) : null;
    return {
      ...this.present(plan),
      createdBy: plan.createdBy,
      scheduledBy: plan.scheduledBy,
      items: items
        .map((i) => ({
          personId: i.personId,
          person: i.person,
          fromSeat: fromOf.get(i.personId) ?? null,
          toSeat: i.toSeat,
        }))
        .sort((a, b) => a.person.displayName.localeCompare(b.person.displayName)),
      ...(await this.named(tx, tenantId, {
        problems: (check?.problems ?? (plan.problems as Named[] | null) ?? []) as Named[],
        notes: (check?.notes ?? []) as Named[],
      })),
    };
  }

  /** Problems and notes with the names and seat labels they refer to (for readable messages). */
  private async named(tx: Tx, tenantId: string, lists: { problems: Named[]; notes: Named[] }) {
    const all = [...lists.problems, ...lists.notes];
    const personIds = [
      ...new Set(all.flatMap((x) => [x.personId, x.byPersonId]).filter((v): v is string => !!v)),
    ];
    const seatIds = [...new Set(all.map((x) => x.seatId).filter((v): v is string => !!v))];
    const [people, seats] = await Promise.all([
      tx.person.findMany({
        where: { tenantId, id: { in: personIds } },
        select: { id: true, displayName: true },
      }),
      tx.seat.findMany({
        where: { tenantId, id: { in: seatIds } },
        select: { id: true, label: true },
      }),
    ]);
    const name = new Map(people.map((p) => [p.id, p.displayName]));
    const label = new Map(seats.map((x) => [x.id, x.label]));
    const add = (x: Named) => ({
      ...x,
      personName: x.personId ? name.get(x.personId) : undefined,
      byName: x.byPersonId ? name.get(x.byPersonId) : undefined,
      seatLabel: x.seatId ? label.get(x.seatId) : undefined,
    });
    return { problems: lists.problems.map(add), notes: lists.notes.map(add) };
  }

  private present<T extends MovePlan>(p: T) {
    return {
      id: p.id,
      name: p.name,
      note: p.note,
      status: p.status,
      effectiveDate: asDay(p.effectiveDate),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      appliedAt: p.appliedAt,
    };
  }
}
