import { Injectable, Logger } from '@nestjs/common';
import type { AppRole, Prisma } from '@prisma/client';
import { audit } from '../common/audit';
import { TenantDb } from '../db/tenant-db.service';
import { GraphClient, GraphError, type GraphUser } from './graph.client';

export interface SyncResult {
  ok: boolean;
  at: string;
  error?: string;
  message?: string;
  created?: number;
  updated?: number;
  deactivated?: number;
  seatsFreed?: number;
}

interface Incoming {
  oid: string;
  email: string;
  displayName: string;
  department: string | null;
  jobTitle: string | null;
  active: boolean;
}

/** Guests (B2B) are not part of the organisation's seating. */
function toIncoming(u: GraphUser): Incoming | null {
  if (u.userType === 'Guest') return null;
  const email = (u.mail ?? u.userPrincipalName).toLowerCase();
  return {
    oid: u.id,
    email,
    displayName: u.displayName?.trim() || email,
    department: u.department?.trim() || null,
    jobTitle: u.jobTitle?.trim() || null,
    active: u.accountEnabled !== false,
  };
}

/**
 * Brings a workspace's people in line with its Microsoft 365 directory.
 * Stores only name, e-mail, department, job title and whether the account is active.
 * People who left (deleted or disabled) become inactive and their seats are freed —
 * their seat history stays. Roles are never touched (new people get the workspace default).
 */
@Injectable()
export class PeopleSyncService {
  private readonly logger = new Logger(PeopleSyncService.name);

  constructor(
    private readonly db: TenantDb,
    private readonly graph: GraphClient,
  ) {}

  async syncTenant(tenantId: string): Promise<SyncResult> {
    const at = new Date();
    const tenant = await this.db.run(tenantId, (tx) =>
      tx.tenant.findUnique({ where: { id: tenantId } }),
    );
    if (!tenant?.entraTenantId)
      return this.record(tenantId, { ok: false, at: at.toISOString(), error: 'not_connected' });

    let users: Incoming[];
    try {
      users = (await this.graph.listUsers(tenant.entraTenantId))
        .map(toIncoming)
        .filter((u) => u !== null);
    } catch (error) {
      const kind = error instanceof GraphError ? error.kind : 'failed';
      this.logger.warn(`People sync for ${tenantId} failed (${kind}): ${String(error)}`);
      return this.record(tenantId, {
        ok: false,
        at: at.toISOString(),
        error: kind,
        message: error instanceof Error ? error.message.slice(0, 300) : undefined,
      });
    }

    const counts = await this.db.run(
      tenantId,
      (tx) => this.apply(tx, tenantId, tenant.defaultAppRole, users, at),
      {
        timeoutMs: 120_000,
      },
    );
    return this.record(tenantId, { ok: true, at: at.toISOString(), ...counts });
  }

  private async apply(
    tx: Prisma.TransactionClient,
    tenantId: string,
    defaultAppRole: AppRole | null,
    users: Incoming[],
    at: Date,
  ) {
    const people = await tx.person.findMany({ where: { tenantId } });
    const byOid = new Map(people.filter((p) => p.entraObjectId).map((p) => [p.entraObjectId!, p]));
    const unlinkedByEmail = new Map(
      people.filter((p) => !p.entraObjectId).map((p) => [p.email.toLowerCase(), p]),
    );
    const emailOwner = new Map(people.map((p) => [p.email.toLowerCase(), p.id]));
    const seen = new Set<string>();
    const created: string[] = [];
    const updated: string[] = [];
    const deactivated: string[] = [];
    const synced: string[] = [];

    for (const u of users) {
      seen.add(u.oid);
      const match = byOid.get(u.oid) ?? unlinkedByEmail.get(u.email);
      if (match) {
        // e-mails are unique per workspace: keep the old one if someone else has the new one
        const emailFree = !emailOwner.has(u.email) || emailOwner.get(u.email) === match.id;
        const data = {
          entraObjectId: u.oid,
          email: emailFree ? u.email : match.email,
          displayName: u.displayName,
          department: u.department,
          jobTitle: u.jobTitle,
          active: u.active,
          leftAt: u.active ? null : (match.leftAt ?? at),
        };
        const changed = (Object.keys(data) as (keyof typeof data)[]).some((k) =>
          data[k] instanceof Date ? +data[k] !== +(match[k] ?? 0) : data[k] !== match[k],
        );
        if (changed) {
          await tx.person.update({ where: { id: match.id }, data });
          updated.push(match.id);
        }
        synced.push(match.id);
        if (match.active && !u.active) deactivated.push(match.id);
        unlinkedByEmail.delete(match.email.toLowerCase());
      } else {
        if (emailOwner.has(u.email)) continue; // same e-mail, different Microsoft account: leave it to an admin
        const person = await tx.person.create({
          data: {
            tenantId,
            entraObjectId: u.oid,
            email: u.email,
            displayName: u.displayName,
            department: u.department,
            jobTitle: u.jobTitle,
            active: u.active,
            appRole: u.active ? defaultAppRole : null,
            syncedAt: at,
          },
        });
        emailOwner.set(u.email, person.id);
        created.push(person.id);
      }
    }

    if (synced.length)
      await tx.person.updateMany({
        where: { tenantId, id: { in: synced } },
        data: { syncedAt: at },
      });

    // Linked to Microsoft but no longer in the directory: they left.
    for (const p of people) {
      if (p.entraObjectId && !seen.has(p.entraObjectId) && p.active) {
        await tx.person.update({
          where: { id: p.id },
          data: { active: false, leftAt: at, syncedAt: at },
        });
        deactivated.push(p.id);
      }
    }

    // People who left don't keep a seat; the history keeps when they sat there.
    const open = deactivated.length
      ? await tx.seatAssignment.findMany({
          where: { tenantId, personId: { in: deactivated }, endAt: null },
        })
      : [];
    for (const a of open) {
      const closed = await tx.seatAssignment.update({ where: { id: a.id }, data: { endAt: at } });
      await audit(
        tx,
        { tenantId, actorId: null },
        {
          action: 'assignment.end',
          entityType: 'seat_assignment',
          entityId: a.id,
          before: a,
          after: { ...closed, endNote: 'Left the organisation (people sync)' },
        },
      );
    }

    const counts = {
      created: created.length,
      updated: updated.length,
      deactivated: deactivated.length,
      seatsFreed: open.length,
    };
    await audit(
      tx,
      { tenantId, actorId: null },
      {
        action: 'people.sync',
        entityType: 'tenant',
        entityId: tenantId,
        after: { ...counts, createdIds: created, updatedIds: updated, deactivatedIds: deactivated },
      },
    );
    return counts;
  }

  private async record(tenantId: string, result: SyncResult): Promise<SyncResult> {
    await this.db.run(tenantId, (tx) =>
      tx.tenant.update({
        where: { id: tenantId },
        data: {
          peopleSyncStatus: result as unknown as Prisma.InputJsonValue,
          ...(result.ok ? { peopleSyncedAt: new Date(result.at) } : {}),
        },
      }),
    );
    return result;
  }
}
