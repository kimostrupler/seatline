import { ConflictException, Injectable } from '@nestjs/common';
import type { MailLanguage } from '@seatline/shared';
import type { RequestContext } from '../auth/request-context';
import { audit } from '../common/audit';
import { orNotFound } from '../common/errors';
import { TenantDb, type Tx } from '../db/tenant-db.service';
import { MailService } from '../mail/mail.service';
import { dpaMail } from '../mail/texts';
import { dpaPdf } from './dpa-pdf';

/** The day `months` months before `now` (history ended before it is deleted). */
export function retentionCutoff(now: Date, months: number): Date {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

/**
 * Swiss data protection (nDSG): how long seat history is kept, what Seatline stores about a
 * person (access request), and forgetting people who left. Deleting and anonymising only
 * happen through two database functions (purge_history, forget_person); the app itself can't
 * delete history.
 */
@Injectable()
export class PrivacyService {
  constructor(
    private readonly db: TenantDb,
    private readonly mail: MailService,
  ) {}

  /** E-mails the admin who asks a PDF of the DPA, with their company's name. */
  async sendDpa(ctx: RequestContext, language: MailLanguage) {
    const { tenant, me } = await this.db.run(ctx.tenantId, async (tx) => {
      const found = {
        tenant: await tx.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } }),
        me: await tx.person.findFirstOrThrow({
          where: { id: ctx.actorId, tenantId: ctx.tenantId },
        }),
      };
      await audit(tx, ctx, { action: 'privacy.dpa', entityType: 'tenant', entityId: ctx.tenantId });
      return found;
    });
    const date = new Intl.DateTimeFormat('de-CH', { timeZone: 'Europe/Zurich' }).format(new Date());
    const pdf = await dpaPdf({
      language,
      company: tenant.name,
      requestedBy: `${me.displayName} (${me.email})`,
      date,
    });
    await this.mail.send(dpaMail(me.email, tenant.name, Buffer.from(pdf), language));
    return { sentTo: me.email };
  }

  /** Everything stored about one person, as one JSON document. */
  exportPerson(ctx: RequestContext, personId: string) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const person = orNotFound(
        await tx.person.findFirst({ where: { id: personId, tenantId: ctx.tenantId } }),
        'Person',
      );
      const [assignments, activity, moves, dashboard] = await Promise.all([
        tx.seatAssignment.findMany({
          where: { tenantId: ctx.tenantId, personId },
          include: { seat: { include: { floor: { include: { building: true } } } } },
          orderBy: { startAt: 'asc' },
        }),
        tx.auditLog.findMany({
          where: {
            tenantId: ctx.tenantId,
            OR: [
              { actorId: personId },
              { entityId: personId },
              { after: { path: ['personId'], equals: personId } },
            ],
          },
          orderBy: { createdAt: 'asc' },
        }),
        tx.movePlanItem.findMany({
          where: { tenantId: ctx.tenantId, personId },
          include: { plan: { select: { name: true, status: true, effectiveDate: true } } },
        }),
        tx.dashboardLayout.findFirst({ where: { tenantId: ctx.tenantId, personId } }),
      ]);
      await audit(tx, ctx, {
        action: 'privacy.export',
        entityType: 'person',
        entityId: personId,
      });
      return {
        exportedAt: new Date().toISOString(),
        person: {
          name: person.displayName,
          email: person.email,
          department: person.department,
          jobTitle: person.jobTitle,
          appRole: person.appRole,
          active: person.active,
          leftAt: person.leftAt,
          microsoftObjectId: person.entraObjectId,
          lastSyncedFromMicrosoft365: person.syncedAt,
        },
        seats: assignments.map((a) => ({
          building: a.seat.floor.building.name,
          floor: a.seat.floor.name,
          seat: a.seat.label,
          from: a.startAt,
          to: a.endAt,
          note: a.note,
        })),
        plannedMoves: moves.map((m) => ({
          plan: m.plan.name,
          status: m.plan.status,
          date: m.plan.effectiveDate,
        })),
        dashboard: dashboard?.widgets ?? null,
        activity: activity.map((e) => ({
          at: e.createdAt,
          action: e.action,
          byThisPerson: e.actorId === personId,
          before: e.before,
          after: e.after,
        })),
      };
    });
  }

  /** Remove a person's personal data. Only people who left; their seat history stays unnamed. */
  forget(ctx: RequestContext, personId: string) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const person = orNotFound(
        await tx.person.findFirst({ where: { id: personId, tenantId: ctx.tenantId } }),
        'Person',
      );
      if (person.active)
        throw new ConflictException('Only people who left the organisation can be forgotten');
      if (person.forgottenAt) return { ok: true };
      await this.forgetIn(tx, personId);
      await audit(tx, ctx, { action: 'privacy.forget', entityType: 'person', entityId: personId });
      return { ok: true };
    });
  }

  /**
   * The nightly clean-up for one workspace: delete ended history and activity older than the
   * retention period, and forget people who left before it.
   */
  purge(tenantId: string, months: number, now = new Date()) {
    const cutoff = retentionCutoff(now, months);
    return this.db.run(
      tenantId,
      async (tx) => {
        const leavers = await tx.person.findMany({
          where: { tenantId, active: false, forgottenAt: null, leftAt: { lt: cutoff } },
          select: { id: true },
        });
        for (const p of leavers) await this.forgetIn(tx, p.id);
        const [deleted] = await tx.$queryRaw<{ assignments: bigint; activity: bigint }[]>`
          SELECT assignments, activity FROM purge_history(${cutoff}::timestamptz)`;
        const result = {
          months,
          cutoff: cutoff.toISOString(),
          assignments: Number(deleted?.assignments ?? 0),
          activity: Number(deleted?.activity ?? 0),
          forgotten: leavers.length,
        };
        if (result.assignments || result.activity || result.forgotten)
          await audit(
            tx,
            { tenantId, actorId: null },
            { action: 'privacy.purge', entityType: 'tenant', entityId: tenantId, after: result },
          );
        return result;
      },
      { timeoutMs: 120_000 },
    );
  }

  private forgetIn(tx: Tx, personId: string) {
    return tx.$executeRaw`SELECT forget_person(${personId}::uuid)`;
  }
}
