import { Injectable, NotFoundException } from '@nestjs/common';
import type { RequestContext } from '../auth/request-context';
import { BillingService } from '../billing/billing.service';
import { loadConfig } from '../config';
import { TenantDb } from '../db/tenant-db.service';
import { AzureCostService } from './azure-cost';

const DAY = 86_400_000;

/**
 * The operator's dashboard: every workspace (sign-ups, use, billing state), Stripe and Azure.
 * Only for OWNER_EMAILS; everyone else gets the same 404 as a page that doesn't exist.
 */
@Injectable()
export class OwnerService {
  private readonly config = loadConfig();

  constructor(
    private readonly db: TenantDb,
    private readonly billing: BillingService,
    private readonly costs: AzureCostService,
  ) {}

  /** The caller is the operator — else a plain "not found" (nobody learns the page exists). */
  async assertOwner(ctx: RequestContext, path: string) {
    const person = await this.db.run(ctx.tenantId, (tx) =>
      tx.person.findFirst({
        where: { id: ctx.actorId, tenantId: ctx.tenantId, active: true },
        select: { email: true, tenant: { select: { entraTenantId: true } } },
      }),
    );
    const email = person?.email.toLowerCase();
    // Only in a workspace that signs in by e-mail link: there the address is proven (the link
    // went to it). A Microsoft directory could give any user any e-mail address.
    if (!email || person?.tenant.entraTenantId || !this.config.OWNER_EMAILS.includes(email))
      throw new NotFoundException({
        message: `Cannot GET ${path}`,
        error: 'Not Found',
        statusCode: 404,
      });
  }

  async overview() {
    const now = Date.now();
    const [rows, stripe, azure] = await Promise.all([
      this.db.ownerWorkspaces(),
      this.billing.ownerSummary().catch(() => ({ error: 'unavailable' as const })),
      this.costs.summary(),
    ]);
    const workspaces = rows.map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: r.created_at.toISOString(),
      demo: r.is_demo,
      signIn: r.microsoft ? ('microsoft' as const) : ('email' as const),
      people: Number(r.people),
      seats: Number(r.seats),
      seated: Number(r.seated),
      billingStatus: r.billing_status,
      trialEndsAt: r.trial_ends_at.toISOString(),
      billedSeats: r.billed_seats,
      subscribed: r.subscribed,
      lastActivity: r.last_activity?.toISOString() ?? null,
      admins: r.admin_emails,
    }));
    const real = workspaces.filter((w) => !w.demo);
    const since = (days: number) => real.filter((w) => now - Date.parse(w.createdAt) < days * DAY);
    const days = Array.from({ length: 30 }, (_, i) =>
      new Date(now - (29 - i) * DAY).toISOString().slice(0, 10),
    );
    return {
      at: new Date(now).toISOString(),
      totals: {
        workspaces: real.length,
        last7Days: since(7).length,
        last30Days: since(30).length,
        paying: real.filter((w) => w.subscribed && w.billingStatus === 'active').length,
        inTrial: real.filter((w) => !w.subscribed && Date.parse(w.trialEndsAt) > now).length,
        trialEnded: real.filter((w) => !w.subscribed && Date.parse(w.trialEndsAt) <= now).length,
        activeLast7Days: real.filter(
          (w) => w.lastActivity && now - Date.parse(w.lastActivity) < 7 * DAY,
        ).length,
        people: real.reduce((n, w) => n + w.people, 0),
        seats: real.reduce((n, w) => n + w.seats, 0),
        demosOpen: workspaces.length - real.length,
      },
      signupsPerDay: days.map((day) => ({
        day,
        count: real.filter((w) => w.createdAt.slice(0, 10) === day).length,
      })),
      workspaces,
      stripe,
      azure,
    };
  }
}
