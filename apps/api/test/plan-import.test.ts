import type { INestApplication } from '@nestjs/common';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { StorageService } from '../src/storage/storage.service';
import { api, appDb, createApp, createTenant, owner, resetDb, type Fixture } from './helpers';

// a 1×1 PNG with its header saying 800 × 400 (only the header is checked)
const png = (w: number, h: number) => {
  const b = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  );
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return b;
};

const DRAFT = {
  source: 'dxf',
  width: 800,
  height: 400,
  scale: 40,
  rooms: [
    {
      name: '1.01 Büro',
      type: 'office',
      polygon: [
        { x: 10, y: 10 },
        { x: 250, y: 10 },
        { x: 250, y: 370 },
        { x: 10, y: 370 },
      ],
    },
  ],
  seats: [{ x: 120, y: 200, rotation: 90, label: null }],
  warnings: [],
};

/** Stands in for apps/plan-engine. */
let answer: { status: number; body: unknown } = { status: 200, body: {} };
let received: { token?: string; bytes: number }[] = [];
let engine: http.Server;

let app: INestApplication;
let a: Fixture;
let b: Fixture;

beforeAll(async () => {
  engine = http.createServer((req, res) => {
    let bytes = 0;
    req.on('data', (c: Buffer) => (bytes += c.length));
    req.on('end', () => {
      received.push({ token: req.headers['x-internal-token'] as string | undefined, bytes });
      res.writeHead(answer.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(answer.body));
    });
  });
  await new Promise<void>((resolve) => engine.listen(0, resolve));
  process.env.PLAN_ENGINE_URL = `http://localhost:${(engine.address() as AddressInfo).port}`;
  process.env.PLAN_ENGINE_TOKEN = 'engine-secret';
  app = await createApp();
});
afterAll(async () => {
  delete process.env.PLAN_ENGINE_URL;
  delete process.env.PLAN_ENGINE_TOKEN;
  await app.close();
  engine.closeAllConnections();
  engine.close();
  await Promise.all([owner.$disconnect(), appDb.$disconnect()]);
});
beforeEach(async () => {
  await resetDb();
  a = await createTenant('alpha');
  b = await createTenant('beta');
  received = [];
  answer = { status: 200, body: { ...DRAFT, image: png(800, 400).toString('base64') } };
});

const importPlan = (f: Fixture, headers = f.headers) =>
  api(app)
    .post(`/floors/${f.floorId}/imports`)
    .set(headers)
    .attach('file', Buffer.from('  0\nSECTION\n  2\nHEADER\n'), 'office.dxf');

describe('plan import', () => {
  it('suggests rooms and desks, then the image becomes the floor plan with its scale', async () => {
    const res = await importPlan(a).expect(201);
    expect(res.body).toMatchObject({ ...DRAFT, importId: expect.any(String) });
    expect(res.body.image).toBeUndefined();
    expect(received).toEqual([{ token: 'engine-secret', bytes: expect.any(Number) }]);

    const image = await api(app)
      .get(`/floors/${a.floorId}/imports/${res.body.importId}/image`)
      .set(a.headers)
      .buffer(true)
      .expect(200);
    expect(image.headers['content-type']).toBe('image/png');

    const floor = await api(app)
      .post(`/floors/${a.floorId}/imports/${res.body.importId}/apply`)
      .set(a.headers)
      .send({ scale: 40 })
      .expect(201);
    expect(floor.body).toMatchObject({ planWidth: 800, planHeight: 400, scale: 40 });
    const [log] = await owner.auditLog.findMany({ where: { action: 'floor.plan.import' } });
    expect(log?.after).toMatchObject({ source: 'import', scale: 40 });
    // used up: the import is gone
    await api(app)
      .post(`/floors/${a.floorId}/imports/${res.body.importId}/apply`)
      .set(a.headers)
      .send({ scale: null })
      .expect(404);
  });

  it('keeps the floor’s scale when the plan has none, and can be discarded', async () => {
    await api(app).patch(`/floors/${a.floorId}`).set(a.headers).send({ scale: 25 }).expect(200);
    const res = await importPlan(a).expect(201);
    const floor = await api(app)
      .post(`/floors/${a.floorId}/imports/${res.body.importId}/apply`)
      .set(a.headers)
      .send({ scale: null })
      .expect(201);
    expect(floor.body.scale).toBe(25);

    const other = await importPlan(a).expect(201);
    await api(app)
      .delete(`/floors/${a.floorId}/imports/${other.body.importId}`)
      .set(a.headers)
      .expect(204);
    await api(app)
      .get(`/floors/${a.floorId}/imports/${other.body.importId}/image`)
      .set(a.headers)
      .expect(404);
  });

  it('an import nobody applied or discarded is deleted after 7 days', async () => {
    const left = await importPlan(a).expect(201);
    const image = () =>
      api(app).get(`/floors/${a.floorId}/imports/${left.body.importId}/image`).set(a.headers);
    await image().expect(200);
    const storage = app.get(StorageService);
    // a day later it is still there; after 7 days the nightly clean-up removes it
    expect(await storage.deleteOldImports(7, new Date(Date.now() + 86_400_000))).toBe(0);
    await image().expect(200);
    expect(await storage.deleteOldImports(7, new Date(Date.now() + 8 * 86_400_000))).toBe(1);
    await image().expect(404);
    // the floor's own plan image is never touched
    await api(app)
      .post(`/floors/${a.floorId}/plan`)
      .set(a.headers)
      .attach('file', png(3, 2), 'p.png');
    expect(await storage.deleteOldImports(7, new Date(Date.now() + 30 * 86_400_000))).toBe(0);
    await api(app).get(`/floors/${a.floorId}/plan`).set(a.headers).expect(200);
  });

  it('is for editors of the floor’s own company only', async () => {
    await importPlan(a, a.viewerHeaders).expect(403);
    const res = await importPlan(a).expect(201);
    await api(app)
      .get(`/floors/${a.floorId}/imports/${res.body.importId}/image`)
      .set(a.viewerHeaders)
      .expect(403);
    // another company can't reach it, not even with the right ids
    await importPlan(b, a.headers).expect(404);
    await api(app)
      .post(`/floors/${a.floorId}/imports/${res.body.importId}/apply`)
      .set(b.headers)
      .send({ scale: null })
      .expect(404);
    await api(app)
      .get(`/floors/${a.floorId}/imports/${res.body.importId}/image`)
      .set(b.headers)
      .expect(404);
  });

  it('passes on why a plan can’t be read, and rejects broken answers', async () => {
    answer = { status: 422, body: { code: 'dwg' } };
    const dwg = await importPlan(a).expect(422);
    expect(dwg.body).toMatchObject({ code: 'plan_dwg' });

    answer = { status: 200, body: { ...DRAFT, rooms: [{ name: 'x', type: 'kitchen' }] } };
    expect((await importPlan(a).expect(502)).body.code).toBe('plan_failed');

    // the image must be the PNG the draft describes
    answer = { status: 200, body: { ...DRAFT, image: png(10, 10).toString('base64') } };
    expect((await importPlan(a).expect(502)).body.code).toBe('plan_failed');
  });

  it('says so when the plan engine is off or down', async () => {
    const url = process.env.PLAN_ENGINE_URL;
    try {
      delete process.env.PLAN_ENGINE_URL;
      expect((await importPlan(a).expect(503)).body.code).toBe('plan_engine_off');
      process.env.PLAN_ENGINE_URL = 'http://localhost:9'; // nothing listens there
      expect((await importPlan(a).expect(503)).body.code).toBe('plan_engine_unreachable');
    } finally {
      process.env.PLAN_ENGINE_URL = url;
    }
  });
});
