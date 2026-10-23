import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrivacyService, retentionCutoff } from '../src/privacy/privacy.service';
import { api, appDb, createApp, createTenant, owner, resetDb, type Fixture } from './helpers';
import { clearMails, sentMails } from './mail';

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

const yearsAgo = (n: number) => new Date(Date.now() - n * 365 * 24 * 3600 * 1000);
/** history written directly (as if it happened long ago) */
const oldAssignment = (f: Fixture, seat: number, person: number, start: Date, end: Date) =>
  owner.seatAssignment.create({
    data: {
      tenantId: f.tenantId,
      seatId: f.seatIds[seat]!,
      personId: f.personIds[person]!,
      kind: 'assigned',
      startAt: start,
      endAt: end,
      assignedById: f.adminId,
    },
  });
const oldAudit = (f: Fixture, at: Date, extra: object = {}) =>
  owner.auditLog.create({
    data: {
      tenantId: f.tenantId,
      actorId: f.adminId,
      action: 'seat.update',
      entityType: 'seat',
      entityId: f.seatIds[0]!,
      createdAt: at,
      ...extra,
    },
  });

describe('how long history is kept', () => {
  it('deletes ended history and activity older than the retention period, nothing else', async () => {
    const old = await oldAssignment(a, 0, 0, yearsAgo(4), yearsAgo(3));
    const recent = await oldAssignment(a, 1, 0, yearsAgo(1), yearsAgo(0.5));
    const otherCompany = await oldAssignment(b, 0, 0, yearsAgo(4), yearsAgo(3));
    await oldAudit(a, yearsAgo(3));
    await oldAudit(a, yearsAgo(1));
    await oldAudit(b, yearsAgo(3));

    const result = await app.get(PrivacyService).purge(a.tenantId, 24);
    expect(result).toMatchObject({ assignments: 1, activity: 1, forgotten: 0 });
    const left = await owner.seatAssignment.findMany({ select: { id: true } });
    expect(left.map((x) => x.id).sort()).toEqual([recent.id, otherCompany.id].sort());
    expect(left.map((x) => x.id)).not.toContain(old.id);
    expect(await owner.auditLog.count({ where: { tenantId: b.tenantId } })).toBe(1);
  });

  it('open seats are never deleted, however old', async () => {
    await api(app)
      .post('/assignments')
      .set(a.headers)
      .send({ seatId: a.seatIds[0], personId: a.personIds[0] })
      .expect(201);
    await app.get(PrivacyService).purge(a.tenantId, 12, new Date(Date.now() + 10 * 365 * 864e5));
    expect(await owner.seatAssignment.count({ where: { tenantId: a.tenantId, endAt: null } })).toBe(
      1,
    );
  });

  it('the app itself still can’t delete or rewrite history', async () => {
    const row = await oldAssignment(a, 0, 0, yearsAgo(4), yearsAgo(3));
    await expect(appDb.seatAssignment.delete({ where: { id: row.id } })).rejects.toThrow();
    const entry = await oldAudit(a, yearsAgo(3));
    await expect(owner.auditLog.delete({ where: { id: entry.id } })).rejects.toThrow(/append-only/);
    await expect(
      owner.auditLog.update({ where: { id: entry.id }, data: { action: 'x' } }),
    ).rejects.toThrow(/append-only/);
  });

  it('admins choose the period', async () => {
    const patch = (body: object, headers = a.headers) =>
      api(app).patch('/tenant').set(headers).send(body);
    expect(
      (await patch({ historyRetentionMonths: 60 }).expect(200)).body.historyRetentionMonths,
    ).toBe(60);
    await patch({ historyRetentionMonths: null }).expect(200);
    await patch({ historyRetentionMonths: 7 }).expect(400);
    await patch({ historyRetentionMonths: 12 }, a.viewerHeaders).expect(403);
  });
});

describe('people who left', () => {
  it('forgetting removes their personal data but keeps the seat history', async () => {
    const [p1] = a.personIds;
    await oldAssignment(a, 0, 0, yearsAgo(1), yearsAgo(0.5));
    await oldAudit(a, new Date(), {
      action: 'person.first_sign_in',
      entityType: 'person',
      entityId: p1,
      after: { displayName: 'alpha p1', email: 'p1@alpha.example', appRole: 'viewer' },
    });
    const forget = () => api(app).post(`/privacy/people/${p1}/forget`).set(a.headers);
    await forget().expect(409); // still active

    await owner.person.update({ where: { id: p1 }, data: { active: false, leftAt: new Date() } });
    await api(app).post(`/privacy/people/${p1}/forget`).set(a.viewerHeaders).expect(403);
    await forget().expect(201);
    const person = await owner.person.findUniqueOrThrow({ where: { id: p1 } });
    expect(person).toMatchObject({
      displayName: 'Former employee',
      email: `forgotten-${p1}@invalid`,
      department: null,
      entraObjectId: null,
    });
    expect(person.forgottenAt).not.toBeNull();
    expect(await owner.seatAssignment.count({ where: { personId: p1 } })).toBe(1);
    const entry = await owner.auditLog.findFirst({ where: { action: 'person.first_sign_in' } });
    expect(entry?.after).toEqual({ appRole: 'viewer' });
  });

  it('the nightly clean-up forgets people who left before the retention period', async () => {
    const [p1, p2] = a.personIds;
    await owner.person.update({ where: { id: p1 }, data: { active: false, leftAt: yearsAgo(3) } });
    await owner.person.update({ where: { id: p2 }, data: { active: false, leftAt: yearsAgo(1) } });
    const result = await app.get(PrivacyService).purge(a.tenantId, 24);
    expect(result.forgotten).toBe(1);
    expect(
      (await owner.person.findUniqueOrThrow({ where: { id: p1 } })).forgottenAt,
    ).not.toBeNull();
    expect((await owner.person.findUniqueOrThrow({ where: { id: p2 } })).forgottenAt).toBeNull();
  });

  it('access request: everything stored about a person, as a file; admins only', async () => {
    const [p1] = a.personIds;
    await api(app)
      .post('/assignments')
      .set(a.headers)
      .send({ seatId: a.seatIds[0], personId: p1 })
      .expect(201);
    const res = await api(app).get(`/privacy/people/${p1}/export`).set(a.headers).expect(200);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="seatline-person-/);
    const data = JSON.parse(res.text) as {
      person: { name: string; email: string };
      seats: Array<{ seat: string }>;
      activity: Array<{ action: string }>;
    };
    expect(data.person).toMatchObject({ name: 'alpha p1', email: 'p1@alpha.example' });
    expect(data.seats).toEqual([expect.objectContaining({ seat: 'A1', floor: '1. OG' })]);
    expect(data.activity.map((x) => x.action)).toContain('assignment.create');
    await api(app).get(`/privacy/people/${p1}/export`).set(a.viewerHeaders).expect(403);
    await api(app).get(`/privacy/people/${p1}/export`).set(b.headers).expect(404);
  });

  it('cut-off is N months back', () => {
    expect(retentionCutoff(new Date('2026-10-21T12:00:00Z'), 24).toISOString()).toBe(
      '2024-10-21T12:00:00.000Z',
    );
  });
});

describe('data processing agreement', () => {
  it('an admin e-mails themselves the DPA as a PDF; viewers cannot', async () => {
    await clearMails();
    const admin = await owner.person.findUniqueOrThrow({ where: { id: a.adminId } });
    const res = await api(app)
      .post('/privacy/dpa')
      .set(a.headers)
      .send({ language: 'de' })
      .expect(201);
    expect(res.body).toEqual({ sentTo: admin.email });
    const mail = (await sentMails()).at(-1) as unknown as {
      to: string;
      subject: string;
      attachments: Array<{ filename: string; contentType: string; content: string }>;
    };
    expect(mail.to).toBe(admin.email);
    expect(mail.subject).toContain('Auftragsverarbeitungsvertrag');
    expect(mail.attachments[0]).toMatchObject({
      filename: 'Seatline-AVV.pdf',
      contentType: 'application/pdf',
    });
    expect(Buffer.from(mail.attachments[0]!.content, 'base64').subarray(0, 5).toString()).toBe(
      '%PDF-',
    );
    expect(
      await owner.auditLog.count({ where: { tenantId: a.tenantId, action: 'privacy.dpa' } }),
    ).toBe(1);

    await api(app).post('/privacy/dpa').set(a.viewerHeaders).send({ language: 'en' }).expect(403);
    await api(app).post('/privacy/dpa').set(a.headers).send({ language: 'xx' }).expect(400);
  });
});
