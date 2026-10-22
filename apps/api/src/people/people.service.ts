import { ConflictException, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  CreatePersonInput,
  ListPeopleQuery,
  MailLanguage,
  SetActiveInput,
  SetRoleInput,
  SetTeamInput,
  UpdatePersonInput,
} from '@seatline/shared';
import { MailService } from '../mail/mail.service';
import { inviteMail } from '../mail/texts';
import { audit } from '../common/audit';
import type { RequestContext } from '../auth/request-context';
import { orNotFound } from '../common/errors';
import { TenantDb } from '../db/tenant-db.service';

/** The person's current seat (if any), with its floor. */
const withSeat = {
  assignments: {
    where: { endAt: null },
    select: {
      id: true,
      seat: {
        select: {
          id: true,
          label: true,
          floorId: true,
          floor: { select: { name: true, buildingId: true } },
        },
      },
    },
  },
} satisfies Prisma.PersonInclude;

/**
 * People come from Microsoft 365 (sync / first sign-in) or are added by hand by an admin
 * (workspaces that sign in by e-mail, or someone not in the directory). Admins manage roles
 * and teams for everyone; name, e-mail and leaving only for people added by hand.
 */
@Injectable()
export class PeopleService {
  private readonly logger = new Logger(PeopleService.name);

  constructor(
    private readonly db: TenantDb,
    private readonly mail: MailService,
  ) {}

  list(ctx: RequestContext, query: ListPeopleQuery) {
    const search = query.search;
    return this.db.run(ctx.tenantId, (tx) =>
      tx.person.findMany({
        where: {
          tenantId: ctx.tenantId,
          active: true,
          ...(search
            ? {
                OR: [
                  { displayName: { contains: search, mode: 'insensitive' } },
                  { email: { contains: search, mode: 'insensitive' } },
                  { department: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        include: withSeat,
        orderBy: { displayName: 'asc' },
        take: query.limit,
      }),
    );
  }

  get(ctx: RequestContext, id: string) {
    return this.db.run(ctx.tenantId, async (tx) =>
      orNotFound(
        await tx.person.findFirst({ where: { id, tenantId: ctx.tenantId }, include: withSeat }),
        'Person',
      ),
    );
  }

  /** Admin view: everyone incl. people who left, with their roles. */
  directory(ctx: RequestContext) {
    return this.db.run(ctx.tenantId, (tx) =>
      tx.person.findMany({
        where: { tenantId: ctx.tenantId },
        select: {
          id: true,
          displayName: true,
          email: true,
          department: true,
          teamManual: true,
          jobTitle: true,
          appRole: true,
          active: true,
          syncedAt: true,
          entraObjectId: true,
          leftAt: true,
          forgottenAt: true,
        },
        orderBy: [{ active: 'desc' }, { displayName: 'asc' }],
      }),
    );
  }

  /** Change someone's app role. A workspace always keeps at least one active admin. */
  setRole(ctx: RequestContext, id: string, input: SetRoleInput) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const before = orNotFound(
        await tx.person.findFirst({ where: { id, tenantId: ctx.tenantId } }),
        'Person',
      );
      if (before.appRole === 'admin' && input.appRole !== 'admin') {
        const admins = await tx.person.count({
          where: { tenantId: ctx.tenantId, appRole: 'admin', active: true },
        });
        if (admins <= 1) throw new ConflictException('A workspace needs at least one admin');
      }
      const after = await tx.person.update({ where: { id }, data: { appRole: input.appRole } });
      await audit(tx, ctx, {
        action: 'person.role',
        entityType: 'person',
        entityId: id,
        before: { appRole: before.appRole },
        after: { appRole: after.appRole },
      });
      return { id: after.id, appRole: after.appRole };
    });
  }

  /**
   * Set someone's team (department) by hand. For people from Microsoft this sticks: the sync
   * leaves it alone until `fromDirectory` hands the team back to Microsoft (next sync).
   */
  setTeam(ctx: RequestContext, id: string, input: SetTeamInput) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const before = orNotFound(
        await tx.person.findFirst({ where: { id, tenantId: ctx.tenantId, forgottenAt: null } }),
        'Person',
      );
      const data =
        'fromDirectory' in input
          ? { teamManual: false }
          : { department: input.team || null, teamManual: true };
      const after = await tx.person.update({ where: { id }, data });
      await audit(tx, ctx, {
        action: 'person.team',
        entityType: 'person',
        entityId: id,
        before: { department: before.department },
        after: { department: after.department },
      });
      return { id: after.id, department: after.department, teamManual: after.teamManual };
    });
  }

  /** Add someone by hand; optionally e-mail them how to sign in. */
  async create(ctx: RequestContext, input: CreatePersonInput) {
    const person = await this.db.run(ctx.tenantId, async (tx) => {
      await this.emailFree(tx, ctx.tenantId, input.email);
      const created = await tx.person.create({
        data: {
          tenantId: ctx.tenantId,
          displayName: input.displayName,
          email: input.email,
          department: input.department || null,
          teamManual: !!input.department,
          jobTitle: input.jobTitle || null,
          appRole: input.appRole,
        },
      });
      await audit(tx, ctx, {
        action: 'person.create',
        entityType: 'person',
        entityId: created.id,
        after: {
          displayName: created.displayName,
          email: created.email,
          department: created.department,
          appRole: created.appRole,
        },
      });
      return created;
    });
    const invited =
      input.invite && person.appRole
        ? await this.sendInvite(ctx, person.id, input.language)
        : false;
    return { ...person, invited };
  }

  /** Correct name, e-mail or job title of someone added by hand. */
  update(ctx: RequestContext, id: string, input: UpdatePersonInput) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const before = await this.manual(tx, ctx.tenantId, id);
      if (input.email && input.email !== before.email.toLowerCase())
        await this.emailFree(tx, ctx.tenantId, input.email);
      const data = {
        ...(input.displayName !== undefined && { displayName: input.displayName }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.jobTitle !== undefined && { jobTitle: input.jobTitle || null }),
      };
      const after = await tx.person.update({ where: { id }, data });
      await audit(tx, ctx, {
        action: 'person.update',
        entityType: 'person',
        entityId: id,
        before: Object.fromEntries(
          Object.keys(data).map((k) => [k, before[k as keyof typeof data]]),
        ),
        after: data,
      });
      return after;
    });
  }

  /**
   * Someone added by hand left (their open seats end now; the history stays) or came back.
   * A workspace always keeps one active admin.
   */
  setActive(ctx: RequestContext, id: string, input: SetActiveInput) {
    return this.db.run(ctx.tenantId, async (tx) => {
      const before = await this.manual(tx, ctx.tenantId, id);
      if (before.active === input.active) return before;
      if (!input.active && before.appRole === 'admin') {
        const admins = await tx.person.count({
          where: { tenantId: ctx.tenantId, appRole: 'admin', active: true },
        });
        if (admins <= 1) throw new ConflictException('A workspace needs at least one admin');
      }
      const at = new Date();
      const after = await tx.person.update({
        where: { id },
        data: { active: input.active, leftAt: input.active ? null : at },
      });
      if (!input.active) {
        const open = await tx.seatAssignment.findMany({
          where: { tenantId: ctx.tenantId, personId: id, endAt: null },
        });
        for (const a of open) {
          const closed = await tx.seatAssignment.update({
            where: { id: a.id },
            data: { endAt: at },
          });
          await audit(tx, ctx, {
            action: 'assignment.end',
            entityType: 'seat_assignment',
            entityId: a.id,
            before: a,
            after: { ...closed, endNote: 'Left the organisation' },
          });
        }
      }
      await audit(tx, ctx, {
        action: input.active ? 'person.return' : 'person.leave',
        entityType: 'person',
        entityId: id,
        before: { active: before.active },
        after: { active: after.active },
      });
      return after;
    });
  }

  /** E-mail someone added by hand how to sign in (workspaces with e-mail sign-in). */
  async invite(ctx: RequestContext, id: string, language: MailLanguage) {
    return { invited: await this.sendInvite(ctx, id, language) };
  }

  private async sendInvite(ctx: RequestContext, id: string, language: MailLanguage) {
    const { person, tenant, inviter } = await this.db.run(ctx.tenantId, async (tx) => ({
      person: orNotFound(
        await tx.person.findFirst({ where: { id, tenantId: ctx.tenantId, forgottenAt: null } }),
        'Person',
      ),
      tenant: await tx.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } }),
      inviter: await tx.person.findUniqueOrThrow({ where: { id: ctx.actorId } }),
    }));
    if (tenant.entraTenantId)
      throw new ConflictException('This workspace signs in with Microsoft 365');
    if (!person.active || !person.appRole)
      throw new ConflictException('Give them a role first, then invite them');
    if (!this.mail.configured) return false;
    try {
      await this.mail.send(
        inviteMail(
          person.email,
          inviter.displayName,
          tenant.name,
          `${this.mail.appUrl}/signin?email=${encodeURIComponent(person.email)}`,
          language,
        ),
      );
    } catch {
      this.logger.warn('An invitation could not be sent');
      return false;
    }
    await this.db.run(ctx.tenantId, (tx) =>
      audit(tx, ctx, { action: 'person.invite', entityType: 'person', entityId: id }),
    );
    return true;
  }

  /** People added by hand (not linked to Microsoft 365, whose directory owns those details). */
  private async manual(tx: Prisma.TransactionClient, tenantId: string, id: string) {
    const person = orNotFound(
      await tx.person.findFirst({ where: { id, tenantId, forgottenAt: null } }),
      'Person',
    );
    if (person.entraObjectId)
      throw new ConflictException({
        message: 'This person comes from Microsoft 365 — change them there',
        code: 'from_microsoft',
      });
    return person;
  }

  private async emailFree(tx: Prisma.TransactionClient, tenantId: string, email: string) {
    const taken = await tx.person.findFirst({
      where: { tenantId, email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (taken)
      throw new ConflictException({
        message: 'Someone with this e-mail address is already in the list',
        code: 'email_taken',
      });
  }
}
