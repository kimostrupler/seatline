import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { addDays } from '../src/bookings/bookings.service';
import { zurichToday } from '../src/moves/moves.service';
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

const today = () => zurichToday();
const share = (f: Fixture, seatId: string, shared = true) =>
  api(app).patch(`/seats/${seatId}`).set(f.headers).send({ shared });
const book = (headers: Record<string, string>, seatId: string, day: string, personId?: string) =>
  api(app)
    .post('/bookings')
    .set(headers)
    .send({ seatId, day, ...(personId && { personId }) });

describe('desk booking', () => {
  it('everyone books a shared desk for a day; the map shows it; one per desk and per person', async () => {
    const [desk, other] = a.seatIds;
    await share(a, desk).expect(200);
    await share(a, other).expect(200);
    const day = addDays(today(), 1);

    // viewers book for themselves
    const res = await book(a.viewerHeaders, desk, day).expect(201);
    expect(res.body).toMatchObject({ seatId: desk, personId: a.viewerId, day });
    const onMap = await api(app)
      .get(`/bookings?floorId=${a.floorId}&day=${day}`)
      .set(a.headers)
      .expect(200);
    expect(onMap.body).toEqual([
      expect.objectContaining({
        seatId: desk,
        personId: a.viewerId,
        person: { displayName: 'alpha viewer' },
      }),
    ]);
    // the same desk that day, or a second desk for the same person: refused
    await book(a.headers, desk, day)
      .expect(409)
      .expect((r) => expect(r.body.code).toBe('desk_booked'));
    await book(a.viewerHeaders, other, day)
      .expect(409)
      .expect((r) => expect(r.body.code).toBe('already_booked'));
    // another day is fine
    await book(a.viewerHeaders, desk, addDays(day, 1)).expect(201);
    const mine = await api(app).get('/bookings/mine').set(a.viewerHeaders).expect(200);
    expect(mine.body.map((m: { day: string }) => m.day)).toEqual([day, addDays(day, 1)]);
    expect(mine.body[0].seat.floor.id).toBe(a.floorId);

    const log = await owner.auditLog.findMany({
      where: { tenantId: a.tenantId, action: 'booking.create' },
    });
    expect(log).toHaveLength(2);
  });

  it('two people grabbing the same desk at once: exactly one gets it', async () => {
    const [desk] = a.seatIds;
    await share(a, desk).expect(200);
    const day = addDays(today(), 1);
    const results = await Promise.all([
      book(a.headers, desk, day),
      book(a.viewerHeaders, desk, day),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await owner.deskBooking.count({ where: { seatId: desk, cancelledAt: null } })).toBe(1);
  });

  it('only shared, active desks, from today up to 4 weeks ahead', async () => {
    const [desk, notShared] = a.seatIds;
    await share(a, desk).expect(200);
    await book(a.headers, notShared, today())
      .expect(409)
      .expect((r) => expect(r.body.code).toBe('not_bookable'));
    await book(a.headers, desk, addDays(today(), -1))
      .expect(409)
      .expect((r) => expect(r.body.code).toBe('day_out_of_range'));
    await book(a.headers, desk, addDays(today(), 29)).expect(409);
    await book(a.headers, desk, addDays(today(), 28)).expect(201);
    await book(a.headers, desk, 'tomorrow').expect(400);
  });

  it('viewers book only for themselves; editors and admins for others', async () => {
    const [desk] = a.seatIds;
    await share(a, desk).expect(200);
    const day = addDays(today(), 2);
    await book(a.viewerHeaders, desk, day, a.personIds[0]).expect(403);
    await book(a.headers, desk, day, a.personIds[0])
      .expect(201)
      .expect((r) => expect(r.body.personId).toBe(a.personIds[0]));
  });

  it('cancelling keeps the booking; only your own (or as editor); the desk is free again', async () => {
    const [desk] = a.seatIds;
    await share(a, desk).expect(200);
    const day = addDays(today(), 1);
    const booked = (await book(a.headers, desk, day).expect(201)).body;
    await api(app).post(`/bookings/${booked.id}/cancel`).set(a.viewerHeaders).expect(403);
    await api(app).post(`/bookings/${booked.id}/cancel`).set(a.headers).expect(201);
    await api(app).post(`/bookings/${booked.id}/cancel`).set(a.headers).expect(409);
    expect(
      await owner.deskBooking.count({ where: { id: booked.id, cancelledAt: { not: null } } }),
    ).toBe(1);
    // free again: someone else can take it (undo = book again)
    await book(a.viewerHeaders, desk, day).expect(201);
    // the app can't delete bookings (history)
    await expect(appDb.$executeRawUnsafe(`DELETE FROM desk_bookings`)).rejects.toThrow();
  });

  it('a shared desk has nobody for good; booked desks keep their bookings safe', async () => {
    const [desk, taken] = a.seatIds;
    await api(app)
      .post('/assignments')
      .set(a.headers)
      .send({ seatId: taken, personId: a.personIds[0] })
      .expect(201);
    await share(a, taken).expect(409);
    await share(a, desk).expect(200);
    await api(app)
      .post('/assignments')
      .set(a.headers)
      .send({ seatId: desk, personId: a.personIds[1] })
      .expect(409)
      .expect((r) => expect(r.body.code).toBe('shared_desk'));
    await book(a.headers, desk, addDays(today(), 3)).expect(201);
    // can't stop sharing, block or delete it while it's booked
    await share(a, desk, false)
      .expect(409)
      .expect((r) => expect(r.body.code).toBe('has_bookings'));
    await api(app).patch(`/seats/${desk}`).set(a.headers).send({ status: 'blocked' }).expect(409);
    await api(app).delete(`/seats/${desk}`).set(a.headers).expect(409);
  });

  it('people who leave give up their coming bookings', async () => {
    const [desk] = a.seatIds;
    await share(a, desk).expect(200);
    const person = a.personIds[0];
    await book(a.headers, desk, addDays(today(), 1), person).expect(201);
    await api(app)
      .patch(`/people/${person}/active`)
      .set(a.headers)
      .send({ active: false })
      .expect(200);
    expect(await owner.deskBooking.count({ where: { personId: person, cancelledAt: null } })).toBe(
      0,
    );
  });

  it('tenant B sees and books nothing of tenant A', async () => {
    const [desk] = a.seatIds;
    await share(a, desk).expect(200);
    const day = addDays(today(), 1);
    await book(a.headers, desk, day).expect(201);
    await book(b.headers, desk, day).expect(404);
    const seen = await api(app)
      .get(`/bookings?floorId=${a.floorId}&day=${day}`)
      .set(b.headers)
      .expect(200);
    expect(seen.body).toEqual([]);
  });
});
