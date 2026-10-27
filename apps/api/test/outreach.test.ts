import type { INestApplication } from '@nestjs/common';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { LeadsService } from '../src/owner/leads.service';
import { api, appDb, createApp, createTenant, owner, resetDb, type Fixture } from './helpers';
import { clearMails, sentMails } from './mail';

let app: INestApplication;
let a: Fixture;
let b: Fixture;
const inbox = () => process.env.MAIL_INBOX!;

beforeAll(async () => {
  process.env.OWNER_EMAILS = 'admin@alpha.example';
  app = await createApp();
});
afterAll(async () => {
  delete process.env.OWNER_EMAILS;
  await app.close();
  await Promise.all([owner.$disconnect(), appDb.$disconnect()]);
});
beforeEach(async () => {
  await resetDb();
  await clearMails();
  await rm(inbox(), { recursive: true, force: true });
  a = await createTenant('alpha');
  b = await createTenant('beta');
});

const lead = {
  company: 'Livingdocs',
  greeting: 'Herr van der Ploeg',
  whyNow: 'Ich habe gesehen, dass Livingdocs weiter wächst.',
  address: 'Tellstrasse 31, 8004 Zürich',
  contactEmail: 'Contact@Livingdocs.io',
  language: 'de',
};

async function newLead() {
  const res = await api(app).post('/owner/leads').set(a.headers).send(lead).expect(201);
  return res.body.id as string;
}

describe('outreach (owner leads)', () => {
  it('is only for the operator: everyone else gets the same 404', async () => {
    await api(app).get('/owner/leads').set(b.headers).expect(404);
    await api(app).post('/owner/leads').set(b.headers).send(lead).expect(404);
    const id = await newLead();
    await api(app).get(`/owner/leads/${id}`).set(b.headers).expect(404);
    const list = await api(app).get('/owner/leads').set(a.headers).expect(200);
    expect(list.body.leads).toHaveLength(1);
    expect(list.body.leads[0]).toMatchObject({
      company: 'Livingdocs',
      contactEmail: 'contact@livingdocs.io',
      status: 'research',
      nextStep: 'write_first',
    });
  });

  it('imports researched leads at once, skipping companies and addresses already there', async () => {
    await newLead();
    const res = await api(app)
      .post('/owner/leads/import')
      .set(a.headers)
      .send({
        leads: [
          { company: 'Muster AG', contactEmail: 'Info@Muster.ch', whyNow: 'Ich habe gelesen …' },
          { company: ' livingdocs ' }, // already a lead
          { company: 'Other GmbH', contactEmail: 'contact@livingdocs.io' }, // same address
          { company: 'muster ag' }, // twice in the file
        ],
      })
      .expect(201);
    expect(res.body).toEqual({
      added: 1,
      skipped: ['livingdocs', 'Other GmbH', 'muster ag'],
    });
    const list = (await api(app).get('/owner/leads').set(a.headers).expect(200)).body.leads;
    expect(list.find((l: { company: string }) => l.company === 'Muster AG')).toMatchObject({
      contactEmail: 'info@muster.ch',
      status: 'research',
    });
    // only the operator; a status can't be imported (they all start as "research")
    await api(app)
      .post('/owner/leads/import')
      .set(b.headers)
      .send({ leads: [{ company: 'X' }] })
      .expect(404);
    await api(app)
      .post('/owner/leads/import')
      .set(a.headers)
      .send({ leads: [{ company: 'X', status: 'sent' }] })
      .expect(400);
  });

  it('only schedules a personal, short e-mail; sends it in the morning; follows up; stops on a reply', async () => {
    const id = await newLead();
    const draft = await api(app)
      .get(`/owner/leads/${id}/draft?kind=first`)
      .set(a.headers)
      .expect(200);
    expect(draft.body.body).toContain('Ich habe gesehen, dass Livingdocs weiter wächst.');
    // a placeholder left: refused
    await api(app)
      .post(`/owner/leads/${id}/messages`)
      .set(a.headers)
      .send({ kind: 'first', subject: 'x', body: 'Guten Tag [Name]' })
      .expect(400)
      .expect((r) => expect(r.body.code).toBe('placeholder'));
    // no follow-up before the first e-mail went out
    await api(app)
      .post(`/owner/leads/${id}/messages`)
      .set(a.headers)
      .send({ kind: 'follow_up', subject: 'x', body: 'Hallo' })
      .expect(409);

    const scheduled = await api(app)
      .post(`/owner/leads/${id}/messages`)
      .set(a.headers)
      .send({ kind: 'first', ...draft.body })
      .expect(201);
    const slot = new Date(scheduled.body.scheduledFor);
    expect([2, 3, 4]).toContain(slot.getUTCDay());
    // a second one while one is waiting: refused
    await api(app)
      .post(`/owner/leads/${id}/messages`)
      .set(a.headers)
      .send({ kind: 'first', ...draft.body })
      .expect(409);

    const leads = app.get(LeadsService);
    // before the slot: nothing goes out
    await leads.runOutreach(a.tenantId, new Date(slot.getTime() - 3600_000));
    expect(await sentMails()).toHaveLength(0);
    // the morning run after the slot sends it
    const morning = new Date(slot.getTime() + 30 * 60_000);
    expect(await leads.runOutreach(a.tenantId, morning)).toMatchObject({ sent: 1 });
    const [first] = (await sentMails()) as Array<Record<string, string>>;
    expect(first).toMatchObject({
      to: 'contact@livingdocs.io',
      subject: 'Wer sitzt wo bei Livingdocs?',
      fromName: 'Kimo Strupler · Seatline',
    });
    expect(first!.html).toContain('seatline-video.gif');
    expect(first!.messageId).toMatch(/^<.+@seatline\.ch>$/);
    let got = await api(app).get(`/owner/leads/${id}`).set(a.headers).expect(200);
    expect(got.body).toMatchObject({ status: 'sent' });

    // a week later: the operator gets one reminder; the follow-up answers the first e-mail
    await clearMails();
    const week = new Date(morning.getTime() + 7 * 864e5);
    expect(await leads.runOutreach(a.tenantId, week)).toMatchObject({ reminded: 1 });
    const [reminder] = await sentMails();
    expect(reminder).toMatchObject({ to: 'admin@alpha.example' });
    expect(reminder!.text).toContain(`/owner/leads?lead=${id}`);
    const followUp = await leads.draft(
      { tenantId: a.tenantId, actorId: a.adminId } as never,
      id,
      'follow_up',
    );
    expect(followUp.subject).toBe('Re: Wer sitzt wo bei Livingdocs?');
    const fu = await leads.schedule(
      { tenantId: a.tenantId, actorId: a.adminId } as never,
      id,
      { kind: 'follow_up', ...followUp },
      week,
    );

    // mail from the lead's domain that is no answer: a colleague's out-of-office, a newsletter.
    // Neither marks the lead "replied" nor cancels the follow-up.
    await mkdir(inbox(), { recursive: true });
    const mail = (name: string, m: object) => writeFile(join(inbox(), name), JSON.stringify(m));
    await mail('ooo.json', {
      from: 'contact@livingdocs.io',
      date: week.toISOString(),
      inReplyTo: first!.messageId,
      autoSubmitted: 'auto-replied',
    });
    await mail('news.json', { from: 'news@livingdocs.io', date: week.toISOString() });
    expect(await leads.runOutreach(a.tenantId, new Date(week.getTime() + 60_000))).toMatchObject({
      replied: 0,
    });
    // a colleague answers our e-mail before the follow-up goes out: the lead is "replied", the
    // follow-up is cancelled
    await mail('reply.json', {
      from: 'silvan@livingdocs.io',
      date: week.toISOString(),
      inReplyTo: `<other@example.com> ${first!.messageId}`,
    });
    await clearMails();
    const r = await leads.runOutreach(a.tenantId, new Date(fu.scheduledFor.getTime() + 60_000));
    expect(r).toMatchObject({ replied: 1, sent: 0 });
    expect(await sentMails()).toHaveLength(0);
    got = await api(app).get(`/owner/leads/${id}`).set(a.headers).expect(200);
    expect(got.body.status).toBe('replied');
    expect(
      got.body.messages.find((m: { kind: string }) => m.kind === 'follow_up').canceledAt,
    ).not.toBeNull();
  });

  it('a follow-up goes out as a reply; no answer for 14 days closes the lead; old "no" leads are deleted', async () => {
    const id = await newLead();
    const ctx = { tenantId: a.tenantId, actorId: a.adminId } as never;
    const leads = app.get(LeadsService);
    const start = new Date('2026-11-02T10:00:00Z'); // a Monday
    const draft = await leads.draft(ctx, id, 'first');
    const m1 = await leads.schedule(ctx, id, { kind: 'first', ...draft }, start);
    await leads.runOutreach(a.tenantId, new Date(m1.scheduledFor.getTime() + 60_000));
    const later = new Date(m1.scheduledFor.getTime() + 8 * 864e5);
    const fu = await leads.draft(ctx, id, 'follow_up');
    const m2 = await leads.schedule(ctx, id, { kind: 'follow_up', ...fu }, later);
    await leads.runOutreach(a.tenantId, new Date(m2.scheduledFor.getTime() + 60_000));
    const mails = (await sentMails()) as Array<Record<string, string>>;
    expect(mails).toHaveLength(2);
    expect(mails[1]!.inReplyTo).toBe(mails[0]!.messageId);
    // 14 days without an answer
    const r = await leads.runOutreach(a.tenantId, new Date(m2.scheduledFor.getTime() + 15 * 864e5));
    expect(r.closed).toBe(1);
    const got = await api(app).get(`/owner/leads/${id}`).set(a.headers).expect(200);
    expect(got.body.status).toBe('no_answer');
    // after 12 months, deleted (privacy)
    const year = new Date(Date.now() + 366 * 864e5);
    expect((await leads.runOutreach(a.tenantId, year)).deleted).toBe(1);
    await api(app).get(`/owner/leads/${id}`).set(a.headers).expect(404);
  });

  it('marking a lead "no" cancels what is scheduled, and the history lists every step', async () => {
    const id = await newLead();
    const draft = await api(app).get(`/owner/leads/${id}/draft?kind=first`).set(a.headers);
    await api(app)
      .post(`/owner/leads/${id}/messages`)
      .set(a.headers)
      .send({ kind: 'first', ...draft.body })
      .expect(201);
    await api(app).patch(`/owner/leads/${id}`).set(a.headers).send({ status: 'no' }).expect(200);
    // a lead reached by contact form: "sent" by hand starts the follow-up clock
    const form = await api(app)
      .post('/owner/leads')
      .set(a.headers)
      .send({ company: 'Yousty', channel: 'form' })
      .expect(201);
    const sent = await api(app)
      .patch(`/owner/leads/${form.body.id}`)
      .set(a.headers)
      .send({ status: 'sent' })
      .expect(200);
    expect(sent.body.firstSentAt).not.toBeNull();
    const got = await api(app).get(`/owner/leads/${id}`).set(a.headers).expect(200);
    expect(got.body.messages[0].canceledAt).not.toBeNull();
    const activity = await api(app).get('/activity').set(a.headers).expect(200);
    const actions = activity.body.items.map((e: { action: string }) => e.action);
    expect(actions).toEqual(
      expect.arrayContaining(['owner.lead.create', 'owner.lead.schedule', 'owner.lead.update']),
    );
  });

  it('sends right away when asked: at once, or a scheduled one with "Send now"', async () => {
    const id = await newLead();
    const draft = await api(app).get(`/owner/leads/${id}/draft?kind=first`).set(a.headers);
    const sent = await api(app)
      .post(`/owner/leads/${id}/messages`)
      .set(a.headers)
      .send({ kind: 'first', ...draft.body, sendNow: true })
      .expect(201);
    expect(sent.body.sentAt).not.toBeNull();
    expect(await sentMails()).toHaveLength(1);
    let got = await api(app).get(`/owner/leads/${id}`).set(a.headers).expect(200);
    expect(got.body.status).toBe('sent');

    // a scheduled follow-up, sent early by hand
    const leads = app.get(LeadsService);
    const ctx = { tenantId: a.tenantId, actorId: a.adminId } as never;
    const fu = await leads.draft(ctx, id, 'follow_up');
    const m = await leads.schedule(ctx, id, { kind: 'follow_up', ...fu });
    await api(app).post(`/owner/leads/${id}/messages/${m.id}/send`).set(b.headers).expect(404);
    await api(app).post(`/owner/leads/${id}/messages/${m.id}/send`).set(a.headers).expect(201);
    await api(app).post(`/owner/leads/${id}/messages/${m.id}/send`).set(a.headers).expect(409);
    const mails = (await sentMails()) as Array<Record<string, string>>;
    expect(mails).toHaveLength(2);
    expect(mails[1]!.inReplyTo).toBe(mails[0]!.messageId);
    got = await api(app).get(`/owner/leads/${id}`).set(a.headers).expect(200);
    expect(got.body.status).toBe('followed_up');
  });

  it('"send all": the filled-in first e-mail to every ready lead, then every scheduled one', async () => {
    const ready = await newLead();
    const send = (path: string, headers = a.headers) =>
      api(app).post(`/owner/leads/${path}`).set(headers);
    // not ready: no reason yet, or reached by hand (a form)
    await api(app)
      .post('/owner/leads/import')
      .set(a.headers)
      .send({
        leads: [
          { company: 'NoReason AG', contactEmail: 'info@noreason.ch' },
          { company: 'Form AG', whyNow: 'Neues Büro.', channel: 'form' },
          {
            company: 'Second AG',
            greeting: 'Frau Muster',
            whyNow: 'Sie ziehen um.',
            contactEmail: 'it@second.ch',
          },
        ],
      })
      .expect(201);
    await send('send-ready', b.headers).expect(404);
    const res = await send('send-ready').expect(201);
    expect(res.body).toEqual({ sent: 2, failed: [] });
    const mails = (await sentMails()) as Array<Record<string, string>>;
    expect(mails.map((m) => m.to).sort()).toEqual(['contact@livingdocs.io', 'it@second.ch']);
    expect((await api(app).get(`/owner/leads/${ready}`).set(a.headers)).body.status).toBe('sent');
    // nothing left to send: a second click sends nothing again
    expect((await send('send-ready').expect(201)).body).toEqual({ sent: 0, failed: [] });

    // scheduled follow-ups go out at once, one per lead
    const leads = app.get(LeadsService);
    const ctx = { tenantId: a.tenantId, actorId: a.adminId } as never;
    const fu = await leads.draft(ctx, ready, 'follow_up');
    await leads.schedule(ctx, ready, { kind: 'follow_up', ...fu });
    await send('send-scheduled', b.headers).expect(404);
    expect((await send('send-scheduled').expect(201)).body).toEqual({ sent: 1, failed: [] });
    expect(await sentMails()).toHaveLength(3);
    expect((await api(app).get(`/owner/leads/${ready}`).set(a.headers)).body.status).toBe(
      'followed_up',
    );
  });
});
