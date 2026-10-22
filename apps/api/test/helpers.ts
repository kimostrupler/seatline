import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient, type Prisma } from '@prisma/client';
import { SignJWT } from 'jose';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/** Owner connection: builds fixtures and wipes data. Never what the API uses. */
export const owner = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });

/** The API's own role (RLS applies) — for testing database rules directly. */
export const appDb = new PrismaClient({ datasourceUrl: process.env.TEST_APP_DATABASE_URL });

/** Runs fn as the API role inside a transaction scoped to tenantId (or none). */
export function asApp<T>(
  tenantId: string | null,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return appDb.$transaction(async (tx) => {
    if (tenantId) await tx.$queryRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx);
  });
}

export async function resetDb() {
  // TRUNCATE doesn't fire the row-level append-only triggers.
  await owner.$executeRawUnsafe(
    'TRUNCATE audit_log, seat_assignments, seats, rooms, floors, buildings, people, tenants, email_sign_ins CASCADE',
  );
}

export interface Fixture {
  tenantId: string;
  adminId: string;
  viewerId: string;
  buildingId: string;
  floorId: string;
  roomId: string;
  seatIds: [string, string, string];
  personIds: [string, string];
  headers: { 'x-tenant-id': string; 'x-user-id': string };
  viewerHeaders: { 'x-tenant-id': string; 'x-user-id': string };
}

/** A tenant with one building, one floor, one room, 3 seats and 2 seat-only people. */
export async function createTenant(slug: string): Promise<Fixture> {
  const tenant = await owner.tenant.create({ data: { name: slug, slug } });
  const tenantId = tenant.id;
  const person = (name: string, appRole: 'admin' | 'viewer' | null) =>
    owner.person.create({
      data: { tenantId, email: `${name}@${slug}.example`, displayName: `${slug} ${name}`, appRole },
    });
  const admin = await person('admin', 'admin');
  const viewer = await person('viewer', 'viewer');
  const p1 = await person('p1', null);
  const p2 = await person('p2', null);
  const building = await owner.building.create({ data: { tenantId, name: `${slug} HQ` } });
  const floor = await owner.floor.create({
    data: { tenantId, buildingId: building.id, name: '1. OG', level: 1 },
  });
  const room = await owner.room.create({
    data: {
      tenantId,
      floorId: floor.id,
      name: 'Open Space',
      polygon: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
    },
  });
  const seat = (label: string) =>
    owner.seat.create({
      data: { tenantId, floorId: floor.id, roomId: room.id, label, x: 1, y: 1 },
    });
  const seats = [await seat('A1'), await seat('A2'), await seat('A3')] as const;
  return {
    tenantId,
    adminId: admin.id,
    viewerId: viewer.id,
    buildingId: building.id,
    floorId: floor.id,
    roomId: room.id,
    seatIds: [seats[0].id, seats[1].id, seats[2].id],
    personIds: [p1.id, p2.id],
    headers: { 'x-tenant-id': tenantId, 'x-user-id': admin.id },
    viewerHeaders: { 'x-tenant-id': tenantId, 'x-user-id': viewer.id },
  };
}

export async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false, rawBody: true });
  await app.init();
  return app;
}

export function api(app: INestApplication) {
  return request(app.getHttpServer());
}

/** What the web app sends after Microsoft sign-in: a short-lived signed identity token. */
export async function msToken(
  identity: { tid: string; oid: string; name?: string; email?: string },
  options: { secret?: string; expiresIn?: string; audience?: string } = {},
) {
  const token = await new SignJWT({
    tid: identity.tid,
    oid: identity.oid,
    name: identity.name ?? 'Test Person',
    email: identity.email ?? `${identity.oid.slice(0, 8)}@example.com`,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('seatline-web')
    .setAudience(options.audience ?? 'seatline-api')
    .setIssuedAt()
    .setExpirationTime(options.expiresIn ?? '60s')
    .sign(new TextEncoder().encode(options.secret ?? process.env.INTERNAL_AUTH_SECRET!));
  return { authorization: `Bearer ${token}` };
}

/** What the web app sends after an e-mail link was used: the proven address (+ picked workspace). */
export async function emailToken(email: string, tenantId: string | null = null) {
  const token = await new SignJWT({ kind: 'email', email, tenantId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('seatline-web')
    .setAudience('seatline-api')
    .setIssuedAt()
    .setExpirationTime('60s')
    .sign(new TextEncoder().encode(process.env.INTERNAL_AUTH_SECRET!));
  return { authorization: `Bearer ${token}` };
}

export const newMsIdentity = (tid = randomUUID()) => ({ tid, oid: randomUUID() });

/** Connect a fixture tenant to a Microsoft 365 tenant id. */
export async function connectMicrosoft(f: Fixture, tid = randomUUID()) {
  await owner.tenant.update({ where: { id: f.tenantId }, data: { entraTenantId: tid } });
  return tid;
}
