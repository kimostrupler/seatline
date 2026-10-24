import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

export type Tx = Prisma.TransactionClient;

/**
 * The only way feature code talks to the database. Each call is one transaction with
 * app.tenant_id set, so RLS limits every statement to that tenant. Queries must still
 * filter by tenantId themselves — RLS is the safety net, not the plan.
 */
@Injectable()
export class TenantDb {
  constructor(private readonly prisma: PrismaService) {}

  /** Which workspace belongs to a Microsoft 365 tenant (works before we know the tenant). */
  async resolveTenant(entraTenantId: string): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<{ id: string | null }[]>`
      SELECT resolve_tenant(${entraTenantId}::uuid) AS id`;
    return rows[0]?.id ?? null;
  }

  /** Every workspace where someone has this e-mail address (e-mail sign-in, before the tenant is known). */
  emailWorkspaces(email: string) {
    return this.prisma.$queryRaw<{ tenant_id: string; name: string; microsoft: boolean }[]>`
      SELECT tenant_id, name, microsoft FROM email_workspaces(${email})`;
  }

  /** Stores a sign-in link's hash; false when this address asked for too many links lately. */
  async createEmailSignIn(email: string, tokenHash: string, minutes: number, maxRecent: number) {
    const rows = await this.prisma.$queryRaw<{ ok: boolean }[]>`
      SELECT email_sign_in_create(${email}, ${tokenHash}, make_interval(mins => ${minutes}::int), ${maxRecent}::int) AS ok`;
    return rows[0]?.ok === true;
  }

  /** Uses a sign-in link once: its e-mail address while valid, else null. */
  async useEmailSignIn(tokenHash: string): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<{ email: string | null }[]>`
      SELECT email_sign_in_use(${tokenHash}) AS email`;
    return rows[0]?.email ?? null;
  }

  /** Workspaces connected to Microsoft 365 (for the nightly people sync). */
  listSyncTenants() {
    return this.prisma.$queryRaw<{ id: string; entra_tenant_id: string }[]>`
      SELECT id, entra_tenant_id FROM list_sync_tenants()`;
  }

  /** Workspaces with a Stripe subscription. */
  async listBilledTenants(): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<
      { id: string }[]
    >`SELECT id FROM list_billed_tenants()`;
    return rows.map((r) => r.id);
  }

  /** Owner dashboard only: every workspace with counts (see the owner_workspaces function). */
  /** Owner dashboard: database size and its biggest tables (Postgres' own figures). */
  async databaseUsage() {
    const [[db], tables] = await Promise.all([
      this.prisma.$queryRaw<{ bytes: bigint }[]>`
        SELECT pg_database_size(current_database()) AS bytes`,
      this.prisma.$queryRaw<{ name: string; bytes: bigint; rows: number }[]>`
        SELECT c.relname AS name, pg_total_relation_size(c.oid) AS bytes,
               c.reltuples::float8 AS rows
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r' AND n.nspname IN ('public', 'pgboss')
        ORDER BY 2 DESC LIMIT 6`,
    ]);
    return {
      bytes: Number(db?.bytes ?? 0),
      tables: tables.map((t) => ({
        name: t.name,
        bytes: Number(t.bytes),
        rows: t.rows >= 0 ? Math.round(t.rows) : null, // -1 = not counted by Postgres yet
      })),
    };
  }

  ownerWorkspaces() {
    return this.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        created_at: Date;
        is_demo: boolean;
        microsoft: boolean;
        people: bigint;
        seats: bigint;
        seated: bigint;
        billing_status: string | null;
        trial_ends_at: Date;
        billed_seats: number | null;
        subscribed: boolean;
        last_activity: Date | null;
        admin_emails: string[];
      }>
    >`SELECT * FROM owner_workspaces()`;
  }

  /** Owner only: delete one whole workspace, history included (see delete_tenant). */
  async deleteTenant(tenantId: string): Promise<boolean> {
    const [row] = await this.prisma.$queryRaw<{ ok: boolean }[]>`
      SELECT delete_tenant(${tenantId}::uuid) AS ok`;
    return row?.ok === true;
  }

  /** The database answers (health check). */
  async ping(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }

  /** How many demo workspaces exist right now. */
  async countDemoTenants(): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ n: bigint }[]>`SELECT count_demo_tenants() AS n`;
    return Number(row?.n ?? 0);
  }

  /** Demo workspaces older than `olderThan`: the ones the next purge deletes. */
  async listOldDemoTenants(olderThan: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM list_old_demo_tenants(${olderThan}::interval)`;
    return rows.map((r) => r.id);
  }

  /** Delete demo workspaces older than `olderThan` (a Postgres interval, e.g. '1 day'). */
  async purgeDemoTenants(olderThan: string): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ n: number }[]>`
      SELECT purge_demo_tenants(${olderThan}::interval) AS n`;
    return row?.n ?? 0;
  }

  /** Workspaces whose free trial ends within 8 days, without a subscription. */
  async listTrialTenants(): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM list_trial_tenants()`;
    return rows.map((r) => r.id);
  }

  /** New workspaces (last 10 days) still waiting for an onboarding e-mail. */
  async listOnboardingTenants(): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM list_onboarding_tenants()`;
    return rows.map((r) => r.id);
  }

  /** The morning job: workspaces with outreach leads (the operator's). */
  async listOutreachTenants(): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM list_outreach_tenants()`;
    return rows.map((r) => r.id);
  }

  /** Workspaces that limit how long history is kept (months). */
  listRetentionTenants() {
    return this.prisma.$queryRaw<{ id: string; months: number }[]>`
      SELECT id, months FROM list_retention_tenants()`;
  }

  /** Workspaces with someone whose leaving date (HR) is `day` or earlier. */
  async listLeavingTenants(day: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM list_leaving_tenants(${day}::date)`;
    return rows.map((r) => r.id);
  }

  /** Workspaces with scheduled move plans due by `day` (YYYY-MM-DD). */
  async listDueMoveTenants(day: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM list_due_move_tenants(${day}::date)`;
    return rows.map((r) => r.id);
  }

  run<T>(
    tenantId: string,
    fn: (tx: Tx) => Promise<T>,
    options?: { timeoutMs?: number },
  ): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
        return fn(tx);
      },
      // long-running work (people sync of a large organisation) can ask for more time
      { timeout: options?.timeoutMs ?? 5_000, maxWait: 10_000 },
    );
  }
}
