import { BlobServiceClient } from '@azure/storage-blob';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api, appDb, createApp, createTenant, owner, resetDb, type Fixture } from './helpers';

// 1×1 PNG and a tiny 3×2 one (only the header matters for size detection)
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const png = (w: number, h: number) => {
  const b = Buffer.from(PNG_1x1);
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return b;
};

let app: INestApplication;
let a: Fixture;
let b: Fixture;

const blobs = () =>
  BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING!,
  ).getContainerClient(process.env.AZURE_STORAGE_CONTAINER!);
async function blobNames(prefix: string) {
  const names: string[] = [];
  for await (const blob of blobs().listBlobsFlat({ prefix })) names.push(blob.name);
  return names;
}

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

const upload = (f: Fixture, data: Buffer, headers = f.headers, name = 'plan.png') =>
  api(app).post(`/floors/${f.floorId}/plan`).set(headers).attach('file', data, name);

describe('floor plan images', () => {
  it('stores the image privately and serves it back', async () => {
    const res = await upload(a, png(1600, 900)).expect(201);
    expect(res.body).toMatchObject({ planWidth: 1600, planHeight: 900 });
    expect(res.body.planFileKey).toMatch(
      new RegExp(`^${a.tenantId}/floors/${a.floorId}/.+\\.png$`),
    );

    const plan = await api(app)
      .get(`/floors/${a.floorId}/plan`)
      .set(a.viewerHeaders)
      .buffer(true)
      .expect(200);
    expect(plan.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(plan.body as Buffer, png(1600, 900))).toBe(0);

    const log = await owner.auditLog.findMany({ where: { action: 'floor.plan.upload' } });
    expect(log).toHaveLength(1);
  });

  it('never serves another company’s plan', async () => {
    await upload(b, png(10, 10)).expect(201);
    await api(app).get(`/floors/${b.floorId}/plan`).set(a.headers).expect(404);
    await upload(a, png(10, 10), a.headers).expect(201);
    await api(app)
      .post(`/floors/${b.floorId}/plan`)
      .set(a.headers)
      .attach('file', png(5, 5), 'x.png')
      .expect(404);
  });

  it('only accepts real raster images', async () => {
    await upload(
      a,
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      a.headers,
      'plan.svg',
    ).expect(400);
    await upload(a, Buffer.from('not an image'), a.headers, 'plan.png').expect(400);
    await api(app).post(`/floors/${a.floorId}/plan`).set(a.headers).expect(400);
    expect(await blobNames(`${a.tenantId}/`)).toEqual([]);
  });

  it('rejects files over 10 MB', async () => {
    const big = Buffer.concat([png(10, 10), Buffer.alloc(10 * 1024 * 1024)]);
    await upload(a, big).expect(413);
  });

  it('viewers cannot upload', async () => {
    await upload(a, png(10, 10), a.viewerHeaders).expect(403);
  });

  it('replacing or removing a plan cleans up the old file', async () => {
    await upload(a, png(10, 10)).expect(201);
    const second = await upload(a, png(20, 20)).expect(201);
    expect(await blobNames(`${a.tenantId}/`)).toEqual([second.body.planFileKey]);

    await api(app).delete(`/floors/${a.floorId}/plan`).set(a.headers).expect(204);
    await api(app).get(`/floors/${a.floorId}/plan`).set(a.headers).expect(404);
    expect(await blobNames(`${a.tenantId}/`)).toEqual([]);
  });
});
