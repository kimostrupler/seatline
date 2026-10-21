import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PeopleSyncService } from '../src/sync/people-sync.service';
import { FakeMicrosoft, type FakeUser } from './fake-microsoft';
import {
  api,
  appDb,
  connectMicrosoft,
  createApp,
  createTenant,
  owner,
  resetDb,
  type Fixture,
} from './helpers';

const microsoft = new FakeMicrosoft();
let app: INestApplication;
let sync: PeopleSyncService;
let a: Fixture;
let b: Fixture;
let tid: string;

beforeAll(async () => {
  await microsoft.start();
  process.env.ENTRA_LOGIN_URL = microsoft.url;
  process.env.GRAPH_URL = microsoft.url;
  process.env.ENTRA_CLIENT_ID = 'test-client';
  process.env.ENTRA_CLIENT_SECRET = 'test-secret';
  app = await createApp();
  sync = app.get(PeopleSyncService);
});
afterAll(async () => {
  await app.close();
  await microsoft.stop();
  await Promise.all([owner.$disconnect(), appDb.$disconnect()]);
});
beforeEach(async () => {
  await resetDb();
  microsoft.tokenError = null;
  microsoft.graphStatus = 200;
  a = await createTenant('alpha');
  b = await createTenant('beta');
  tid = await connectMicrosoft(a);
});

const user = (name: string, extra: Partial<FakeUser> = {}): FakeUser => ({
  id: randomUUID(),
  displayName: name,
  mail: `${name.toLowerCase().replace(/\s+/g, '.')}@alpha.example`,
  userPrincipalName: `${name.toLowerCase().replace(/\s+/g, '.')}@alpha.onmicrosoft.com`,
  ...extra,
});

describe('people sync from Microsoft 365', () => {
  it('links, creates, updates and deactivates people; frees seats of leavers', async () => {
    // p1 sits at A1 and has been disabled in Microsoft 365
    await api(app)
      .post('/assignments')
      .set(a.headers)
      .send({ seatId: a.seatIds[0], personId: a.personIds[0] })
      .expect(201);
    const p1 = await owner.person.findUniqueOrThrow({ where: { id: a.personIds[0] } });
    const admin = await owner.person.findUniqueOrThrow({ where: { id: a.adminId } });

    microsoft.users.set(tid, [
      user('Admin Renamed', { mail: admin.email, department: 'IT', jobTitle: 'Head of IT' }),
      user('P One', { mail: p1.email, accountEnabled: false }),
      user('Neu Person', { department: 'Sales' }),
      user('Guest User', { userType: 'Guest' }),
      user('Zweite Neue'),
    ]);

    const result = await sync.syncTenant(a.tenantId);
    expect(result).toMatchObject({
      ok: true,
      created: 2,
      updated: 2,
      deactivated: 1,
      seatsFreed: 1,
    });

    const people = await owner.person.findMany({ where: { tenantId: a.tenantId } });
    const byName = new Map(people.map((p) => [p.displayName, p]));
    expect(byName.get('Admin Renamed')).toMatchObject({
      id: a.adminId,
      department: 'IT',
      appRole: 'admin',
    }); // role kept
    expect(byName.get('Neu Person')).toMatchObject({
      appRole: 'viewer',
      department: 'Sales',
      active: true,
    });
    expect(byName.has('Guest User')).toBe(false);
    expect(byName.get('P One')).toMatchObject({ id: a.personIds[0], active: false });

    // the seat is free again, and the history shows p1 sat there until now
    const history = await owner.seatAssignment.findMany({ where: { seatId: a.seatIds[0] } });
    expect(history).toHaveLength(1);
    expect(history[0]!.endAt).not.toBeNull();

    const tenant = await owner.tenant.findUniqueOrThrow({ where: { id: a.tenantId } });
    expect(tenant.peopleSyncedAt).not.toBeNull();
    expect(tenant.peopleSyncStatus).toMatchObject({ ok: true, created: 2 });
    expect(
      await owner.auditLog.count({ where: { tenantId: a.tenantId, action: 'people.sync' } }),
    ).toBe(1);

    // other workspaces are untouched
    expect(await owner.person.count({ where: { tenantId: b.tenantId } })).toBe(4);
  });

  it('people deleted from Microsoft 365 become inactive; a second run changes nothing', async () => {
    const leaver = user('Leaver');
    microsoft.users.set(tid, [user('Stayer'), leaver]);
    await sync.syncTenant(a.tenantId);
    microsoft.users.set(
      tid,
      microsoft.users.get(tid)!.filter((u) => u.id !== leaver.id),
    );

    expect(await sync.syncTenant(a.tenantId)).toMatchObject({
      ok: true,
      created: 0,
      updated: 0,
      deactivated: 1,
    });
    expect(await sync.syncTenant(a.tenantId)).toMatchObject({
      ok: true,
      created: 0,
      updated: 0,
      deactivated: 0,
    });
    expect(
      (await owner.person.findFirstOrThrow({ where: { entraObjectId: leaver.id } })).active,
    ).toBe(false);
  });

  it('reports missing admin consent instead of failing silently', async () => {
    microsoft.tokenError = {
      status: 400,
      body: {
        error: 'invalid_client',
        error_description: 'AADSTS7000229: The client application is missing service principal',
      },
    };
    expect(await sync.syncTenant(a.tenantId)).toMatchObject({
      ok: false,
      error: 'consent_required',
    });

    microsoft.tokenError = null;
    microsoft.graphStatus = 403;
    expect(await sync.syncTenant(a.tenantId)).toMatchObject({
      ok: false,
      error: 'consent_required',
    });
    const tenant = await owner.tenant.findUniqueOrThrow({ where: { id: a.tenantId } });
    expect(tenant.peopleSyncStatus).toMatchObject({ ok: false, error: 'consent_required' });
    expect(tenant.peopleSyncedAt).toBeNull();
  });

  it('"Sync now" runs in the background (admins only)', async () => {
    microsoft.users.set(tid, [user('Queued Person')]);
    await api(app).post('/people/sync').set(a.viewerHeaders).expect(403);
    await api(app).post('/people/sync').set(b.headers).expect(409); // not connected to Microsoft
    await api(app).post('/people/sync').set(a.headers).expect(202);

    await expect
      .poll(async () => (await api(app).get('/tenant').set(a.headers)).body.peopleSyncStatus?.ok, {
        timeout: 15_000,
      })
      .toBe(true);
    expect(
      await owner.person.count({ where: { tenantId: a.tenantId, displayName: 'Queued Person' } }),
    ).toBe(1);
  });
});
