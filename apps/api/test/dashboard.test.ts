import type { INestApplication } from '@nestjs/common';
import { DEFAULT_DASHBOARD } from '@seatline/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mondayOf } from '../src/dashboard/stats.service';
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

const mine = [
  { id: 'x', type: 'trend', size: 'full' },
  { id: 'y', type: 'mySeat', size: 'small' },
];
const company = [{ id: 'c', type: 'summary', size: 'wide' }];
const get = (headers: Record<string, string>) =>
  api(app).get('/dashboard').set(headers).expect(200);

describe('dashboard layouts', () => {
  it('everyone has their own; company default; reset; built-in fallback', async () => {
    expect((await get(a.viewerHeaders)).body).toEqual({
      widgets: DEFAULT_DASHBOARD,
      source: 'builtin',
      hasCompanyDefault: false,
    });

    // viewers may arrange their own dashboard (but nothing else)
    await api(app).put('/dashboard').set(a.viewerHeaders).send({ widgets: mine }).expect(200);
    expect((await get(a.viewerHeaders)).body).toMatchObject({ widgets: mine, source: 'personal' });
    expect((await get(a.headers)).body.source).toBe('builtin');

    await api(app)
      .put('/dashboard/default')
      .set(a.viewerHeaders)
      .send({ widgets: company })
      .expect(403);
    await api(app).put('/dashboard/default').set(a.headers).send({ widgets: company }).expect(200);
    expect((await get(a.headers)).body).toMatchObject({ widgets: company, source: 'company' });
    expect((await get(a.viewerHeaders)).body.source).toBe('personal');

    await api(app).delete('/dashboard').set(a.viewerHeaders).expect(200);
    expect((await get(a.viewerHeaders)).body).toMatchObject({
      widgets: company,
      source: 'company',
    });

    // another company is untouched; every change is audited
    expect((await get(b.headers)).body.source).toBe('builtin');
    const actions = await owner.auditLog.findMany({
      where: { tenantId: a.tenantId, entityType: 'dashboard' },
      select: { action: true },
      orderBy: { createdAt: 'asc' },
    });
    expect(actions.map((x) => x.action)).toEqual([
      'dashboard.update',
      'dashboard.default',
      'dashboard.reset',
    ]);
  });

  it('validates layouts', async () => {
    const put = (widgets: unknown) => api(app).put('/dashboard').set(a.headers).send({ widgets });
    await put([{ id: 'x', type: 'nope', size: 'small' }]).expect(400);
    await put([{ id: 'x', type: 'trend', size: 'huge' }]).expect(400);
    await put([mine[0], mine[0]]).expect(400); // duplicate ids
    await put([]).expect(200); // an empty dashboard is allowed
  });
});

describe('dashboard numbers', () => {
  it('counts seat changes per week and lists what needs attention', async () => {
    await api(app)
      .post('/assignments')
      .set(a.headers)
      .send({ seatId: a.seatIds[0], personId: a.personIds[0] })
      .expect(201);
    await api(app)
      .post('/assignments/reservations')
      .set(a.headers)
      .send({ seatId: a.seatIds[2], reservedFor: 'New hire' })
      .expect(201);

    let stats = (await api(app).get('/stats').set(a.viewerHeaders).expect(200)).body;
    expect(stats.weeks).toHaveLength(12);
    expect(stats.weeks.at(-1)).toMatchObject({ assigned: 1, reserved: 1, moved: 0, freed: 0 });
    expect(stats.unseated.total).toBe(3); // admin, viewer, p2
    expect(stats.unseated.people.map((p: { id: string }) => p.id)).not.toContain(a.personIds[0]);
    expect(stats.reservations.items).toEqual([
      expect.objectContaining({ seatLabel: 'A3', reservedFor: 'New hire', floorName: '1. OG' }),
    ]);
    expect(stats.freeSeats).toEqual([
      expect.objectContaining({ floorId: a.floorId, free: 1, labels: ['A2'] }),
    ]);
    expect(stats.departments).toEqual([
      expect.objectContaining({ name: null, people: 4, seated: 1 }),
    ]);
    expect(stats.departments[0].floors).toEqual([
      expect.objectContaining({ floorId: a.floorId, count: 1 }),
    ]);

    await api(app)
      .patch(`/seats/${a.seatIds[1]}`)
      .set(a.headers)
      .send({ status: 'blocked' })
      .expect(200);
    stats = (await api(app).get('/stats').set(a.headers).expect(200)).body;
    expect(stats.blocked.items).toEqual([expect.objectContaining({ label: 'A2' })]);
    expect(stats.freeSeats).toEqual([]);

    // the other company sees none of it
    const other = (await api(app).get('/stats').set(b.headers).expect(200)).body;
    expect(other.reservations.total).toBe(0);
    expect(other.weeks.at(-1)).toMatchObject({ assigned: 0, reserved: 0 });
  });

  it('weeks start on Monday', () => {
    expect(mondayOf('2026-10-21')).toBe('2026-10-19'); // Wednesday
    expect(mondayOf('2026-10-19')).toBe('2026-10-19');
    expect(mondayOf('2026-10-25')).toBe('2026-10-19'); // Sunday
  });
});
