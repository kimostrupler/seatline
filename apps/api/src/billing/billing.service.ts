import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import Stripe from 'stripe';
import type { RequestContext } from '../auth/request-context';
import { audit } from '../common/audit';
import { orNotFound } from '../common/errors';
import { loadConfig } from '../config';
import { TenantDb } from '../db/tenant-db.service';
import { MailService } from '../mail/mail.service';
import { trialMail } from '../mail/texts';
import type { MailLanguage } from '@seatline/shared';
import { billingState } from './billing-state';

/** Which trial reminder is due (7 or 1 days left), or null; each is sent once. */
export function trialReminderDue(daysLeft: number, reminded: number | null): 7 | 1 | null {
  if (daysLeft < 1) return null;
  if (daysLeft <= 1) return reminded === 1 ? null : 1;
  if (daysLeft <= 7) return reminded == null ? 7 : null;
  return null;
}

const billingSelect = {
  id: true,
  name: true,
  trialEndsAt: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  billingStatus: true,
  billingPeriodEnd: true,
  billedSeats: true,
  isDemo: true,
} as const;

/** Return URLs from Stripe must be our own pages (https, or localhost while developing). */
function checkReturnUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BadRequestException('Invalid return address');
  }
  const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (!(parsed.protocol === 'https:' || local) || !parsed.pathname.startsWith('/billing'))
    throw new BadRequestException('Invalid return address');
  return parsed.toString();
}

/**
 * Billing with Stripe: one subscription per workspace, priced per active seat per month.
 * Card details only ever go to Stripe (Checkout and the customer portal). Stripe tells us about
 * changes through the webhook; the nightly job keeps the billed seat count in step.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly config = loadConfig();
  private client: Stripe | null = null;
  private price: Promise<Stripe.Price> | null = null;

  constructor(
    private readonly db: TenantDb,
    private readonly mail: MailService,
  ) {}

  /**
   * Nightly: remind the admins that the free trial ends soon — 7 days before, then the day
   * before (each once). Workspaces with a subscription get nothing.
   */
  async remindTrial(tenantId: string, now = new Date()): Promise<number | null> {
    if (!this.configured || !this.mail.configured) return null;
    const { tenant, admins } = await this.db.run(tenantId, async (tx) => ({
      tenant: await tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: {
          name: true,
          trialEndsAt: true,
          trialReminded: true,
          stripeSubscriptionId: true,
          notifyLanguage: true,
        },
      }),
      admins: await tx.person.findMany({
        where: { tenantId, appRole: 'admin', active: true, forgottenAt: null },
        select: { email: true },
      }),
    }));
    if (tenant.stripeSubscriptionId) return null;
    const left = Math.ceil((tenant.trialEndsAt.getTime() - now.getTime()) / 86_400_000);
    const due = trialReminderDue(left, tenant.trialReminded);
    if (!due || !admins.length) return null;
    const link = `${this.mail.appUrl}/billing`;
    for (const admin of admins)
      await this.mail.send(
        trialMail(admin.email, tenant.name, left, link, tenant.notifyLanguage as MailLanguage),
      );
    await this.db.run(tenantId, (tx) =>
      tx.tenant.update({ where: { id: tenantId }, data: { trialReminded: due } }),
    );
    return due;
  }

  /**
   * Owner dashboard: subscriptions by status, monthly recurring revenue, balance, payments of the
   * last 30 days and the latest ones. Straight from Stripe (no caching: it's for one person).
   */
  async ownerSummary() {
    if (!this.configured) return null;
    const stripe = this.stripe();
    const since = Math.floor(Date.now() / 1000) - 30 * 86_400;
    const [subs, balance, invoices] = await Promise.all([
      stripe.subscriptions.list({ status: 'all', limit: 100 }),
      stripe.balance.retrieve(),
      stripe.invoices.list({ status: 'paid', created: { gte: since }, limit: 100 }),
    ]);
    const byStatus: Record<string, number> = {};
    let mrr = 0;
    let currency = 'chf';
    for (const sub of subs.data) {
      byStatus[sub.status] = (byStatus[sub.status] ?? 0) + 1;
      if (sub.status !== 'active' && sub.status !== 'past_due') continue;
      for (const item of sub.items.data) {
        const price = item.price;
        currency = price.currency;
        const months =
          price.recurring?.interval === 'year'
            ? 12
            : price.recurring?.interval === 'week'
              ? 0.25
              : 1;
        mrr += ((price.unit_amount ?? 0) * (item.quantity ?? 1)) / months;
      }
    }
    const sum = (list: Array<{ amount: number; currency: string }>) =>
      list.filter((b) => b.currency === currency).reduce((n, b) => n + b.amount, 0);
    return {
      currency: currency.toUpperCase(),
      /** amounts in the currency's main unit (francs), not cents */
      mrr: Math.round(mrr) / 100,
      subscriptions: byStatus,
      balance: { available: sum(balance.available) / 100, pending: sum(balance.pending) / 100 },
      paidLast30Days: invoices.data.reduce((n, i) => n + i.amount_paid, 0) / 100,
      payments: invoices.data.slice(0, 10).map((i) => ({
        id: i.id,
        amount: i.amount_paid / 100,
        currency: i.currency.toUpperCase(),
        customer: i.customer_name ?? i.customer_email ?? null,
        tenantId: (i.subscription_details?.metadata?.tenantId as string | undefined) ?? null,
        at: new Date(i.created * 1000).toISOString(),
      })),
      live: !this.config.STRIPE_SECRET_KEY!.startsWith('sk_test_'),
    };
  }

  get configured() {
    const c = this.config;
    return !!(c.STRIPE_SECRET_KEY && c.STRIPE_WEBHOOK_SECRET && c.STRIPE_PRICE_ID);
  }

  private stripe(): Stripe {
    if (!this.configured) throw new ServiceUnavailableException('Billing is not set up');
    if (!this.client) {
      const base = this.config.STRIPE_API_BASE ? new URL(this.config.STRIPE_API_BASE) : null;
      this.client = new Stripe(this.config.STRIPE_SECRET_KEY!, {
        ...(base && {
          host: base.hostname,
          port: Number(base.port),
          protocol: base.protocol.replace(':', '') as 'http' | 'https',
        }),
        maxNetworkRetries: 2,
        appInfo: { name: 'Seatline' },
      });
    }
    return this.client;
  }

  /** The per-seat price, as shown to admins (fetched once from Stripe). */
  private async priceInfo() {
    if (!this.configured) return null;
    this.price ??= this.stripe().prices.retrieve(this.config.STRIPE_PRICE_ID!);
    try {
      const p = await this.price;
      return {
        amount: (p.unit_amount ?? 0) / 100,
        currency: p.currency,
        interval: p.recurring?.interval ?? 'month',
      };
    } catch (error) {
      this.price = null;
      this.logger.warn(`Could not load the Stripe price: ${String(error)}`);
      return null;
    }
  }

  /** The state the guard and the banner use (cheap: one row). */
  async state(tenantId: string) {
    const t = await this.db.run(tenantId, (tx) =>
      tx.tenant.findFirst({ where: { id: tenantId }, select: billingSelect }),
    );
    if (!t || t.isDemo) return 'off' as const; // demo workspaces never pay nor lock
    return billingState({
      configured: this.configured,
      trialEndsAt: t.trialEndsAt,
      status: t.billingStatus,
    });
  }

  /** Admins: everything the billing page shows. */
  async overview(ctx: RequestContext) {
    const [t, seats] = await this.db.run(ctx.tenantId, (tx) =>
      Promise.all([
        tx.tenant.findFirst({ where: { id: ctx.tenantId }, select: billingSelect }),
        tx.seat.count({ where: { tenantId: ctx.tenantId, status: 'active' } }),
      ]),
    );
    const tenant = orNotFound(t, 'Workspace');
    return {
      configured: this.configured,
      state: billingState({
        configured: this.configured,
        trialEndsAt: tenant.trialEndsAt,
        status: tenant.billingStatus,
      }),
      trialEndsAt: tenant.trialEndsAt,
      status: tenant.billingStatus,
      periodEnd: tenant.billingPeriodEnd,
      subscribed: !!tenant.stripeSubscriptionId,
      seats: Math.max(1, seats),
      billedSeats: tenant.billedSeats,
      price: await this.priceInfo(),
    };
  }

  /** Admins: a Stripe Checkout page to start the subscription (keeps the rest of the trial). */
  async checkout(ctx: RequestContext, returnUrl: string) {
    const back = checkReturnUrl(returnUrl);
    const stripe = this.stripe();
    const { tenant, seats, admin } = await this.db.run(ctx.tenantId, async (tx) => ({
      tenant: orNotFound(
        await tx.tenant.findFirst({ where: { id: ctx.tenantId }, select: billingSelect }),
        'Workspace',
      ),
      seats: await tx.seat.count({ where: { tenantId: ctx.tenantId, status: 'active' } }),
      admin: await tx.person.findFirst({ where: { id: ctx.actorId }, select: { email: true } }),
    }));
    if (tenant.isDemo)
      throw new ConflictException({
        message: 'This is a demo workspace — start a free trial with your own account',
        code: 'demo',
      });
    let customer = tenant.stripeCustomerId;
    if (!customer) {
      customer = (
        await stripe.customers.create({
          name: tenant.name,
          email: admin?.email,
          metadata: { tenantId: tenant.id },
        })
      ).id;
      await this.db.run(ctx.tenantId, (tx) =>
        tx.tenant.update({ where: { id: tenant.id }, data: { stripeCustomerId: customer } }),
      );
    }
    // Stripe wants a trial end at least 2 days ahead; otherwise billing starts right away
    const trialLeft = tenant.trialEndsAt.getTime() - Date.now() > 2 * 86_400_000;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: tenant.id,
      line_items: [{ price: this.config.STRIPE_PRICE_ID!, quantity: Math.max(1, seats) }],
      subscription_data: {
        metadata: { tenantId: tenant.id },
        ...(trialLeft && { trial_end: Math.floor(tenant.trialEndsAt.getTime() / 1000) }),
      },
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      customer_update: { name: 'auto', address: 'auto' },
      success_url: `${back}?checkout=done`,
      cancel_url: back,
    });
    await this.db.run(ctx.tenantId, (tx) =>
      audit(tx, ctx, {
        action: 'billing.checkout',
        entityType: 'tenant',
        entityId: ctx.tenantId,
        after: { seats: Math.max(1, seats) },
      }),
    );
    return { url: session.url };
  }

  /** Admins: Stripe's customer portal (card, invoices, cancel). */
  async portal(ctx: RequestContext, returnUrl: string) {
    const back = checkReturnUrl(returnUrl);
    const tenant = await this.db.run(ctx.tenantId, (tx) =>
      tx.tenant.findFirst({ where: { id: ctx.tenantId }, select: billingSelect }),
    );
    if (!tenant?.stripeCustomerId) throw new BadRequestException('There is no subscription yet');
    const session = await this.stripe().billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: back,
    });
    return { url: session.url };
  }

  /** Stripe → us: subscription created/changed/ended. Verified with the webhook secret. */
  async webhook(rawBody: Buffer | undefined, signature: string | undefined) {
    if (!rawBody || !signature) throw new BadRequestException('Missing signature');
    let event: Stripe.Event;
    try {
      event = this.stripe().webhooks.constructEvent(
        rawBody,
        signature,
        this.config.STRIPE_WEBHOOK_SECRET!,
      );
    } catch {
      throw new BadRequestException('Invalid signature');
    }
    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    )
      await this.applySubscription(event.data.object);
    return { received: true };
  }

  private async applySubscription(sub: Stripe.Subscription) {
    const tenantId = sub.metadata?.tenantId;
    if (!tenantId) return;
    const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    await this.db.run(tenantId, async (tx) => {
      const tenant = await tx.tenant.findFirst({ where: { id: tenantId }, select: billingSelect });
      // only the workspace's own customer can change it
      if (!tenant || (tenant.stripeCustomerId && tenant.stripeCustomerId !== customer)) return;
      const ended = sub.status === 'canceled' || sub.status === 'incomplete_expired';
      const data = {
        stripeCustomerId: customer,
        stripeSubscriptionId: ended ? null : sub.id,
        billingStatus: sub.status,
        billingPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
        billedSeats: ended ? null : (sub.items?.data[0]?.quantity ?? null),
      };
      await tx.tenant.update({ where: { id: tenantId }, data });
      await audit(
        tx,
        { tenantId, actorId: null },
        {
          action: 'billing.subscription',
          entityType: 'tenant',
          entityId: tenantId,
          before: { status: tenant.billingStatus },
          after: { status: sub.status, seats: data.billedSeats },
        },
      );
    });
  }

  /** Nightly: bill for the seats there really are (Stripe prorates the difference). */
  async syncSeats(tenantId: string) {
    const { tenant, seats } = await this.db.run(tenantId, async (tx) => ({
      tenant: await tx.tenant.findFirst({ where: { id: tenantId }, select: billingSelect }),
      seats: Math.max(1, await tx.seat.count({ where: { tenantId, status: 'active' } })),
    }));
    if (!tenant?.stripeSubscriptionId || tenant.billedSeats === seats)
      return { changed: false, seats };
    const stripe = this.stripe();
    const sub = await stripe.subscriptions.retrieve(tenant.stripeSubscriptionId);
    const item = sub.items.data[0];
    if (!item) return { changed: false, seats };
    await stripe.subscriptions.update(sub.id, {
      items: [{ id: item.id, quantity: seats }],
      proration_behavior: 'create_prorations',
    });
    await this.db.run(tenantId, async (tx) => {
      await tx.tenant.update({ where: { id: tenantId }, data: { billedSeats: seats } });
      await audit(
        tx,
        { tenantId, actorId: null },
        {
          action: 'billing.seats',
          entityType: 'tenant',
          entityId: tenantId,
          before: { seats: tenant.billedSeats },
          after: { seats },
        },
      );
    });
    return { changed: true, seats };
  }
}
