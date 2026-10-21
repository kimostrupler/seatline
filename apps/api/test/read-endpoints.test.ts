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

describe('GET /me', () => {
  it('returns the caller, their company and role', async () => {
    const res = await api(app).get('/me').set(a.viewerHeaders).expect(200);
    expect(res.body).toMatchObject({
      person: { id: a.viewerId },
      tenant: { id: a.tenantId, name: 'alpha' },
      role: 'viewer',
    });
  });
});

describe('GET /floors/:id/map', () => {
  it('returns floor, building, rooms and seats with their state', async () => {
    await api(app)
      .post('/assignments')
      .set(a.headers)
      .send({ seatId: a.seatIds[0], personId: a.personIds[0] })
      .expect(201);

    const { body } = await api(app).get(`/floors/${a.floorId}/map`).set(a.headers).expect(200);
    expect(body.floor).toMatchObject({ id: a.floorId, building: { id: a.buildingId } });
    expect(body.rooms.map((r: { id: string }) => r.id)).toEqual([a.roomId]);
    expect(body.seats.map((s: { occupancy: string }) => s.occupancy)).toEqual([
      'taken',
      'free',
      'free',
    ]);
    expect(body.seats[0].currentAssignment.person.id).toBe(a.personIds[0]);
  });

  it('is 404 for another company’s floor', async () => {
    await api(app).get(`/floors/${b.floorId}/map`).set(a.headers).expect(404);
  });
});

describe('GET /people', () => {
  it('searches by name and shows where people sit', async () => {
    await api(app)
      .post('/assignments')
      .set(a.headers)
      .send({ seatId: a.seatIds[1], personId: a.personIds[0] })
      .expect(201);

    const { body } = await api(app).get('/people').query({ search: 'P1' }).set(a.headers);
    expect(body).toHaveLength(1);
    expect(body[0].assignments[0].seat).toMatchObject({ id: a.seatIds[1], label: 'A2' });
  });
});
