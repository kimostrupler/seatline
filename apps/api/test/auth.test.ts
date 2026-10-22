import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  appDb,
  connectMicrosoft,
  createApp,
  createTenant,
  msToken,
  newMsIdentity,
  owner,
  resetDb,
  type Fixture,
} from './helpers';

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

describe('Microsoft sign-in tokens', () => {
  it('rejects bad, expired or foreign tokens', async () => {
    const tid = await connectMicrosoft(a);
    const id = newMsIdentity(tid);
    await api(app)
      .get('/me')
      .set(await msToken(id, { secret: 'x'.repeat(40) }))
      .expect(401);
    await api(app)
      .get('/me')
      .set(await msToken(id, { expiresIn: '-10s' }))
      .expect(401);
    await api(app)
      .get('/me')
      .set(await msToken(id, { audience: 'someone-else' }))
      .expect(401);
    await api(app).get('/me').set({ authorization: 'Bearer not-a-jwt' }).expect(401);
  });

  it('first sign-in creates the person with the workspace’s default role', async () => {
    const tid = await connectMicrosoft(a);
    const id = { ...newMsIdentity(tid), name: 'Nina Neu', email: 'Nina.Neu@Alpha.example' };
    const me = await api(app)
      .get('/me')
      .set(await msToken(id))
      .expect(200);
    expect(me.body).toMatchObject({
      person: { displayName: 'Nina Neu', email: 'nina.neu@alpha.example' },
      role: 'viewer',
      tenant: { id: a.tenantId },
    });

    // viewers can read but not write
    await api(app)
      .get('/buildings')
      .set(await msToken(id))
      .expect(200);
    await api(app)
      .post('/buildings')
      .set(await msToken(id))
      .send({ name: 'X' })
      .expect(403);
    expect(await owner.auditLog.count({ where: { action: 'person.first_sign_in' } })).toBe(1);
  });

  it('links an existing person by e-mail instead of creating a duplicate', async () => {
    const tid = await connectMicrosoft(a);
    const admin = await owner.person.findUniqueOrThrow({ where: { id: a.adminId } });
    const id = { ...newMsIdentity(tid), email: admin.email.toUpperCase() };
    const me = await api(app)
      .get('/me')
      .set(await msToken(id))
      .expect(200);
    expect(me.body).toMatchObject({ person: { id: a.adminId }, role: 'admin' });
    expect((await owner.person.findUniqueOrThrow({ where: { id: a.adminId } })).entraObjectId).toBe(
      id.oid,
    );
  });

  it('only sees the workspace of the Microsoft tenant in the token', async () => {
    const tidA = await connectMicrosoft(a);
    await connectMicrosoft(b);
    const buildings = await api(app)
      .get('/buildings')
      .set(await msToken(newMsIdentity(tidA)))
      .expect(200);
    expect(buildings.body.map((x: { id: string }) => x.id)).toEqual([a.buildingId]);
    await api(app)
      .get(`/buildings/${b.buildingId}`)
      .set(await msToken(newMsIdentity(tidA)))
      .expect(404);
  });

  it('no default role = only invited people; people who left are locked out', async () => {
    const tid = await connectMicrosoft(a);
    await owner.tenant.update({ where: { id: a.tenantId }, data: { defaultAppRole: null } });
    const stranger = newMsIdentity(tid);
    const res = await api(app)
      .get('/me')
      .set(await msToken(stranger))
      .expect(403);
    expect(res.body.code).toBe('no_access');

    const admin = newMsIdentity(tid);
    await owner.person.update({
      where: { id: a.adminId },
      data: { entraObjectId: admin.oid, active: false },
    });
    expect(
      (
        await api(app)
          .get('/me')
          .set(await msToken(admin))
          .expect(403)
      ).body.code,
    ).toBe('inactive');
  });
});

describe('session check and onboarding', () => {
  it('a new organisation is offered onboarding, and its first person becomes admin', async () => {
    const id = { ...newMsIdentity(), name: 'Olga Owner', email: 'olga@gamma.example' };
    const session = await api(app)
      .post('/auth/session')
      .set(await msToken(id))
      .expect(200);
    expect(session.body).toEqual({
      status: 'no_workspace',
      workspace: null,
      workspaces: [],
      role: null,
    });
    await api(app)
      .get('/me')
      .set(await msToken(id))
      .expect(403);

    const created = await api(app)
      .post('/onboarding')
      .set(await msToken(id))
      .send({ companyName: 'Gamma AG' })
      .expect(201);
    expect(created.body.workspace.name).toBe('Gamma AG');

    const after = await api(app)
      .post('/auth/session')
      .set(await msToken(id))
      .expect(200);
    expect(after.body).toMatchObject({
      status: 'ok',
      role: 'admin',
      workspace: { name: 'Gamma AG' },
    });
    // the new workspace is empty and separate
    expect(
      (
        await api(app)
          .get('/buildings')
          .set(await msToken(id))
          .expect(200)
      ).body,
    ).toEqual([]);

    // a colleague can't create a second workspace for the same organisation
    await api(app)
      .post('/onboarding')
      .set(await msToken(newMsIdentity(id.tid)))
      .send({ companyName: 'Gamma 2' })
      .expect(409);
  });

  it('onboarding needs a Microsoft sign-in (not dev headers) and a company name', async () => {
    await api(app).post('/onboarding').set(a.headers).send({ companyName: 'Nope' }).expect(401);
    await api(app)
      .post('/onboarding')
      .set(await msToken(newMsIdentity()))
      .send({ companyName: '' })
      .expect(400);
  });
});

describe('roles and settings (admins only)', () => {
  it('admins change roles; viewers and editors cannot', async () => {
    await api(app)
      .patch(`/people/${a.personIds[0]}/role`)
      .set(a.viewerHeaders)
      .send({ appRole: 'editor' })
      .expect(403);
    const res = await api(app)
      .patch(`/people/${a.personIds[0]}/role`)
      .set(a.headers)
      .send({ appRole: 'editor' })
      .expect(200);
    expect(res.body.appRole).toBe('editor');
    expect(await owner.auditLog.count({ where: { action: 'person.role' } })).toBe(1);
    await api(app).get('/people/directory').set(a.viewerHeaders).expect(403);
    const dir = await api(app).get('/people/directory').set(a.headers).expect(200);
    expect(dir.body.find((p: { id: string }) => p.id === a.personIds[0]).appRole).toBe('editor');
  });

  it('keeps at least one admin', async () => {
    await api(app)
      .patch(`/people/${a.adminId}/role`)
      .set(a.headers)
      .send({ appRole: 'viewer' })
      .expect(409);
  });

  it('roles can’t be changed in another workspace', async () => {
    await api(app)
      .patch(`/people/${b.personIds[0]}/role`)
      .set(a.headers)
      .send({ appRole: 'admin' })
      .expect(404);
  });

  it('workspace settings', async () => {
    await api(app).patch('/tenant').set(a.viewerHeaders).send({ defaultAppRole: null }).expect(403);
    const res = await api(app)
      .patch('/tenant')
      .set(a.headers)
      .send({ defaultAppRole: null })
      .expect(200);
    expect(res.body.defaultAppRole).toBeNull();
    expect((await api(app).get('/tenant').set(a.viewerHeaders).expect(200)).body.name).toBe(
      'alpha',
    );
    await api(app).patch('/tenant').set(a.headers).send({ defaultAppRole: 'owner' }).expect(400);
  });
});
