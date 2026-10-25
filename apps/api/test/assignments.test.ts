import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api, appDb, createApp, createTenant, owner, resetDb, type Fixture } from './helpers';

let app: INestApplication;
let t: Fixture;

beforeAll(async () => {
  app = await createApp();
});
afterAll(async () => {
  await app.close();
  await Promise.all([owner.$disconnect(), appDb.$disconnect()]);
});
beforeEach(async () => {
  await resetDb();
  t = await createTenant('acme');
});

const assign = (seatId: string, personId: string) =>
  api(app).post('/assignments').set(t.headers).send({ seatId, personId });

const occupancy = async (seatId: string) =>
  (await api(app).get(`/seats/${seatId}`).set(t.headers).expect(200)).body.occupancy;

describe('assigning seats', () => {
  it('assigns a person to a free seat and audits it', async () => {
    const [seat] = t.seatIds;
    const [person] = t.personIds;
    const res = await assign(seat, person).expect(201);

    expect(res.body.assignment).toMatchObject({ seatId: seat, personId: person, endAt: null });
    expect(res.body.assignment.assignedById).toBe(t.adminId);
    expect(await occupancy(seat)).toBe('taken');

    const log = await owner.auditLog.findMany({ where: { tenantId: t.tenantId } });
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      action: 'assignment.create',
      actorId: t.adminId,
      entityId: res.body.assignment.id,
    });
  });

  it('a move closes the old assignment and keeps it as history', async () => {
    const [seat1, seat2] = t.seatIds;
    const [person] = t.personIds;
    const first = (await assign(seat1, person).expect(201)).body.assignment;
    const moved = await assign(seat2, person).expect(201);

    const { assignment, closed } = moved.body;
    expect(closed).toHaveLength(1);
    expect(closed[0].id).toBe(first.id);
    // no gap and no overlap: the old seat ends exactly when the new one starts
    expect(closed[0].endAt).toBe(assignment.startAt);

    expect(await occupancy(seat1)).toBe('free');
    expect(await occupancy(seat2)).toBe('taken');

    const history = (await api(app).get(`/people/${person}/history`).set(t.headers)).body;
    expect(history.map((h: { seatId: string }) => h.seatId)).toEqual([seat2, seat1]);
    expect(history[1]).toMatchObject({ id: first.id, startAt: first.startAt, note: null });

    const actions = await owner.auditLog.findMany({ orderBy: { createdAt: 'asc' } });
    expect(actions.map((x) => x.action)).toEqual(['assignment.create', 'assignment.move']);
  });

  it('refuses a seat that is already taken', async () => {
    const [seat] = t.seatIds;
    const [p1, p2] = t.personIds;
    await assign(seat, p1).expect(201);
    await assign(seat, p2).expect(409);
    await assign(seat, p1).expect(409);
  });

  it('two people grabbing the same seat at once: exactly one wins', async () => {
    const [seat] = t.seatIds;
    const [p1, p2] = t.personIds;
    const results = await Promise.all([assign(seat, p1), assign(seat, p2)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await owner.seatAssignment.count({ where: { seatId: seat, endAt: null } })).toBe(1);
  });

  it('assigning onto a reserved seat ends the reservation', async () => {
    const [seat] = t.seatIds;
    const [person] = t.personIds;
    await api(app)
      .post('/assignments/reservations')
      .set(t.headers)
      .send({ seatId: seat, reservedFor: 'New hire' })
      .expect(201);
    expect(await occupancy(seat)).toBe('reserved');

    const res = await assign(seat, person).expect(201);
    expect(res.body.closed[0]).toMatchObject({ kind: 'reserved', reservedFor: 'New hire' });
    expect(await occupancy(seat)).toBe('taken');
  });

  it('only reserves free, active seats', async () => {
    const [taken, blocked] = t.seatIds;
    await assign(taken, t.personIds[0]).expect(201);
    await api(app)
      .patch(`/seats/${blocked}`)
      .set(t.headers)
      .send({ status: 'blocked' })
      .expect(200);

    for (const seatId of [taken, blocked]) {
      await api(app)
        .post('/assignments/reservations')
        .set(t.headers)
        .send({ seatId, reservedFor: 'Team X' })
        .expect(409);
    }
    await assign(blocked, t.personIds[1]).expect(409);
  });

  it('freeing a seat ends the assignment but keeps it', async () => {
    const [seat] = t.seatIds;
    const { assignment } = (await assign(seat, t.personIds[0]).expect(201)).body;

    const ended = await api(app)
      .post(`/assignments/${assignment.id}/end`)
      .set(t.headers)
      .send({ note: 'Left the company' })
      .expect(201);
    expect(ended.body.endAt).not.toBeNull();
    expect(await occupancy(seat)).toBe('free');

    const history = (await api(app).get(`/seats/${seat}/history`).set(t.headers)).body;
    expect(history).toHaveLength(1);
    expect(history[0].person.id).toBe(t.personIds[0]);

    await api(app).post(`/assignments/${assignment.id}/end`).set(t.headers).send({}).expect(409);
  });

  it('protects seats that have history', async () => {
    const [seat] = t.seatIds;
    await assign(seat, t.personIds[0]).expect(201);
    await api(app).patch(`/seats/${seat}`).set(t.headers).send({ status: 'blocked' }).expect(409);
    await api(app).delete(`/seats/${seat}`).set(t.headers).expect(409);
    // a seat without history can go
    await api(app).delete(`/seats/${t.seatIds[2]}`).set(t.headers).expect(204);
  });
});

describe('access and validation', () => {
  it('viewers can read but not change anything', async () => {
    await api(app).get('/buildings').set(t.viewerHeaders).expect(200);
    await api(app)
      .post('/assignments')
      .set(t.viewerHeaders)
      .send({ seatId: t.seatIds[0], personId: t.personIds[0] })
      .expect(403);
  });

  it('rejects invalid input with 400', async () => {
    await api(app).post('/assignments').set(t.headers).send({ seatId: 'nope' }).expect(400);
    await api(app)
      .post('/seats')
      .set(t.headers)
      .send({ floorId: t.floorId, label: 'B1', x: 0, y: 0, extra: true })
      .expect(400);
    await api(app).get('/seats/not-a-uuid').set(t.headers).expect(400);
  });

  it('a seat’s room is the room it stands in (clients can’t set one)', async () => {
    const room = (await api(app).get(`/floors/${t.floorId}/map`).set(t.headers)).body.rooms[0] as {
      polygon: Array<{ x: number; y: number }>;
    };
    const inside = {
      x: (room.polygon[0]!.x + room.polygon[2]!.x) / 2,
      y: (room.polygon[0]!.y + room.polygon[2]!.y) / 2,
    };
    await api(app)
      .post('/seats')
      .set(t.headers)
      .send({ floorId: t.floorId, roomId: t.roomId, label: 'B1', x: 0, y: 0 })
      .expect(400);
    const created = await api(app)
      .post('/seats')
      .set(t.headers)
      .send({ floorId: t.floorId, label: 'B1', ...inside })
      .expect(201);
    expect(created.body.roomId).toBe(t.roomId);
    // moved out of the room: no room any more
    const moved = await api(app)
      .patch(`/seats/${created.body.id}`)
      .set(t.headers)
      .send({ x: -5000, y: -5000 })
      .expect(200);
    expect(moved.body.roomId).toBeNull();
    // a room drawn around it later takes it in
    const around = await api(app)
      .post('/rooms')
      .set(t.headers)
      .send({
        floorId: t.floorId,
        name: 'Annex',
        type: 'office',
        polygon: [
          { x: -5100, y: -5100 },
          { x: -4900, y: -5100 },
          { x: -4900, y: -4900 },
          { x: -5100, y: -4900 },
        ],
      })
      .expect(201);
    const seat = (await api(app).get(`/seats/${created.body.id}`).set(t.headers)).body;
    expect(seat.roomId).toBe(around.body.id);
  });

  it('deleting a room keeps its seats on the floor', async () => {
    await api(app).delete(`/rooms/${t.roomId}`).set(t.headers).expect(204);
    const seat = (await api(app).get(`/seats/${t.seatIds[0]}`).set(t.headers).expect(200)).body;
    expect(seat.roomId).toBeNull();
  });
});
