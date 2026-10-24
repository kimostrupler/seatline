import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { zurichToday } from '../src/moves/moves.service';
import { PeopleService } from '../src/people/people.service';
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
  await clearMails();
  a = await createTenant('alpha');
  b = await createTenant('beta');
});

const settings = (body: object, headers = a.headers) =>
  api(app).patch('/tenant').set(headers).send(body);
const changes = (list: object[], headers = a.headers) =>
  api(app).post('/people/changes').set(headers).send({ changes: list });
const assign = (seatId: string, personId: string) =>
  api(app).post('/assignments').set(a.headers).send({ seatId, personId }).expect(201);
const dayOffset = (days: number) => {
  const d = new Date(`${zurichToday()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const notices = async () => (await sentMails()).filter((m) => m.to.includes('it@alpha.example'));

describe('HR changes and notices to IT', () => {
  beforeEach(async () => {
    await settings({
      notifyEmails: ['it@alpha.example', 'facility@alpha.example'],
      notifyLanguage: 'en',
    }).expect(200);
  });

  it('notice settings are admin-only and validated', async () => {
    const t = (await api(app).get('/tenant').set(a.headers).expect(200)).body;
    expect(t).toMatchObject({
      notifyEmails: ['it@alpha.example', 'facility@alpha.example'],
      notifyEvents: ['left', 'joined', 'team', 'moves'],
      notifyLanguage: 'en',
    });
    await settings({ notifyEmails: ['x@y.ch'] }, a.viewerHeaders).expect(403);
    await settings({ notifyEmails: ['not-an-address'] }).expect(400);
    await settings({ notifyEvents: ['everything'] }).expect(400);
  });

  it('a leaving date today frees the seat now and tells IT which desk is free', async () => {
    await assign(a.seatIds[0], a.personIds[0]);
    await changes([{ personId: a.personIds[0], leavesOn: zurichToday() }]).expect(200);
    const p = await owner.person.findUniqueOrThrow({ where: { id: a.personIds[0] } });
    expect(p.active).toBe(false);
    const seat = await owner.seatAssignment.findFirst({ where: { personId: p.id } });
    expect(seat!.endAt).not.toBeNull(); // history kept, seat free
    const [mail] = await notices();
    expect(mail!.to).toBe('it@alpha.example, facility@alpha.example');
    expect(mail!.subject).toBe('Seatline · alpha: alpha p1 has left');
    expect(mail!.text).toContain('Desk A1 (alpha HQ › 1. OG) is free now.');
  });

  it('a later leaving date is announced, and the nightly job lets the person go then', async () => {
    await assign(a.seatIds[1], a.personIds[1]);
    await changes([
      { personId: a.personIds[1], leavesOn: dayOffset(14), department: 'Sales', appRole: 'viewer' },
    ]).expect(200);
    let p = await owner.person.findUniqueOrThrow({ where: { id: a.personIds[1] } });
    expect(p).toMatchObject({ active: true, department: 'Sales', appRole: 'viewer' });
    const mail = (await notices())[0]!;
    expect(mail.subject).toBe('Seatline · alpha: 2 changes');
    expect(mail.text).toContain('alpha p2 moved from team no team to Sales.');
    expect(mail.text).toMatch(/alpha p2 \(Sales\) leaves the company on .+\./);
    expect(mail.text).toContain('Desk A2 (alpha HQ › 1. OG) will be free from');

    // the day comes (simulated): the nightly job lets them go
    await owner.person.update({
      where: { id: p.id },
      data: { leavesOn: new Date(`${dayOffset(-1)}T00:00:00Z`) },
    });
    expect(await app.get(PeopleService).leaveDue(a.tenantId, zurichToday())).toBe(1);
    p = await owner.person.findUniqueOrThrow({ where: { id: p.id } });
    expect(p.active).toBe(false);
    expect((await notices()).at(-1)!.text).toContain('Desk A2 (alpha HQ › 1. OG) is free now.');
    const actions = (await owner.auditLog.findMany({ where: { entityId: p.id } })).map(
      (l) => l.action,
    );
    expect(actions).toEqual(
      expect.arrayContaining(['person.leaves_on', 'person.team', 'person.role', 'person.leave']),
    );
  });

  it('all or nothing; admins only; only this workspace', async () => {
    await changes([
      { personId: a.personIds[0], department: 'Ops' },
      { personId: b.personIds[0], department: 'Ops' },
    ]).expect(404);
    expect(
      (await owner.person.findUniqueOrThrow({ where: { id: a.personIds[0] } })).department,
    ).toBeNull();
    await changes([{ personId: a.personIds[0], department: 'Ops' }], a.viewerHeaders).expect(403);
    await changes([{ personId: a.adminId, appRole: 'viewer' }]).expect(409); // last admin
    // nor may the last admin get a leaving date: the night it came, nothing could let them go
    await changes([{ personId: a.adminId, leavesOn: dayOffset(14) }]).expect(409);
    expect(
      (await owner.person.findUniqueOrThrow({ where: { id: a.adminId } })).leavesOn,
    ).toBeNull();
    await changes([{ personId: a.personIds[0], leavesOn: '31.12.2026' }]).expect(400);
  });

  it('only the events a workspace wants', async () => {
    await settings({ notifyEvents: ['left'] }).expect(200);
    await changes([{ personId: a.personIds[0], department: 'Ops' }]).expect(200);
    expect(await notices()).toEqual([]);
    await settings({ notifyEmails: [] }).expect(200);
    await changes([{ personId: a.personIds[0], leavesOn: zurichToday() }]).expect(200);
    expect(await notices()).toEqual([]);
  });

  it('a carried-out move plan tells IT who moved where (in the chosen language)', async () => {
    await settings({ notifyLanguage: 'de' }).expect(200);
    await assign(a.seatIds[0], a.personIds[0]);
    const id = (
      await api(app).post('/move-plans').set(a.headers).send({ name: 'Frühling' }).expect(201)
    ).body.id;
    await api(app)
      .put(`/move-plans/${id}/items`)
      .set(a.headers)
      .send({ items: [{ personId: a.personIds[0], toSeatId: a.seatIds[2] }] })
      .expect(200);
    await api(app).post(`/move-plans/${id}/apply`).set(a.headers).expect(201);
    const mail = (await notices())[0]!;
    expect(mail.subject).toBe('Seatline · alpha: Umzugsplan «Frühling» ausgeführt');
    expect(mail.text).toContain('alpha p1: A1 → A3 (alpha HQ › 1. OG)');
  });
});

describe('teams', () => {
  const rename = (body: object, headers = a.headers) =>
    api(app).post('/people/teams/rename').set(headers).send(body);

  it('rename or remove a team for everyone in it', async () => {
    await owner.person.updateMany({
      where: { id: { in: a.personIds } },
      data: { department: 'Sales' },
    });
    await owner.person.update({ where: { id: a.viewerId }, data: { department: 'Finance' } });
    expect((await rename({ from: 'Sales', to: 'Customer Success' }).expect(200)).body).toEqual({
      people: 2,
    });
    expect(await owner.person.count({ where: { department: 'Customer Success' } })).toBe(2);
    expect((await rename({ from: 'Customer Success', to: 'Finance' }).expect(409)).body.code).toBe(
      'team_exists',
    );
    await rename({ from: 'Finance', to: null }).expect(200);
    expect(
      (await owner.person.findUniqueOrThrow({ where: { id: a.viewerId } })).department,
    ).toBeNull();
    await rename({ from: 'Customer Success', to: 'X' }, a.viewerHeaders).expect(403);
    // other workspaces keep their teams
    await owner.person.update({ where: { id: b.viewerId }, data: { department: 'Sales' } });
    await rename({ from: 'Sales', to: 'Y' }).expect(200);
    expect((await owner.person.findUniqueOrThrow({ where: { id: b.viewerId } })).department).toBe(
      'Sales',
    );
  });
});
