import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { RequestContext } from '../auth/request-context';
import { BillingService } from '../billing/billing.service';
import { loadConfig } from '../config';
import { audit } from '../common/audit';
import { TenantDb } from '../db/tenant-db.service';
import { StorageService } from '../storage/storage.service';
import { AzureCostService } from './azure-cost';

const DAY = 86_400_000;
/** The database server's disk (infra/azure/main.bicep `storageSizeGB`). */
const DB_DISK_GB = 32;

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
    private readonly storage: StorageService,
  ) {}
  private readonly logger = new Logger(OwnerService.name);
  private files: { at: number; value: Awaited<ReturnType<StorageService['usage']>> } | null = null;

  /** Database and file storage right now (files are listed at most every 15 minutes). */
  private async usage() {
    const database = await this.db.databaseUsage();
    if (!this.files || Date.now() - this.files.at > 15 * 60_000) {
      try {
        this.files = { at: Date.now(), value: await this.storage.usage() };
      } catch (error) {
        this.logger.warn(`File storage could not be listed: ${(error as Error).message}`);
      }
    }
    return {
      database: { ...database, diskBytes: DB_DISK_GB * 1024 ** 3 },
      files: this.files?.value ?? null,
    };
  }

  /** The caller is the operator — else a plain "not found" (nobody learns the page exists). */
  async assertOwner(ctx: RequestContext, path: string) {
    const person = await this.db.run(ctx.tenantId, (tx) =>
      tx.person.findFirst({
        where: { id: ctx.actorId, tenantId: ctx.tenantId, active: true },
        select: {
          email: true,
          tenant: { select: { entraTenantId: true, preparedByOwner: true } },
        },
      }),
    );
    const email = person?.email.toLowerCase();
    // Only in a workspace that signs in by e-mail link: there the address is proven (the link
    // went to it). A Microsoft directory could give any user any e-mail address.
    // …and only in the operator's own workspace, not in one being set up for a lead
    if (
      !email ||
      person?.tenant.entraTenantId ||
      person?.tenant.preparedByOwner ||
      !this.config.OWNER_EMAILS.includes(email)
    )
      throw new NotFoundException({
        message: `Cannot GET ${path}`,
        error: 'Not Found',
        statusCode: 404,
      });
  }

  /**
   * Support: delete a whole workspace (people, floors, seat history, files). Not the caller's
   * own, not one with a running subscription (cancel it in Stripe first), and only when the
   * typed name matches. Recorded in the operator's own activity log.
   */
  async deleteWorkspace(ctx: RequestContext, tenantId: string, typedName: string) {
    if (tenantId === ctx.tenantId)
      throw new ConflictException({
        message: 'You can’t delete the workspace you’re signed in to',
        code: 'own_workspace',
      });
    const tenant = await this.db.run(tenantId, (tx) =>
      tx.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, stripeSubscriptionId: true, billingStatus: true },
      }),
    );
    if (!tenant) throw new NotFoundException('Workspace not found');
    if (typedName.trim() !== tenant.name.trim())
      throw new BadRequestException({
        message: 'The name doesn’t match',
        code: 'name_mismatch',
      });
    const ended = ['canceled', 'incomplete_expired'];
    if (tenant.stripeSubscriptionId && !ended.includes(tenant.billingStatus ?? ''))
      throw new ConflictException({
        message: 'This workspace has a subscription — cancel it in Stripe first',
        code: 'subscribed',
      });
    // the trace first, then the rows, then the files: if Blob Storage fails, the deletion is
    // still on record and the log names the folder to clean up
    await this.db.run(ctx.tenantId, (tx) =>
      audit(tx, ctx, {
        action: 'owner.workspace.delete',
        entityType: 'tenant',
        entityId: tenantId,
        before: { name: tenant.name },
      }),
    );
    await this.db.deleteTenant(tenantId);
    try {
      await this.storage.deletePrefix(`${tenantId}/`);
    } catch (error) {
      this.logger.error(`Workspace ${tenantId} deleted, but its files were not: ${String(error)}`);
    }
    this.logger.log(`Workspace deleted by the operator: ${tenantId}`);
  }

  /** No more onboarding tips for this workspace (its admin replied "stop"). */
  async stopTips(ctx: RequestContext, tenantId: string) {
    const tenant = await this.db.run(tenantId, (tx) =>
      tx.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
    );
    if (!tenant) throw new NotFoundException('Workspace not found');
    await this.db.run(tenantId, (tx) =>
      tx.tenant.update({ where: { id: tenantId }, data: { onboardingSent: 7 } }),
    );
    await this.db.run(ctx.tenantId, (tx) =>
      audit(tx, ctx, {
        action: 'owner.workspace.stop_tips',
        entityType: 'tenant',
        entityId: tenantId,
        after: { name: tenant.name },
      }),
    );
  }

  async overview() {
    const now = Date.now();
    const [rows, stripe, azure, usage] = await Promise.all([
      this.db.ownerWorkspaces(),
      this.billing.ownerSummary().catch((error: Error) => {
        // Stripe's own reason (e.g. a restricted key without read access to balance/invoices)
        this.logger.warn(`Stripe could not be read: ${error.message}`);
        return { error: 'unavailable' as const, detail: error.message };
      }),
      this.costs.summary(),
      this.usage(),
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
      // the operator's own workspace: free, never a trial (same rule as BillingService)
      owner:
        !r.microsoft &&
        r.admin_emails.some((e) => this.config.OWNER_EMAILS.includes(e.toLowerCase())),
    }));
    const real = workspaces.filter((w) => !w.demo);
    const billable = real.filter((w) => !w.owner);
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
        inTrial: billable.filter((w) => !w.subscribed && Date.parse(w.trialEndsAt) > now).length,
        trialEnded: billable.filter((w) => !w.subscribed && Date.parse(w.trialEndsAt) <= now)
          .length,
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
      usage,
    };
  }
}
