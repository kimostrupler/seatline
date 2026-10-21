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

  /** Workspaces connected to Microsoft 365 (for the nightly people sync). */
  listSyncTenants() {
    return this.prisma.$queryRaw<{ id: string; entra_tenant_id: string }[]>`
      SELECT id, entra_tenant_id FROM list_sync_tenants()`;
  }

  /** Workspaces that limit how long history is kept (months). */
  listRetentionTenants() {
    return this.prisma.$queryRaw<{ id: string; months: number }[]>`
      SELECT id, months FROM list_retention_tenants()`;
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
