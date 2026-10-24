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

  it('only schedules a personal, short e-mail; sends it in the morning; follows up; stops on a reply', async () => {
    const id = await newLead();
    const draft = await api(app)
      .get(`/owner/leads/${id}/draft?kind=first`)
      .set(a.headers)
      .expect(200);
    expect(draft.body.body).toContain('an der Tellstrasse 31');
    // too long, or a placeholder left: refused
    await api(app)
      .post(`/owner/leads/${id}/messages`)
      .set(a.headers)
      .send({ kind: 'first', subject: 'x', body: 'word '.repeat(101) })
      .expect(400)
      .expect((r) => expect(r.body.code).toBe('too_long'));
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

    // they answer before it goes out: the lead is "replied", the follow-up is cancelled
    await mkdir(inbox(), { recursive: true });
    await writeFile(
      join(inbox(), 'reply.json'),
      JSON.stringify({ from: 'silvan@livingdocs.io', date: week.toISOString() }),
    );
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
});
