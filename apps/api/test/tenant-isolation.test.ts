import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  appDb,
  asApp,
  createApp,
  createTenant,
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

describe('tenant isolation — through the API', () => {
  it('lists only the caller’s own data', async () => {
    const res = await api(app).get('/buildings').set(a.headers).expect(200);
    expect(res.body.map((x: { id: string }) => x.id)).toEqual([a.buildingId]);

    const seats = await api(app).get('/seats').query({ floorId: b.floorId }).set(a.headers);
    expect(seats.body).toEqual([]);
  });

  it('returns 404 for another tenant’s records', async () => {
    await api(app).get(`/buildings/${b.buildingId}`).set(a.headers).expect(404);
    await api(app).get(`/seats/${b.seatIds[0]}`).set(a.headers).expect(404);
    await api(app).get(`/people/${b.personIds[0]}/history`).set(a.headers).expect(404);
  });

  it('cannot write into another tenant', async () => {
    await api(app)
      .post('/floors')
      .set(a.headers)
      .send({ buildingId: b.buildingId, name: 'Sneaky', level: 9 })
      .expect(404);
    await api(app)
      .post('/assignments')
      .set(a.headers)
      .send({ seatId: a.seatIds[0], personId: b.personIds[0] })
      .expect(404);
    await api(app).patch(`/seats/${b.seatIds[0]}`).set(a.headers).send({ label: 'X' }).expect(404);
    await api(app).delete(`/buildings/${b.buildingId}`).set(a.headers).expect(404);
    expect(await owner.floor.count({ where: { tenantId: b.tenantId } })).toBe(1);
  });

  it('rejects a user id from another tenant', async () => {
    await api(app)
      .get('/buildings')
      .set({ 'x-tenant-id': a.tenantId, 'x-user-id': b.adminId })
      .expect(401);
  });

  it('rejects requests without identity', async () => {
    await api(app).get('/buildings').expect(401);
    await api(app).get('/health').expect(200);
  });
});

describe('tenant isolation — Row-Level Security (database safety net)', () => {
  it('even an unfiltered query only sees the current tenant', async () => {
    const rows = await asApp(
      a.tenantId,
      (tx) => tx.$queryRaw<{ tenant_id: string }[]>`SELECT tenant_id FROM seats`,
    );
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => r.tenant_id))).toEqual(new Set([a.tenantId]));
  });

  it('sees nothing when no tenant is set', async () => {
    const counts = await asApp(null, async (tx) => [
      await tx.tenant.count(),
      await tx.person.count(),
      await tx.seat.count(),
    ]);
    expect(counts).toEqual([0, 0, 0]);
  });

  it('cannot insert rows for another tenant', async () => {
    await expect(
      asApp(a.tenantId, (tx) =>
        tx.building.create({ data: { tenantId: b.tenantId, name: 'Trojan' } }),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('cannot move rows into another tenant', async () => {
    const changed = await asApp(
      a.tenantId,
      (tx) =>
        tx.$executeRaw`UPDATE buildings SET name = 'hijacked' WHERE tenant_id = ${b.tenantId}::uuid`,
    );
    expect(changed).toBe(0);
    await expect(
      asApp(
        a.tenantId,
        (tx) =>
          tx.$executeRaw`UPDATE buildings SET tenant_id = ${b.tenantId}::uuid WHERE id = ${a.buildingId}::uuid`,
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('cannot reference another tenant’s rows, even by id', async () => {
    // Foreign-key checks ignore RLS — the (tenant_id, id) keys catch this.
    await expect(
      asApp(
        a.tenantId,
        (tx) =>
          tx.$executeRaw`INSERT INTO seats (id, tenant_id, floor_id, label, x, y, updated_at)
          VALUES (gen_random_uuid(), ${a.tenantId}::uuid, ${b.floorId}::uuid, 'X', 0, 0, now())`,
      ),
    ).rejects.toThrow(/foreign key/i);
  });
});
