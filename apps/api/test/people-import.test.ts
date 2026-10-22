import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DeskMailService } from '../src/mail/desk-mail.service';
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

/** E-mails to `to`, waiting a moment for the job queue. */
async function mailsTo(to: string, count = 1) {
  for (let i = 0; i < 50; i++) {
    const mails = (await sentMails()).filter((m) => m.to === to);
    if (mails.length >= count) return mails;
    await new Promise((r) => setTimeout(r, 100));
  }
  return (await sentMails()).filter((m) => m.to === to);
}

describe('importing people from a spreadsheet', () => {
  const csv = Buffer.from(
    'Name;E-Mail;Abteilung\nMia Schmid;mia@alpha.example;Sales\nalpha p1;P1@alpha.example;\nNoah;noah@alpha.example;\nNoah again;noah@alpha.example;\nNo mail;;\n',
  );
  const read = (headers = a.headers) =>
    api(app).post('/people/import/read').set(headers).attach('file', csv, 'people.csv');

  it('shows what would happen to each row, saves nothing', async () => {
    const res = await read().expect(200);
    expect(res.body.rows.map((r: { status: string }) => r.status)).toEqual([
      'new',
      'exists',
      'new',
      'duplicate',
      'invalid',
    ]);
    expect(await owner.person.count({ where: { tenantId: a.tenantId } })).toBe(4);
    await read(a.viewerHeaders).expect(403);
    await api(app)
      .post('/people/import/read')
      .set(a.headers)
      .attach('file', Buffer.from('Ort\nBern'), 'x.csv')
      .expect(400)
      .expect((r) => expect(r.body.code).toBe('no_columns'));
  });

  it('adds the new people, skips those already there, tells IT and invites', async () => {
    await api(app)
      .patch('/tenant')
      .set(a.headers)
      .send({ notifyEmails: ['it@alpha.example'], notifyLanguage: 'en' })
      .expect(200);
    const res = await api(app)
      .post('/people/import')
      .set(a.headers)
      .send({
        people: [
          { displayName: 'Mia Schmid', email: 'mia@alpha.example', department: 'Sales' },
          { displayName: 'P1', email: 'p1@alpha.example' },
          { displayName: 'Noah', email: 'noah@alpha.example' },
        ],
        appRole: 'viewer',
        invite: true,
        language: 'en',
      })
      .expect(201);
    expect(res.body).toEqual({ created: 2, skipped: 1, invited: 2 });
    const mia = await owner.person.findFirstOrThrow({ where: { email: 'mia@alpha.example' } });
    expect(mia).toMatchObject({
      tenantId: a.tenantId,
      department: 'Sales',
      teamManual: true,
      appRole: 'viewer',
    });
    expect((await mailsTo('mia@alpha.example'))[0]?.subject).toContain('added you to Seatline');
    const notice = (await mailsTo('it@alpha.example'))[0];
    expect(notice?.text).toContain('Mia Schmid');
    expect(notice?.text).toContain('Noah');
    // the same address may exist in another workspace
    await api(app)
      .post('/people/import')
      .set(b.headers)
      .send({ people: [{ displayName: 'Mia', email: 'mia@alpha.example' }] })
      .expect(201)
      .expect((r) => expect(r.body.created).toBe(1));
  });
});

describe('"your new desk" e-mails', () => {
  const assign = (seatId: string, personId: string) =>
    api(app).post('/assignments').set(a.headers).send({ seatId, personId }).expect(201);

  it('tells the person where they sit now', async () => {
    await assign(a.seatIds[0], a.personIds[0]);
    const [mail] = await mailsTo('p1@alpha.example');
    expect(mail?.subject).toBe('Ihr Arbeitsplatz: A1');
    expect(mail?.text).toContain('alpha HQ › 1. OG › Open Space');
    // p1 has no role, so no link to the map
    expect(mail?.text).not.toContain('/map?');
  });

  it('sends nothing for an undone move, or when switched off', async () => {
    const desk = app.get(DeskMailService);
    // (tests send at once; online the e-mail waits 2 minutes, then checks like this)
    await assign(a.seatIds[0], a.personIds[0]);
    const moved = (await assign(a.seatIds[1], a.personIds[0])).body.assignment.id;
    const back = (await assign(a.seatIds[0], a.personIds[0])).body.assignment.id; // undo
    expect(await desk.send(a.tenantId, [moved])).toBe(0); // ended
    expect(await desk.send(a.tenantId, [back])).toBe(0); // back on the desk they just had

    await api(app).patch('/tenant').set(a.headers).send({ notifyPeople: false }).expect(200);
    const other = (await assign(a.seatIds[2], a.personIds[1])).body.assignment.id;
    expect(await desk.send(a.tenantId, [other])).toBe(0);
  });
});
