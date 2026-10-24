import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MovesService, zurichToday } from '../src/moves/moves.service';
import { api, appDb, createApp, createTenant, owner, resetDb, type Fixture } from './helpers';

let app: INestApplication;
let a: Fixture;
let b: Fixture;

beforeAll(async () => {
  app = await createApp();
});
afterAll(async () => {
  await app.close();
  await Promise.all([owner.$disconnect(), appDb.$disconnect()]);
});
beforeEach(async () => {
  await resetDb();
  a = await createTenant('alpha');
  b = await createTenant('beta');
});

const http = (f: Fixture = a) => ({
  get: (path: string) => api(app).get(path).set(f.headers),
  post: (path: string, body?: object) => api(app).post(path).set(f.headers).send(body),
  put: (path: string, body: object) => api(app).put(path).set(f.headers).send(body),
});
const assign = (seatId: string, personId: string) =>
  http().post('/assignments', { seatId, personId }).expect(201);
const seatOf = async (personId: string) =>
  (
    await owner.seatAssignment.findFirst({
      where: { personId, endAt: null, kind: 'assigned' },
    })
  )?.seatId ?? null;
const newPlan = async (name = 'Spring move') =>
  (await http().post('/move-plans', { name }).expect(201)).body.id as string;
const tomorrow = () => {
  const d = new Date(`${zurichToday()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

describe('move plans', () => {
  it('a swap plus a new seat, applied at once; history and audit like single moves', async () => {
    const [s1, s2, s3] = a.seatIds;
    const [p1, p2] = a.personIds;
    await assign(s1, p1);
    await assign(s2, p2);
    const id = await newPlan();
    const plan = (
      await http()
        .put(`/move-plans/${id}/items`, {
          items: [
            { personId: p1, toSeatId: s2 },
            { personId: p2, toSeatId: s1 },
            { personId: a.adminId, toSeatId: s3 },
          ],
        })
        .expect(200)
    ).body;
    expect(plan.problems).toEqual([]);
    const p1Item = plan.items.find((i: { personId: string }) => i.personId === p1);
    expect(p1Item).toMatchObject({ fromSeat: { id: s1 }, toSeat: { id: s2, label: 'A2' } });

    // nothing happens until it's applied
    expect(await seatOf(p1)).toBe(s1);
    const applied = (await http().post(`/move-plans/${id}/apply`).expect(201)).body;
    expect(applied.status).toBe('applied');
    expect([await seatOf(p1), await seatOf(p2), await seatOf(a.adminId)]).toEqual([s2, s1, s3]);

    // history kept: the old rows are closed, not changed
    const p1History = await owner.seatAssignment.findMany({ where: { personId: p1 } });
    expect(p1History).toHaveLength(2);
    const actions = await owner.auditLog.findMany({
      where: { tenantId: a.tenantId, entityType: 'seat_assignment' },
      orderBy: { createdAt: 'asc' },
    });
    const moves = actions.filter((x) => (x.after as { movePlanId?: string })?.movePlanId === id);
    expect(moves.map((x) => x.action).sort()).toEqual([
      'assignment.create',
      'assignment.move',
      'assignment.move',
    ]);

    // an applied plan can't change any more
    await http()
      .put(`/move-plans/${id}/items`, { items: [{ personId: p1, toSeatId: s3 }] })
      .expect(409);
  });

  it('problems stop a plan: a seat someone keeps, a blocked seat, a seat wanted twice', async () => {
    const [s1, s2, s3] = a.seatIds;
    const [p1, p2] = a.personIds;
    await assign(s1, p1);
    await owner.seat.update({ where: { id: s3 }, data: { status: 'blocked' } });
    const id = await newPlan();
    const plan = (
      await http()
        .put(`/move-plans/${id}/items`, {
          items: [
            { personId: p2, toSeatId: s1 }, // p1 stays there
            { personId: a.adminId, toSeatId: s3 }, // blocked
            { personId: a.viewerId, toSeatId: s2 },
            { personId: p1, toSeatId: null }, // fine: gives up the seat… which fixes p2's move
          ],
        })
        .expect(200)
    ).body;
    expect(plan.problems.map((p: { code: string }) => p.code)).toEqual(['seat_blocked']);
    await http().post(`/move-plans/${id}/apply`).expect(409);
    expect(await seatOf(p1)).toBe(s1); // nothing happened

    await http().put(`/move-plans/${id}/items`, {
      items: [{ personId: a.adminId, toSeatId: s2 }], // now two people want s2
    });
    const again = (await http().get(`/move-plans/${id}`).expect(200)).body;
    expect(again.problems.map((p: { code: string }) => p.code)).toEqual([
      'seat_double',
      'seat_double',
    ]);
  });

  it('scheduled plans run in the nightly job; a plan that broke meanwhile fails safely', async () => {
    const [s1, s2] = a.seatIds;
    const [p1, p2] = a.personIds;
    const id = await newPlan();
    await http().put(`/move-plans/${id}/items`, { items: [{ personId: p1, toSeatId: s1 }] });
    await http().post(`/move-plans/${id}/schedule`, { effectiveDate: zurichToday() }).expect(400);
    const day = tomorrow();
    const scheduled = (
      await http().post(`/move-plans/${id}/schedule`, { effectiveDate: day }).expect(201)
    ).body;
    expect(scheduled).toMatchObject({ status: 'scheduled', effectiveDate: day });
    // locked while scheduled
    await http()
      .put(`/move-plans/${id}/items`, { items: [{ personId: p2, toSeatId: s2 }] })
      .expect(409);

    // the desk the plan points at can't be deleted meanwhile (the move would silently vanish)
    const del = (seatId: string) =>
      api(app)
        .patch(`/floors/${a.floorId}/layout`)
        .set(a.headers)
        .send({ seats: { delete: [seatId] } });
    expect((await del(s1).expect(409)).body.message).toContain('open move plan');
    await api(app).delete(`/seats/${s1}`).set(a.headers).expect(409);
    expect(await owner.movePlanItem.count({ where: { toSeatId: s1 } })).toBe(1);
    // an impossible day is refused, not a crash
    await http().post(`/move-plans/${id}/schedule`, { effectiveDate: '2027-13-01' }).expect(400);
    await http().post(`/move-plans/${id}/schedule`, { effectiveDate: '2027-02-30' }).expect(400);

    const second = await newPlan('Second');
    await http().put(`/move-plans/${second}/items`, { items: [{ personId: p2, toSeatId: s2 }] });
    await http().post(`/move-plans/${second}/schedule`, { effectiveDate: day }).expect(201);
    await assign(s2, a.adminId); // someone takes s2 before the day

    const moves = app.get(MovesService);
    expect(await moves.applyDue(a.tenantId, zurichToday())).toEqual([]); // not due yet
    const results = await moves.applyDue(a.tenantId, day);
    expect(results).toEqual([
      { id, ok: true },
      { id: second, ok: false },
    ]);
    expect(await seatOf(p1)).toBe(s1);
    expect(await seatOf(p2)).toBeNull();
    const failed = (await http().get(`/move-plans/${second}`).expect(200)).body;
    expect(failed.status).toBe('failed');
    expect(failed.problems[0]).toMatchObject({ code: 'seat_taken', byPersonId: a.adminId });
    // the system made the moves on behalf of whoever scheduled the plan
    const made = await owner.seatAssignment.findFirst({ where: { personId: p1, endAt: null } });
    expect(made?.assignedById).toBe(a.adminId);
    const log = await owner.auditLog.findFirst({ where: { action: 'move_plan.apply' } });
    expect(log?.actorId).toBeNull();
  });

  it('places a whole team on a floor; lists open plans; cancel', async () => {
    const [p1, p2] = a.personIds;
    await owner.person.updateMany({
      where: { id: { in: [p1, p2, a.viewerId] } },
      data: { department: 'Sales' },
    });
    await assign(a.seatIds[0], a.adminId); // A1 taken by someone staying
    const id = await newPlan('Sales to 1. OG');
    const res = (
      await http()
        .post(`/move-plans/${id}/team`, { department: 'Sales', floorId: a.floorId })
        .expect(201)
    ).body;
    expect(res).toMatchObject({ placed: 2, unplaced: 1 });
    expect(res.items.map((i: { toSeat: { label: string } }) => i.toSeat.label).sort()).toEqual([
      'A2',
      'A3',
    ]);

    const open = (await http().get('/move-plans?status=open').expect(200)).body;
    expect(open).toEqual([expect.objectContaining({ id, status: 'draft', moves: 2 })]);
    await http().post(`/move-plans/${id}/cancel`).expect(201);
    expect((await http().get('/move-plans?status=open').expect(200)).body).toEqual([]);
  });

  it('only editors and admins, only their own company', async () => {
    const id = await newPlan();
    await api(app).get('/move-plans').set(a.viewerHeaders).expect(403);
    await api(app).post('/move-plans').set(a.viewerHeaders).send({ name: 'x' }).expect(403);
    await http(b).get(`/move-plans/${id}`).expect(404);
    expect((await http(b).get('/move-plans').expect(200)).body).toEqual([]);
    // a plan can't use another company's people or seats
    await http()
      .put(`/move-plans/${id}/items`, { items: [{ personId: b.personIds[0], toSeatId: null }] })
      .expect(400);
    await http()
      .put(`/move-plans/${id}/items`, {
        items: [{ personId: a.personIds[0], toSeatId: b.seatIds[0] }],
      })
      .expect(400);
  });
});
