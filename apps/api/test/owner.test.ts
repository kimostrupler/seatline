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
    await api(app).get('/owner/check').set(a.headers).expect(204);
    const res = await api(app).get('/owner/overview').set(a.headers).expect(200);
    // alpha is the operator's own workspace: free, so not counted as a trial
    expect(res.body.totals).toMatchObject({ workspaces: 2, last7Days: 2, inTrial: 1, paying: 0 });
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
    // live usage: database size (and its biggest tables) and stored files
    expect(res.body.usage.database.bytes).toBeGreaterThan(0);
    expect(res.body.usage.database.diskBytes).toBe(32 * 1024 ** 3);
    expect(res.body.usage.database.tables.length).toBeGreaterThan(0);
    expect(res.body.usage.database.tables[0]).toMatchObject({
      name: expect.any(String),
      bytes: expect.any(Number),
    });
    expect(res.body.usage.files).toMatchObject({
      bytes: expect.any(Number),
      files: expect.any(Number),
    });
  });

  it('is a plain 404 for everyone else, admins of other workspaces included', async () => {
    for (const headers of [b.headers, a.viewerHeaders]) {
      await api(app).get('/owner/check').set(headers).expect(404);
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

  it('nobody can add the operator’s address to their list (it would make them the operator)', async () => {
    const add = (email: string) =>
      api(app).post('/people').set(b.headers).send({ displayName: 'Someone', email });
    const refused = await add('admin@ALPHA.example').expect(409);
    expect(refused.body.code).toBe('reserved_email');
    await add('someone@else.example').expect(409);
    const ok = await add('fine@beta.example').expect(201);
    await api(app)
      .patch(`/people/${ok.body.id}`)
      .set(b.headers)
      .send({ email: 'admin@alpha.example' })
      .expect(409);
    await api(app)
      .post('/people/import')
      .set(b.headers)
      .send({ people: [{ displayName: 'Op', email: 'admin@alpha.example' }] })
      .expect(409);
    const read = await api(app)
      .post('/people/import/read')
      .set(b.headers)
      .attach('file', Buffer.from('Name;E-Mail\nOp;admin@alpha.example\n'), 'p.csv')
      .expect(200);
    expect(read.body.rows[0]).toMatchObject({ status: 'invalid', problem: 'bad_email' });
    // beta is still an ordinary trial workspace
    const res = await api(app).get('/owner/overview').set(a.headers).expect(200);
    expect(res.body.workspaces.find((w: { name: string }) => w.name === 'beta').owner).toBe(false);
  });

  it('the operator stops the onboarding tips of a workspace whose admin replied "stop"', async () => {
    await owner.tenant.update({ where: { id: b.tenantId }, data: { onboardingSent: 1 } });
    // only the operator: beta's own admin gets the same 404 as for a missing page
    await api(app).post(`/owner/workspaces/${b.tenantId}/stop-tips`).set(b.headers).expect(404);
    await api(app).post(`/owner/workspaces/${b.tenantId}/stop-tips`).set(a.headers).expect(204);
    const tenant = await owner.tenant.findUniqueOrThrow({ where: { id: b.tenantId } });
    expect(tenant.onboardingSent).toBe(7);
    const entry = await owner.auditLog.findFirst({
      where: { tenantId: a.tenantId, action: 'owner.workspace.stop_tips' },
    });
    expect(entry?.entityId).toBe(b.tenantId);
  });

  it('the operator deletes a workspace for support, with every row of it', async () => {
    await api(app)
      .post('/assignments')
      .set(b.headers)
      .send({ seatId: b.seatIds[0], personId: b.personIds[0] })
      .expect(201);
    const del = (id: string, name: string, headers = a.headers) =>
      api(app).delete(`/owner/workspaces/${id}`).set(headers).send({ name });

    await del(b.tenantId, 'beta', b.headers).expect(404); // only the operator
    await del(b.tenantId, 'gamma').expect(400); // the typed name must match
    await del(a.tenantId, 'alpha').expect(409); // never the own workspace
    await owner.tenant.update({
      where: { id: b.tenantId },
      data: { stripeSubscriptionId: 'sub_1', billingStatus: 'active' },
    });
    const paying = await del(b.tenantId, 'beta').expect(409);
    expect(paying.body.code).toBe('subscribed');
    await owner.tenant.update({ where: { id: b.tenantId }, data: { billingStatus: 'canceled' } });

    await del(b.tenantId, 'beta').expect(204);
    expect(await owner.tenant.count({ where: { id: b.tenantId } })).toBe(0);
    expect(await owner.person.count({ where: { tenantId: b.tenantId } })).toBe(0);
    expect(await owner.seatAssignment.count({ where: { tenantId: b.tenantId } })).toBe(0);
    expect(await owner.auditLog.count({ where: { tenantId: b.tenantId } })).toBe(0);
    const logged = await owner.auditLog.findFirst({
      where: { tenantId: a.tenantId, action: 'owner.workspace.delete' },
    });
    expect(logged).toMatchObject({ actorId: a.adminId, entityId: b.tenantId });

    // the operator's own workspace is free, not a trial
    const res = await api(app).get('/owner/overview').set(a.headers).expect(200);
    expect(res.body.workspaces).toHaveLength(1);
    expect(res.body.workspaces[0]).toMatchObject({ name: 'alpha', owner: true });
    expect(res.body.totals.inTrial).toBe(0);
  });
});
