import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  appDb,
  connectMicrosoft,
  createApp,
  createTenant,
  emailToken,
  owner,
  resetDb,
  type Fixture,
} from './helpers';
import { clearMails, lastLinkToken, lastSignInCode, sentMails } from './mail';

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

const start = (email: string, language = 'en') =>
  api(app).post('/auth/email/start').send({ email, language });
const verify = (token: string) => api(app).post('/auth/email/verify').send({ token });
const session = async (email: string, tenantId: string | null = null) =>
  (
    await api(app)
      .post('/auth/session')
      .set(await emailToken(email, tenantId))
      .expect(200)
  ).body;

describe('sign-in with an e-mail link', () => {
  it('sends a one-time link that proves the address, in the asked language', async () => {
    expect((await api(app).get('/auth/options').expect(200)).body).toEqual({ email: true });
    await start(' Admin@Alpha.example ', 'de').expect(200);
    const [mail] = await sentMails();
    expect(mail).toMatchObject({
      to: 'admin@alpha.example',
      subject: 'Ihr Anmeldelink für Seatline',
    });
    expect(mail!.text).toContain('https://app.seatline.test/auth/email?token=');

    const token = (await lastLinkToken('admin@alpha.example'))!;
    expect((await verify(token).expect(200)).body).toEqual({ email: 'admin@alpha.example' });
    // once only; made-up tokens never work
    expect((await verify(token).expect(400)).body.code).toBe('link_invalid');
    await verify('x'.repeat(43)).expect(400);
    await verify('short').expect(400);
    // only the hash is stored
    const rows = await owner.$queryRaw<
      { token_hash: string }[]
    >`SELECT token_hash FROM email_sign_ins`;
    expect(rows[0]!.token_hash).not.toContain(token);
  });

  it('the same e-mail has a code to type in instead (once, only for that address)', async () => {
    const byCode = (email: string, code: string) =>
      api(app).post('/auth/email/code').send({ email, code });
    await start('admin@alpha.example').expect(200);
    const code = (await lastSignInCode('admin@alpha.example'))!;
    expect(code).toMatch(/^\d{3} \d{3}$/);
    // not for another address, nor a made-up code; spaces and capitals don't matter
    await byCode('viewer@alpha.example', code).expect(400);
    expect((await byCode('admin@alpha.example', '000000').expect(400)).body.code).toBe(
      'code_invalid',
    );
    await byCode('admin@alpha.example', 'abc').expect(400);
    expect((await byCode('Admin@Alpha.example', code).expect(200)).body).toEqual({
      email: 'admin@alpha.example',
    });
    // once only — and then the link is used up too (one sign-in per e-mail)
    await byCode('admin@alpha.example', code).expect(400);
    await verify((await lastLinkToken('admin@alpha.example'))!).expect(400);
    // only hashes are stored
    const rows = await owner.$queryRaw<
      { code_hash: string }[]
    >`SELECT code_hash FROM email_sign_ins`;
    expect(rows[0]!.code_hash).not.toContain(code.replace(' ', ''));
  });

  it('a code can’t be guessed: 5 wrong tries and it stops working', async () => {
    const byCode = (code: string) =>
      api(app).post('/auth/email/code').send({ email: 'admin@alpha.example', code });
    await start('admin@alpha.example').expect(200);
    await start('admin@alpha.example').expect(200); // a second e-mail doesn't add tries
    const code = (await lastSignInCode('admin@alpha.example'))!.replace(' ', '');
    const wrong = code === '123456' ? '654321' : '123456';
    for (let i = 0; i < 5; i++) await byCode(wrong).expect(400);
    await byCode(code).expect(400);
    // the link in the e-mail still works
    await verify((await lastLinkToken('admin@alpha.example'))!).expect(200);
  });

  it('codes expire with their link', async () => {
    await start('admin@alpha.example').expect(200);
    await owner.$executeRaw`UPDATE email_sign_ins SET expires_at = now() - interval '1 second'`;
    await api(app)
      .post('/auth/email/code')
      .send({ email: 'admin@alpha.example', code: (await lastSignInCode('admin@alpha.example'))! })
      .expect(400);
  });

  it('links expire', async () => {
    await start('admin@alpha.example').expect(200);
    await owner.$executeRaw`UPDATE email_sign_ins SET expires_at = now() - interval '1 second'`;
    await verify((await lastLinkToken('admin@alpha.example'))!).expect(400);
  });

  it('limits links per address', async () => {
    for (let i = 0; i < 3; i++) await start('someone@example.com').expect(200);
    expect((await start('SOMEONE@example.com').expect(429)).body.code).toBe('too_many_links');
    await start('other@example.com').expect(200);
    await start('not an address').expect(400);
  });

  it('the proven address finds its person; nobody else is let in', async () => {
    expect(await session('admin@alpha.example')).toMatchObject({
      status: 'ok',
      role: 'admin',
      workspace: { id: a.tenantId },
    });
    // the token works for the API like a Microsoft one
    const me = await api(app)
      .get('/me')
      .set(await emailToken('admin@alpha.example'))
      .expect(200);
    expect(me.body.person.id).toBe(a.adminId);
    // a person without a role, unknown addresses, people who left
    expect((await session('p1@alpha.example')).status).toBe('no_access');
    expect((await session('stranger@example.com')).status).toBe('no_workspace');
    await owner.person.update({ where: { id: a.viewerId }, data: { active: false } });
    expect((await session('viewer@alpha.example')).status).toBe('inactive');
    await api(app)
      .get('/me')
      .set(await emailToken('stranger@example.com'))
      .expect(403);
  });

  it('workspaces with Microsoft 365 keep Microsoft sign-in', async () => {
    await connectMicrosoft(a);
    expect((await session('admin@alpha.example')).status).toBe('use_microsoft');
    // a picked workspace that uses Microsoft doesn't help either
    expect((await session('admin@alpha.example', a.tenantId)).status).toBe('use_microsoft');
  });

  it('an address in several workspaces picks one', async () => {
    await owner.person.update({ where: { id: b.adminId }, data: { email: 'admin@alpha.example' } });
    const choose = await session('admin@alpha.example');
    expect(choose.status).toBe('choose');
    expect(choose.workspaces.map((w: { id: string }) => w.id).sort()).toEqual(
      [a.tenantId, b.tenantId].sort(),
    );
    expect(await session('admin@alpha.example', b.tenantId)).toMatchObject({
      status: 'ok',
      workspace: { id: b.tenantId },
    });
    // a workspace the address isn't in can't be picked
    const c = await createTenant('gamma');
    expect((await session('admin@alpha.example', c.tenantId)).status).toBe('choose');
  });

  it('someone who left a company can start their own workspace with that address', async () => {
    await owner.person.update({
      where: { id: a.viewerId },
      data: { email: 'leaver@example.com', active: false, leftAt: new Date() },
    });
    expect((await session('leaver@example.com')).status).toBe('inactive');
    const who = await emailToken('leaver@example.com');
    const res = await api(app)
      .post('/onboarding')
      .set(who)
      .send({ companyName: 'Own GmbH', yourName: 'Lea Leaver' })
      .expect(201);
    // the new workspace is the one offered now, not a chooser with the old one
    expect(await session('leaver@example.com')).toMatchObject({
      status: 'ok',
      role: 'admin',
      workspace: { id: res.body.workspace.id },
    });
    // the old one can still be named explicitly (and still says "left")
    expect((await session('leaver@example.com', a.tenantId)).status).toBe('inactive');
  });

  it('a new company signs up with e-mail: its first person becomes admin', async () => {
    const who = await emailToken('founder@new.example');
    await api(app).post('/onboarding').set(who).send({ companyName: 'New AG' }).expect(400);
    const res = await api(app)
      .post('/onboarding')
      .set(who)
      .send({ companyName: 'New AG', yourName: 'Fiona Founder' })
      .expect(201);
    expect(await session('founder@new.example')).toMatchObject({ status: 'ok', role: 'admin' });
    const tenant = await owner.tenant.findUniqueOrThrow({ where: { id: res.body.workspace.id } });
    expect(tenant.entraTenantId).toBeNull();
    await api(app)
      .post('/onboarding')
      .set(who)
      .send({ companyName: 'Again AG', yourName: 'Fiona' })
      .expect(409);
  });
});

describe('people added by hand', () => {
  const add = (body: object, headers = a.headers) =>
    api(app).post('/people').set(headers).send(body);

  it('admins add, correct, invite and mark people as left; history stays', async () => {
    const res = await add({
      displayName: 'Nora Neu',
      email: 'Nora@Alpha.example',
      department: 'Finance',
      appRole: 'viewer',
      invite: true,
      language: 'fr',
    }).expect(201);
    expect(res.body).toMatchObject({
      email: 'nora@alpha.example',
      department: 'Finance',
      invited: true,
    });
    const [mail] = await sentMails();
    expect(mail).toMatchObject({
      to: 'nora@alpha.example',
      subject: 'alpha admin vous a ajouté à Seatline',
    });
    expect(mail!.text).toContain('https://app.seatline.test/signin?email=nora%40alpha.example');
    expect(await session('nora@alpha.example')).toMatchObject({ status: 'ok', role: 'viewer' });

    await add({ displayName: 'Copy', email: 'nora@alpha.example' }).expect(409);
    const id = res.body.id;
    await api(app)
      .patch(`/people/${id}`)
      .set(a.headers)
      .send({ displayName: 'Nora Neumann' })
      .expect(200);

    // she sits somewhere, then leaves: the seat is free, the history keeps her
    await api(app)
      .post('/assignments')
      .set(a.headers)
      .send({ seatId: a.seatIds[0], personId: id })
      .expect(201);
    await api(app).patch(`/people/${id}/active`).set(a.headers).send({ active: false }).expect(200);
    const history = await owner.seatAssignment.findMany({ where: { personId: id } });
    expect(history).toHaveLength(1);
    expect(history[0]!.endAt).not.toBeNull();
    expect((await session('nora@alpha.example')).status).toBe('inactive');
    await api(app).patch(`/people/${id}/active`).set(a.headers).send({ active: true }).expect(200);

    const actions = (await owner.auditLog.findMany({ where: { entityId: id } })).map(
      (l) => l.action,
    );
    expect(actions).toEqual(
      expect.arrayContaining([
        'person.create',
        'person.invite',
        'person.update',
        'person.leave',
        'person.return',
      ]),
    );
  });

  it('only admins; people from Microsoft are changed there; one admin stays', async () => {
    await add({ displayName: 'X', email: 'x@alpha.example' }, a.viewerHeaders).expect(403);
    await add({ displayName: 'X', email: 'no-email' }).expect(400);
    await owner.person.update({
      where: { id: a.personIds[0] },
      data: { entraObjectId: crypto.randomUUID() },
    });
    const fromMs = await api(app)
      .patch(`/people/${a.personIds[0]}`)
      .set(a.headers)
      .send({ displayName: 'Y' })
      .expect(409);
    expect(fromMs.body.code).toBe('from_microsoft');
    await api(app)
      .patch(`/people/${a.adminId}/active`)
      .set(a.headers)
      .send({ active: false })
      .expect(409);
    await api(app)
      .patch(`/people/${b.personIds[0]}`)
      .set(a.headers)
      .send({ displayName: 'Z' })
      .expect(404);
  });

  it('invitations only for people with a role, in e-mail workspaces', async () => {
    await api(app).post(`/people/${a.personIds[0]}/invite`).set(a.headers).send({}).expect(409);
    await connectMicrosoft(b);
    await api(app).post(`/people/${b.viewerId}/invite`).set(b.headers).send({}).expect(409);
    expect(await sentMails()).toEqual([]);
  });
});
