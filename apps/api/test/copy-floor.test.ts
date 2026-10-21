import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api, appDb, createApp, createTenant, owner, resetDb, type Fixture } from './helpers';

// 1×1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

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

const newFloor = (f: Fixture, body: object, headers = f.headers) =>
  api(app)
    .post('/floors')
    .set(headers)
    .send({ buildingId: f.buildingId, name: '2. OG', level: 2, ...body });

describe('new floor from an existing layout', () => {
  it('copies rooms, seats, plan and scale — but no people', async () => {
    await owner.seat.update({
      where: { id: a.seatIds[0] },
      data: { label: '1.01', status: 'blocked' },
    });
    await owner.seat.update({ where: { id: a.seatIds[1] }, data: { label: '1.02' } });
    await api(app)
      .post('/assignments')
      .set(a.headers)
      .send({ seatId: a.seatIds[1], personId: a.personIds[0] })
      .expect(201);
    await owner.floor.update({ where: { id: a.floorId }, data: { scale: 40 } });
    await api(app)
      .post(`/floors/${a.floorId}/plan`)
      .set(a.headers)
      .attach('file', PNG, 'p.png')
      .expect(201);

    const res = await newFloor(a, { copyFromFloorId: a.floorId }).expect(201);
    const floor = res.body as { id: string; planFileKey: string; scale: number; planWidth: number };
    expect(floor).toMatchObject({ scale: 40, planWidth: 1, level: 2 });
    expect(floor.planFileKey).toMatch(new RegExp(`^${a.tenantId}/floors/${floor.id}/.+\\.png$`));

    const map = (await api(app).get(`/floors/${floor.id}/map`).set(a.headers).expect(200)).body;
    expect(map.rooms).toHaveLength(1);
    expect(map.rooms[0]).toMatchObject({ name: 'Open Space' });
    expect(map.rooms[0].id).not.toBe(a.roomId);
    expect(map.seats.map((s: { label: string }) => s.label)).toEqual(['2.01', '2.02', 'A3']);
    expect(map.seats.every((s: { roomId: string }) => s.roomId === map.rooms[0].id)).toBe(true);
    expect(map.seats[0]).toMatchObject({ status: 'blocked' });
    expect(
      map.seats.every((s: { currentAssignment: unknown }) => s.currentAssignment === null),
    ).toBe(true);

    // its own copy of the plan
    const plan = await api(app)
      .get(`/floors/${floor.id}/plan`)
      .set(a.headers)
      .buffer(true)
      .expect(200);
    expect(Buffer.compare(plan.body as Buffer, PNG)).toBe(0);

    const actions = await owner.auditLog.findMany({
      where: { tenantId: a.tenantId },
      select: { action: true },
    });
    expect(actions.map((x) => x.action)).toEqual(
      expect.arrayContaining(['floor.create', 'layout.room.create', 'layout.seat.create']),
    );
  });

  it('only copies floors of the same company, and only editors can', async () => {
    await newFloor(a, { copyFromFloorId: b.floorId }).expect(404);
    await newFloor(a, { copyFromFloorId: a.floorId }, a.viewerHeaders).expect(403);
    expect(await owner.floor.count({ where: { tenantId: a.tenantId } })).toBe(1);
  });
});
