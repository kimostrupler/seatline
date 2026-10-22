import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api, appDb, createApp, createTenant, owner, resetDb, type Fixture } from './helpers';

let app: INestApplication;
let a: Fixture;
let b: Fixture;

beforeAll(async () => {
  process.env.OWNER_EMAILS = 'someone@else.example, Admin@Alpha.example';
  app = await createApp();
});
afterAll(async () => {
  delete process.env.OWNER_EMAILS;
  await app.close();
  await Promise.all([owner.$disconnect(), appDb.$disconnect()]);
});
beforeEach(async () => {
  await resetDb();
  a = await createTenant('alpha');
  b = await createTenant('beta');
});

describe('owner dashboard', () => {
  it('shows the operator every workspace with counts, billing state and admins', async () => {
    await api(app)
      .post('/assignments')
      .set(b.headers)
      .send({ seatId: b.seatIds[0], personId: b.personIds[0] })
      .expect(201);
    const res = await api(app).get('/owner/overview').set(a.headers).expect(200);
    expect(res.body.totals).toMatchObject({ workspaces: 2, last7Days: 2, inTrial: 2, paying: 0 });
    const beta = res.body.workspaces.find((w: { name: string }) => w.name === 'beta');
    expect(beta).toMatchObject({
      people: 4,
      seats: 3,
      seated: 1,
      signIn: 'email',
      admins: ['admin@beta.example'],
      demo: false,
    });
    expect(res.body.signupsPerDay).toHaveLength(30);
    expect(res.body.signupsPerDay.at(-1).count).toBe(2);
    // billing and Azure aren't set up in tests
    expect(res.body.stripe).toBeNull();
    expect(res.body.azure).toBeNull();
  });

  it('is a plain 404 for everyone else, admins of other workspaces included', async () => {
    for (const headers of [b.headers, a.viewerHeaders]) {
      const res = await api(app).get('/owner/overview').set(headers).expect(404);
      expect(res.body).toEqual({
        message: 'Cannot GET /owner/overview',
        error: 'Not Found',
        statusCode: 404,
      });
    }
    // the owner's address in a Microsoft workspace doesn't count (a directory can claim any address)
    await owner.tenant.update({
      where: { id: a.tenantId },
      data: { entraTenantId: '11111111-1111-4111-8111-111111111111' },
    });
    await api(app).get('/owner/overview').set(a.headers).expect(404);
    // and it looks exactly like a page that doesn't exist
    const missing = await api(app).get('/owner/nothing').set(b.headers).expect(404);
    expect(missing.body).toEqual({
      message: 'Cannot GET /owner/nothing',
      error: 'Not Found',
      statusCode: 404,
    });
  });
});
