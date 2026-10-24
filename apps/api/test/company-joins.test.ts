import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantDb } from '../src/db/tenant-db.service';
import { PeopleSyncService } from '../src/sync/people-sync.service';
import { FakeMicrosoft, type FakeUser } from './fake-microsoft';
import {
  api,
  appDb,
  connectMicrosoft,
  createApp,
  createTenant,
  msToken,
  owner,
  resetDb,
  type Fixture,
} from './helpers';

// A whole company arrives at once: a big directory, many first sign-ins at the same moment,
// sign-ins during the people sync, two colleagues creating the workspace together.

const microsoft = new FakeMicrosoft();
let app: INestApplication;
let sync: PeopleSyncService;
let a: Fixture;
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
  microsoft.pageSize = 2;
  a = await createTenant('alpha');
  tid = await connectMicrosoft(a);
});

const staff = (n: number): FakeUser => ({
  id: randomUUID(),
  displayName: `Person ${n}`,
  mail: `person.${n}@alpha.example`,
  userPrincipalName: `person.${n}@alpha.onmicrosoft.com`,
  department: ['Sales', 'IT', 'Finance', 'HR'][n % 4],
});
const session = async (who: { tid: string; oid: string; email: string; name?: string }) =>
  api(app)
    .post('/auth/session')
    .set(await msToken(who));

describe('a whole company joins', () => {
  it('a directory of 2000 people syncs in one go (Microsoft sends them in pages)', async () => {
    microsoft.pageSize = 999; // what Graph sends per page with $top=999
    microsoft.users.set(
      tid,
      Array.from({ length: 2000 }, (_, i) => staff(i)),
    );
    const started = Date.now();
    const result = await sync.syncTenant(a.tenantId);
    expect(result).toMatchObject({ ok: true, created: 2000 });
    expect(Date.now() - started).toBeLessThan(60_000); // well inside the 120 s transaction
    expect(
      await owner.person.count({ where: { tenantId: a.tenantId, entraObjectId: { not: null } } }),
    ).toBe(2000);
    // everyone got the workspace's default role, and the next night changes nothing
    expect(
      await owner.person.count({
        where: { tenantId: a.tenantId, entraObjectId: { not: null }, appRole: 'viewer' },
      }),
    ).toBe(2000);
    expect(await sync.syncTenant(a.tenantId)).toMatchObject({ ok: true, created: 0, updated: 0 });
  }, 120_000);

  it('20 colleagues signing in for the first time at the same moment all get in, once each', async () => {
    const people = Array.from({ length: 20 }, (_, i) => ({
      tid,
      oid: randomUUID(),
      email: `first.${i}@alpha.example`,
      name: `First ${i}`,
    }));
    const results = await Promise.all(people.map(session));
    for (const r of results) {
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('ok');
    }
    for (const p of people)
      expect(
        await owner.person.count({ where: { tenantId: a.tenantId, entraObjectId: p.oid } }),
      ).toBe(1);
    // the same person twice at once (two tabs) is one person too
    const twice = { tid, oid: randomUUID(), email: 'twice@alpha.example' };
    const [x, y] = await Promise.all([session(twice), session(twice)]);
    expect([x.body.status, y.body.status]).toEqual(['ok', 'ok']);
    expect(await owner.person.count({ where: { entraObjectId: twice.oid } })).toBe(1);
  });

  it('someone signing in while the people sync runs does not break the sync', async () => {
    const early = staff(1);
    microsoft.users.set(tid, [staff(0), early, staff(2)]);
    // the colleague's first sign-in lands right after the sync read the list of people
    const db = app.get(TenantDb);
    const run = db.run.bind(db);
    let signedIn = false;
    const spy = vi.spyOn(db, 'run').mockImplementation((tenantId, fn, options) =>
      run(
        tenantId,
        (tx) =>
          fn(
            new Proxy(tx, {
              get(target, key) {
                if (key !== 'person' || signedIn) return Reflect.get(target, key);
                const person = target.person;
                return new Proxy(person, {
                  get(p, k) {
                    if (k !== 'findMany') return Reflect.get(p, k);
                    return async (...args: Parameters<typeof person.findMany>) => {
                      const rows = await person.findMany(...args);
                      if (!signedIn) {
                        signedIn = true;
                        const r = await session({ tid, oid: early.id, email: early.mail! });
                        expect(r.body.status).toBe('ok');
                      }
                      return rows;
                    };
                  },
                });
              },
            }) as typeof tx,
          ),
        options,
      ),
    );
    try {
      const result = await sync.syncTenant(a.tenantId);
      expect(signedIn).toBe(true);
      expect(result.ok).toBe(true);
    } finally {
      spy.mockRestore();
    }
    // nobody twice; the colleague who signed in is there once and linked to Microsoft
    expect(
      await owner.person.count({ where: { tenantId: a.tenantId, entraObjectId: early.id } }),
    ).toBe(1);
    expect(
      await owner.person.count({ where: { tenantId: a.tenantId, entraObjectId: { not: null } } }),
    ).toBe(3);
  });

  it('two colleagues creating the workspace at the same moment end up in one', async () => {
    const newOrg = randomUUID();
    const one = { tid: newOrg, oid: randomUUID(), email: 'one@new.example', name: 'One' };
    const two = { tid: newOrg, oid: randomUUID(), email: 'two@new.example', name: 'Two' };
    const create = async (who: typeof one) =>
      api(app)
        .post('/onboarding')
        .set(await msToken(who))
        .send({ companyName: 'New AG' });
    const [r1, r2] = await Promise.all([create(one), create(two)]);
    expect([r1.status, r2.status].sort()).toEqual([201, 409]);
    expect(await owner.tenant.count({ where: { entraTenantId: newOrg } })).toBe(1);
    // the one who lost the race simply joins (as the workspace's default role)
    const late = r1.status === 409 ? one : two;
    const s = await session(late);
    expect(s.body.status).toBe('ok');
  });
});
