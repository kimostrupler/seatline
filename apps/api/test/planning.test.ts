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

describe('space planning', () => {
  it('shows expected headcount per team against the free desks', async () => {
    await owner.person.updateMany({
      where: { id: { in: a.personIds } },
      data: { department: 'Sales' },
    });
    await api(app)
      .post('/assignments')
      .set(a.headers)
      .send({ seatId: a.seatIds[0], personId: a.personIds[0] })
      .expect(201);
    const res = await api(app)
      .put('/planning/teams')
      .set(a.headers)
      .send({ team: 'Sales', headcount: 5, byDate: '2027-03-01' })
      .expect(200);
    expect(res.body.desks).toMatchObject({ total: 3, free: 2, taken: 1 });
    expect(res.body.teams[0]).toMatchObject({
      name: 'Sales',
      people: 2,
      seated: 1,
      target: 5,
      byDate: '2027-03-01',
      needed: 4,
    });
    expect(res.body).toMatchObject({ growth: 3, short: expect.any(Number) });
    expect(res.body.short).toBeGreaterThanOrEqual(2);

    // other workspaces don't see it; viewers can't open it
    const other = (await api(app).get('/planning').set(b.headers).expect(200)).body;
    expect(other.teams.some((t: { target: number | null }) => t.target !== null)).toBe(false);
    await api(app).get('/planning').set(a.viewerHeaders).expect(403);

    // removing the plan
    const removed = await api(app)
      .put('/planning/teams')
      .set(a.headers)
      .send({ team: 'Sales', headcount: null })
      .expect(200);
    expect(removed.body.teams[0]).toMatchObject({ name: 'Sales', target: null, needed: 1 });
    expect(
      await owner.auditLog.count({ where: { tenantId: a.tenantId, action: 'team_plan.set' } }),
    ).toBe(2);
  });

  it('validates input', async () => {
    await api(app)
      .put('/planning/teams')
      .set(a.headers)
      .send({ team: '', headcount: 1 })
      .expect(400);
    await api(app)
      .put('/planning/teams')
      .set(a.headers)
      .send({ team: 'X', headcount: -1 })
      .expect(400);
    await api(app)
      .put('/planning/teams')
      .set(a.headers)
      .send({ team: 'X', headcount: 1, byDate: 'soon' })
      .expect(400);
  });
});
