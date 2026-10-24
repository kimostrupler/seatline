import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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

const layout = (f: Fixture, body: object, headers = f.headers) =>
  api(app).patch(`/floors/${f.floorId}/layout`).set(headers).send(body);

const square = (x: number, y: number, size: number) => [
  { x, y },
  { x: x + size, y },
  { x: x + size, y: y + size },
  { x, y: y + size },
];
const seat = (label: string, x: number, y: number) => ({
  id: randomUUID(),
  label,
  x,
  y,
  rotation: 0,
  type: 'desk',
  status: 'active',
});

describe('layout batch', () => {
  it('creates a room and seats together; seats join the room they stand in', async () => {
    const room = {
      id: randomUUID(),
      name: 'Focus',
      type: 'office',
      polygon: square(100, 100, 200),
    };
    const inside = seat('F1', 150, 150);
    const outside = seat('F2', 500, 500);
    const res = await layout(a, {
      rooms: { create: [room] },
      seats: { create: [inside, outside] },
    }).expect(200);

    const byId = new Map(res.body.seats.map((s: { id: string }) => [s.id, s]));
    expect(byId.get(inside.id)).toMatchObject({ roomId: room.id, occupancy: 'free' });
    expect(byId.get(outside.id)).toMatchObject({ roomId: null });
    expect(res.body.rooms.map((r: { id: string }) => r.id)).toContain(room.id);
  });

  it('moving a seat out of its room clears its room', async () => {
    const s = seat('M1', 150, 150);
    const room = { id: randomUUID(), name: 'R', type: 'office', polygon: square(100, 100, 200) };
    await layout(a, { rooms: { create: [room] }, seats: { create: [s] } }).expect(200);
    const res = await layout(a, { seats: { update: [{ id: s.id, x: 900, y: 900 }] } }).expect(200);
    expect(res.body.seats.find((x: { id: string }) => x.id === s.id).roomId).toBeNull();
  });

  it('accepts a request as big as the schemas allow (2000 seats ≈ 300 KB)', async () => {
    const update = Array.from({ length: 2000 }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      label: `Desk ${i}`,
      x: i,
      y: i,
      rotation: 0,
    }));
    expect(JSON.stringify({ seats: { update } }).length).toBeGreaterThan(150_000); // > 100 KB
    // parsed (no 413) — the ids just aren't on this floor
    await layout(a, { seats: { update } }).expect(404);
  });

  it('is all or nothing, and seats with history cannot be deleted', async () => {
    await api(app)
      .post('/assignments')
      .set(a.headers)
      .send({ seatId: a.seatIds[0], personId: a.personIds[0] })
      .expect(201);
    const extra = seat('X1', 10, 10);
    await layout(a, { seats: { create: [extra], delete: [a.seatIds[0]] } }).expect(409);
    expect(await owner.seat.count({ where: { id: extra.id } })).toBe(0);
    expect(await owner.seat.count({ where: { id: a.seatIds[0] } })).toBe(1);
  });

  it('cannot block an occupied seat', async () => {
    await api(app)
      .post('/assignments')
      .set(a.headers)
      .send({ seatId: a.seatIds[0], personId: a.personIds[0] })
      .expect(201);
    await layout(a, { seats: { update: [{ id: a.seatIds[0], status: 'blocked' }] } }).expect(409);
  });

  it('only touches rooms and seats of this floor and company', async () => {
    await layout(a, { seats: { update: [{ id: b.seatIds[0], x: 1 }] } }).expect(404);
    await layout(a, { rooms: { delete: [b.roomId] } }).expect(404);
    await api(app).patch(`/floors/${b.floorId}/layout`).set(a.headers).send({}).expect(404);
  });

  it('deleting a room keeps its seats', async () => {
    const res = await layout(a, { rooms: { delete: [a.roomId] } }).expect(200);
    expect(res.body.rooms).toEqual([]);
    expect(res.body.seats.every((s: { roomId: string | null }) => s.roomId === null)).toBe(true);
  });

  it('audits every change, and viewers cannot edit', async () => {
    await layout(a, { seats: { create: [seat('Q1', 1, 1)], delete: [a.seatIds[2]] } }).expect(200);
    const actions = (await owner.auditLog.findMany()).map((l) => l.action).sort();
    expect(actions).toEqual(expect.arrayContaining(['layout.seat.create', 'layout.seat.delete']));
    await layout(a, { seats: { create: [seat('Q2', 1, 1)] } }, a.viewerHeaders).expect(403);
  });

  it('renumbering can swap labels in one batch', async () => {
    const before = await owner.seat.findMany({
      where: { id: { in: a.seatIds.slice(0, 2) } },
    });
    const label = (id: string) => before.find((s) => s.id === id)!.label;
    const [x, y] = a.seatIds;
    const res = await layout(a, {
      seats: {
        update: [
          { id: x, label: label(y!) },
          { id: y, label: label(x!) },
        ],
      },
    }).expect(200);
    const after = new Map(
      res.body.seats.map((s: { id: string; label: string }) => [s.id, s.label]),
    );
    expect(after.get(x)).toBe(label(y!));
    expect(after.get(y)).toBe(label(x!));
  });

  it('keeps desk size and numbering per floor', async () => {
    const res = await api(app)
      .patch(`/floors/${a.floorId}`)
      .set(a.headers)
      .send({ deskWidth: 1.4, deskDepth: 0.7, seatNumbering: 'room' })
      .expect(200);
    expect(res.body).toMatchObject({ deskWidth: 1.4, deskDepth: 0.7, seatNumbering: 'room' });
    await api(app).patch(`/floors/${a.floorId}`).set(a.headers).send({ deskWidth: 9 }).expect(400);
  });

  it('meeting rooms, team zones, desk features and markers', async () => {
    const room = {
      id: randomUUID(),
      name: 'Rigi',
      type: 'meeting',
      polygon: square(400, 400, 100),
      capacity: 8,
      equipment: ['screen', 'video'],
    };
    const desk = { ...seat('W1', 10, 10), features: ['standing', 'window'] };
    const kitchen = { id: randomUUID(), kind: 'kitchen', x: 50, y: 60, label: 'Café' };
    await layout(a, {
      rooms: { create: [room], update: [{ id: a.roomId, team: 'Finance' }] },
      seats: { create: [desk] },
      markers: { create: [kitchen] },
    }).expect(200);
    let map = (await api(app).get(`/floors/${a.floorId}/map`).set(a.headers).expect(200)).body;
    expect(map.rooms.find((r: { id: string }) => r.id === room.id)).toMatchObject({
      capacity: 8,
      equipment: ['screen', 'video'],
    });
    expect(map.rooms.find((r: { id: string }) => r.id === a.roomId).team).toBe('Finance');
    expect(map.seats.find((s: { id: string }) => s.id === desk.id).features).toEqual([
      'standing',
      'window',
    ]);
    expect(map.markers).toEqual([{ id: kitchen.id, kind: 'kitchen', x: 50, y: 60, label: 'Café' }]);

    await layout(a, { markers: { update: [{ id: kitchen.id, x: 70 }] } }).expect(200);
    await layout(b, { markers: { delete: [kitchen.id] } }).expect(404); // other company
    await layout(a, { markers: { delete: [kitchen.id] } }).expect(200);
    map = (await api(app).get(`/floors/${a.floorId}/map`).set(a.headers).expect(200)).body;
    expect(map.markers).toEqual([]);

    await layout(a, { seats: { create: [{ ...seat('X', 1, 1), features: ['jacuzzi'] }] } }).expect(
      400,
    );
    await layout(a, { rooms: { update: [{ id: a.roomId, capacity: 0 }] } }).expect(400);
    await layout(a, {
      markers: { create: [{ id: randomUUID(), kind: 'pool', x: 1, y: 1 }] },
    }).expect(400);
  });

  it('validates input', async () => {
    await layout(a, { seats: { create: [{ ...seat('B', 1, 1), id: 'nope' }] } }).expect(400);
    await layout(a, {
      rooms: {
        create: [{ id: randomUUID(), name: 'Tri', type: 'office', polygon: [{ x: 0, y: 0 }] }],
      },
    }).expect(400);
  });
});
