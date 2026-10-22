import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { zurichMidnight } from '../src/activity/activity.service';
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
  // three changes in tenant A: assign, move, rename a seat
  await api(app)
    .post('/assignments')
    .set(a.headers)
    .send({ seatId: a.seatIds[0], personId: a.personIds[0] })
    .expect(201);
  await api(app)
    .post('/assignments')
    .set(a.headers)
    .send({ seatId: a.seatIds[1], personId: a.personIds[0] })
    .expect(201);
  await api(app).patch(`/seats/${a.seatIds[2]}`).set(a.headers).send({ label: 'Z9' }).expect(200);
});

const activity = (f: Fixture, query = '', headers = f.headers) =>
  api(app).get(`/activity${query}`).set(headers);

describe('activity (change history)', () => {
  it('lists changes newest first, with the names they mention', async () => {
    const res = await activity(a).expect(200);
    expect(res.body.items.map((e: { action: string }) => e.action)).toEqual([
      'seat.update',
      'assignment.move',
      'assignment.create',
    ]);
    const { refs } = res.body;
    expect(refs.people[a.adminId]).toEqual({ displayName: 'alpha admin' });
    expect(refs.people[a.personIds[0]]).toEqual({ displayName: 'alpha p1' });
    expect(refs.seats[a.seatIds[0]]).toMatchObject({ label: 'A1', floorId: a.floorId });
    expect(refs.floors[a.floorId]).toMatchObject({ name: '1. OG', buildingId: a.buildingId });
    expect(refs.buildings[a.buildingId]).toEqual({ name: 'alpha HQ' });
  });

  it('filters by kind, person and day; pages with a cursor', async () => {
    const seating = await activity(a, '?kind=seating').expect(200);
    expect(seating.body.items).toHaveLength(2);

    const p1 = await activity(a, `?personId=${a.personIds[0]}`).expect(200);
    expect(p1.body.items).toHaveLength(2);
    const p2 = await activity(a, `?personId=${a.personIds[1]}`).expect(200);
    expect(p2.body.items).toHaveLength(0);

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Zurich' });
    expect((await activity(a, `?from=${today}&to=${today}`).expect(200)).body.items).toHaveLength(
      3,
    );
    expect((await activity(a, '?to=2020-01-01').expect(200)).body.items).toHaveLength(0);

    const first = await activity(a, '?limit=2').expect(200);
    expect(first.body.items).toHaveLength(2);
    const next = await activity(a, `?limit=2&cursor=${first.body.nextCursor}`).expect(200);
    expect(next.body.items.map((e: { action: string }) => e.action)).toEqual(['assignment.create']);
    expect(next.body.nextCursor).toBeNull();
  });

  it('searches names, labels and old values; other companies never match', async () => {
    const actions = async (text: string) =>
      (await activity(a, `?q=${encodeURIComponent(text)}`).expect(200)).body.items.map(
        (e: { action: string }) => e.action,
      );
    // a person's current name finds the changes about them
    expect(await actions('ALPHA P1')).toEqual(['assignment.move', 'assignment.create']);
    // the old label (only in the log) and the new one both find the rename
    expect(await actions('A3')).toEqual(['seat.update']);
    expect(await actions('z9')).toEqual(['seat.update']);
    // a seat finds the assignments that mention it
    expect(await actions('A1')).toEqual(['assignment.move', 'assignment.create']);
    // whoever made the change
    expect(await actions('alpha admin')).toHaveLength(3);
    // combined with other filters; LIKE wildcards are plain text
    expect(await activity(a, '?q=A1&kind=layout').expect(200)).toMatchObject({
      body: { items: [] },
    });
    expect(await actions('%')).toEqual([]);
    expect(await actions('beta')).toEqual([]);
    await activity(a, `?q=${'x'.repeat(101)}`).expect(400);
  });

  it('is only for editors and admins, and only shows the own company', async () => {
    await activity(a, '', a.viewerHeaders).expect(403);
    expect((await activity(b).expect(200)).body.items).toHaveLength(0);
    await activity(a, '?from=yesterday').expect(400);
  });

  it('days are Swiss calendar days', () => {
    expect(zurichMidnight('2026-07-01').toISOString()).toBe('2026-06-30T22:00:00.000Z');
    expect(zurichMidnight('2026-01-15').toISOString()).toBe('2026-01-14T23:00:00.000Z');
  });
});

describe('overview', () => {
  it('counts free, taken, reserved and blocked seats per floor, for everyone', async () => {
    await api(app)
      .post('/assignments/reservations')
      .set(a.headers)
      .send({ seatId: a.seatIds[2], reservedFor: 'New hire' })
      .expect(201);
    const res = await api(app).get('/overview').set(a.viewerHeaders).expect(200);
    const counts = { seats: 3, free: 1, taken: 1, reserved: 1, blocked: 0 };
    expect(res.body).toMatchObject(counts);
    expect(res.body.buildings).toHaveLength(1);
    expect(res.body.buildings[0]).toMatchObject({ name: 'alpha HQ', ...counts });
    expect(res.body.buildings[0].floors[0]).toMatchObject({ name: '1. OG', ...counts });
  });
});
