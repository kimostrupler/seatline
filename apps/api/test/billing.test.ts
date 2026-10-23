import type { INestApplication } from '@nestjs/common';
import Stripe from 'stripe';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { billingState } from '../src/billing/billing-state';
import { BillingService } from '../src/billing/billing.service';
import { startFakeStripe } from './fake-stripe';
import { clearMails, sentMails } from './mail';
import { TenantDb } from '../src/db/tenant-db.service';
import { api, appDb, createApp, createTenant, owner, resetDb, type Fixture } from './helpers';

const WEBHOOK_SECRET = 'whsec_test_secret';
let app: INestApplication;
let stripe: Awaited<ReturnType<typeof startFakeStripe>>;
let a: Fixture;
let b: Fixture;

beforeAll(async () => {
  stripe = await startFakeStripe();
  Object.assign(process.env, {
    STRIPE_SECRET_KEY: 'sk_test_fake',
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    STRIPE_PRICE_ID: 'price_seat',
    STRIPE_API_BASE: stripe.url,
    // the operator's own workspace (created only in its test)
    OWNER_EMAILS: 'Admin@Gamma.example',
  });
  app = await createApp();
});
afterAll(async () => {
  await app.close();
  stripe.close();
  await Promise.all([owner.$disconnect(), appDb.$disconnect()]);
});
beforeEach(async () => {
  await resetDb();
  stripe.calls.length = 0;
  a = await createTenant('alpha');
  b = await createTenant('beta');
});

const endTrial = (f: Fixture) =>
  owner.tenant.update({
    where: { id: f.tenantId },
    data: { trialEndsAt: new Date(Date.now() - 1000) },
  });
const assign = (f: Fixture) =>
  api(app)
    .post('/assignments')
    .set(f.headers)
    .send({ seatId: f.seatIds[0], personId: f.personIds[0] });
const me = async (f: Fixture) => (await api(app).get('/me').set(f.headers).expect(200)).body;

/** A Stripe webhook call, signed like Stripe signs it. */
function webhook(event: object, secret = WEBHOOK_SECRET) {
  const payload = JSON.stringify(event);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  return api(app)
    .post('/billing/webhook')
    .set('stripe-signature', header)
    .set('content-type', 'application/json')
    .send(payload);
}
const subscription = (f: Fixture, status: string, customer = 'cus_test') => ({
  id: 'evt_1',
  object: 'event',
  type: 'customer.subscription.updated',
  data: {
    object: {
      id: 'sub_1',
      object: 'subscription',
      customer,
      status,
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
      metadata: { tenantId: f.tenantId },
      items: { data: [{ id: 'si_test', quantity: 3 }] },
    },
  },
});

describe('billing', () => {
  it('free trial first; after it, the workspace is read-only (still readable)', async () => {
    expect((await me(a)).billing.state).toBe('trial');
    await assign(a).expect(201);

    await endTrial(a);
    expect((await me(a)).billing.state).toBe('read_only');
    const res = await api(app)
      .post('/assignments')
      .set(a.headers)
      .send({ seatId: a.seatIds[1], personId: a.personIds[1] })
      .expect(402);
    expect(res.body.code).toBe('billing_required');
    await api(app).get(`/floors/${a.floorId}/map`).set(a.headers).expect(200);
    // another workspace isn't affected
    await assign(b).expect(201);
  });

  it('the operator’s own workspace never pays nor locks', async () => {
    const mine = await createTenant('gamma');
    await endTrial(mine);
    expect((await me(mine)).billing.state).toBe('off');
    await assign(mine).expect(201);
    // everyone else's still does
    await endTrial(a);
    expect((await me(a)).billing.state).toBe('read_only');
  });

  it('subscribing: Stripe Checkout per active seat, then the webhook unlocks the workspace', async () => {
    await endTrial(a);
    const checkout = await api(app)
      .post('/billing/checkout')
      .set(a.headers)
      .send({ returnUrl: 'https://app.seatline.ch/billing' })
      .expect(201);
    expect(checkout.body.url).toBe('https://checkout.stripe.test/cs_test');
    const session = stripe.calls.find((c) => c.path === '/v1/checkout/sessions')!.body;
    expect(session).toMatchObject({
      mode: 'subscription',
      customer: 'cus_test',
      'line_items[0][price]': 'price_seat',
      'line_items[0][quantity]': '3',
      'subscription_data[metadata][tenantId]': a.tenantId,
      success_url: 'https://app.seatline.ch/billing?checkout=done',
    });
    expect(session['subscription_data[trial_end]']).toBeUndefined(); // the trial is over

    await webhook(subscription(a, 'active'), 'whsec_wrong').expect(400);
    await webhook(subscription(a, 'active')).expect(200);
    expect((await me(a)).billing.state).toBe('active');
    await assign(a).expect(201);

    const overview = (await api(app).get('/billing').set(a.headers).expect(200)).body;
    expect(overview).toMatchObject({
      configured: true,
      state: 'active',
      subscribed: true,
      seats: 3,
      billedSeats: 3,
      price: { amount: 2, currency: 'chf', interval: 'month' },
    });

    await webhook({ ...subscription(a, 'canceled'), type: 'customer.subscription.deleted' }).expect(
      200,
    );
    expect((await me(a)).billing.state).toBe('read_only');
  });

  it('subscribing during the trial keeps the rest of the trial', async () => {
    await api(app)
      .post('/billing/checkout')
      .set(a.headers)
      .send({ returnUrl: 'https://app.seatline.ch/billing' })
      .expect(201);
    const session = stripe.calls.find((c) => c.path === '/v1/checkout/sessions')!.body;
    expect(Number(session['subscription_data[trial_end]'])).toBeGreaterThan(
      Date.now() / 1000 + 20 * 86400,
    );
  });

  it('a webhook can only change the workspace’s own subscription', async () => {
    await owner.tenant.update({
      where: { id: a.tenantId },
      data: { stripeCustomerId: 'cus_real' },
    });
    await endTrial(a);
    await webhook(subscription(a, 'active', 'cus_someone_else')).expect(200);
    expect((await me(a)).billing.state).toBe('read_only');
  });

  it('the nightly job bills for the seats there really are', async () => {
    await webhook(subscription(a, 'active')).expect(200);
    await owner.seat.create({
      data: { tenantId: a.tenantId, floorId: a.floorId, label: 'A4', x: 5, y: 5 },
    });
    const result = await app.get(BillingService).syncSeats(a.tenantId);
    expect(result).toEqual({ changed: true, seats: 4 });
    const update = stripe.calls.find(
      (c) => c.method === 'POST' && c.path === '/v1/subscriptions/sub_1',
    );
    expect(update?.body).toMatchObject({
      'items[0][quantity]': '4',
      proration_behavior: 'create_prorations',
    });
    expect((await app.get(BillingService).syncSeats(a.tenantId)).changed).toBe(false);
  });

  it('admins only; return addresses must be our own pages', async () => {
    await api(app).get('/billing').set(a.viewerHeaders).expect(403);
    await api(app)
      .post('/billing/checkout')
      .set(a.viewerHeaders)
      .send({ returnUrl: 'https://app.seatline.ch/billing' })
      .expect(403);
    await api(app)
      .post('/billing/checkout')
      .set(a.headers)
      .send({ returnUrl: 'http://evil.example/billing' })
      .expect(400);
    await api(app)
      .post('/billing/portal')
      .set(a.headers)
      .send({ returnUrl: 'https://app.seatline.ch/billing' })
      .expect(400); // no customer yet
  });

  it('states', () => {
    const future = new Date(Date.now() + 1000);
    const past = new Date(Date.now() - 1000);
    expect(billingState({ configured: false, trialEndsAt: past, status: null })).toBe('off');
    expect(billingState({ configured: true, trialEndsAt: future, status: null })).toBe('trial');
    expect(billingState({ configured: true, trialEndsAt: past, status: null })).toBe('read_only');
    expect(billingState({ configured: true, trialEndsAt: past, status: 'past_due' })).toBe(
      'past_due',
    );
    expect(billingState({ configured: true, trialEndsAt: past, status: 'unpaid' })).toBe(
      'read_only',
    );
    expect(billingState({ configured: true, trialEndsAt: past, status: 'trialing' })).toBe(
      'active',
    );
  });

  it('reminds the admins 7 days and 1 day before the trial ends, each once', async () => {
    await clearMails();
    const billing = app.get(BillingService);
    const endsIn = (days: number) =>
      owner.tenant.update({
        where: { id: a.tenantId },
        data: { trialEndsAt: new Date(Date.now() + days * 86_400_000 - 60_000) },
      });
    await endsIn(20);
    expect(await app.get(TenantDb).listTrialTenants()).not.toContain(a.tenantId);
    await endsIn(7);
    expect(await app.get(TenantDb).listTrialTenants()).toContain(a.tenantId);
    expect(await billing.remindTrial(a.tenantId)).toBe(7);
    expect(await billing.remindTrial(a.tenantId)).toBeNull(); // only once
    await endsIn(1);
    expect(await billing.remindTrial(a.tenantId)).toBe(1);
    const mails = (await sentMails()).filter((m) => m.to === 'admin@alpha.example');
    expect(mails.map((m) => m.subject)).toEqual([
      'Ihre Seatline-Testphase endet in 7 Tagen',
      'Ihre Seatline-Testphase endet morgen',
    ]);
    expect(mails[0]!.text).toContain('https://app.seatline.test/billing');
    // a subscribed workspace gets nothing
    await owner.tenant.update({
      where: { id: b.tenantId },
      data: { stripeSubscriptionId: 'sub_b', trialEndsAt: new Date(Date.now() + 86_400_000) },
    });
    expect(await app.get(TenantDb).listTrialTenants()).not.toContain(b.tenantId);
    expect(await billing.remindTrial(b.tenantId)).toBeNull();
  });
});
