import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoService } from '../src/demo/demo.service';
import { MailService } from '../src/mail/mail.service';
import { StorageService } from '../src/storage/storage.service';
import { api, appDb, createApp, createTenant, owner, resetDb, type Fixture } from './helpers';
import { clearMails, sentMails } from './mail';

let app: INestApplication;
let a: Fixture;

beforeAll(async () => {
  app = await createApp();
});
afterAll(async () => {
  await app.close();
  await Promise.all([owner.$disconnect(), appDb.$disconnect()]);
});
beforeEach(async () => {
  await resetDb();
  await clearMails();
  a = await createTenant('alpha');
});

async function openDemo(language = 'de') {
  const res = await api(app).post('/auth/demo').send({ language }).expect(200);
  const admin = await owner.person.findFirstOrThrow({ where: { email: res.body.email } });
  return {
    ...(res.body as { tenantId: string; email: string }),
    headers: { 'x-tenant-id': res.body.tenantId, 'x-user-id': admin.id },
  };
}

describe('demo workspaces', () => {
  it('a visitor gets a sample office to try, as its admin', async () => {
    const demo = await openDemo();
    expect(demo.email).toMatch(/@demo\.seatline\.invalid$/);
    const me = (await api(app).get('/me').set(demo.headers).expect(200)).body;
    expect(me).toMatchObject({
      role: 'admin',
      tenant: { name: 'Muster AG', isDemo: true },
      billing: { state: 'off' },
    });
    const [building] = (await api(app).get('/buildings').set(demo.headers).expect(200)).body;
    const floors = (
      await api(app).get(`/floors?buildingId=${building.id}`).set(demo.headers).expect(200)
    ).body;
    expect(floors.map((f: { name: string }) => f.name)).toEqual(['1. OG', '2. OG']);
    const map = (await api(app).get(`/floors/${floors[0].id}/map`).set(demo.headers).expect(200))
      .body;
    expect(
      map.rooms.some((r: { type: string; capacity: number }) => r.type === 'meeting' && r.capacity),
    ).toBe(true);
    expect(map.markers.length).toBeGreaterThan(0);
    expect(map.seats.some((s: { occupancy: string }) => s.occupancy === 'taken')).toBe(true);
    expect(map.seats.some((s: { occupancy: string }) => s.occupancy === 'reserved')).toBe(true);
    // there's history and a draft move plan without problems
    const activity = (await api(app).get('/activity').set(demo.headers).expect(200)).body;
    expect(activity.items.some((e: { action: string }) => e.action === 'assignment.move')).toBe(
      true,
    );
    const plans = (await api(app).get('/move-plans').set(demo.headers).expect(200)).body;
    const plan = (await api(app).get(`/move-plans/${plans[0].id}`).set(demo.headers).expect(200))
      .body;
    expect(plan.items.length).toBeGreaterThan(0);
    expect(plan.problems).toEqual([]);
    // visitors can change everything — and nobody gets e-mails
    await api(app).post(`/move-plans/${plan.id}/apply`).set(demo.headers).expect(201);
    expect(await sentMails()).toEqual([]);
    // other workspaces can't see it
    await api(app).get(`/floors/${floors[0].id}/map`).set(a.headers).expect(404);
  });

  it('is deleted after a day, with its history; real workspaces stay', async () => {
    const old = await openDemo('en');
    const fresh = await openDemo('fr');
    await api(app)
      .post('/assignments')
      .set(a.headers)
      .send({ seatId: a.seatIds[0], personId: a.personIds[0] })
      .expect(201);
    await owner.$executeRaw`UPDATE tenants SET created_at = now() - interval '2 days' WHERE id = ${old.tenantId}::uuid`;
    const deleted = vi.spyOn(app.get(StorageService), 'deletePrefix');
    expect(await app.get(DemoService).purge()).toBe(1);
    expect(deleted.mock.calls).toEqual([[`${old.tenantId}/`]]); // its plan images go too
    deleted.mockRestore();
    expect(await owner.tenant.findUnique({ where: { id: old.tenantId } })).toBeNull();
    expect(await owner.seatAssignment.count({ where: { tenantId: old.tenantId } })).toBe(0);
    expect(await owner.person.count({ where: { tenantId: old.tenantId } })).toBe(0);
    expect(await owner.tenant.findUnique({ where: { id: fresh.tenantId } })).not.toBeNull();
    expect(await owner.seatAssignment.count({ where: { tenantId: a.tenantId } })).toBe(1);
  });

  it('never e-mails .invalid addresses', async () => {
    const mail = app.get(MailService);
    await mail.send({ to: 'x@demo.seatline.invalid', subject: 's', text: 't' });
    await mail.send({ to: 'x@demo.seatline.invalid, it@alpha.example', subject: 's', text: 't' });
    expect((await sentMails()).map((m) => m.to)).toEqual(['it@alpha.example']);
  });
});
