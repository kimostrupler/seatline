import { ConflictException, Injectable, Logger } from '@nestjs/common';
import type { Person, Prisma } from '@prisma/client';
import type {
  AppRole,
  CreatePersonInput,
  ImportPeopleInput,
  PeopleChangesInput,
  RenameTeamInput,
  ListPeopleQuery,
  MailLanguage,
  SetActiveInput,
  SetRoleInput,
  SetTeamInput,
  UpdatePersonInput,
} from '@seatline/shared';
import { MailService } from '../mail/mail.service';
import type { Notice } from '../mail/notices';
import { NotifyService, openSeats } from '../mail/notify.service';
import { zurichToday } from '../moves/moves.service';
import { inviteMail } from '../mail/texts';
import { readPeopleFile } from './import-file';
import { cancelFutureBookings } from '../bookings/booking-guards';
import { audit } from '../common/audit';
import { loadConfig } from '../config';
import type { RequestContext } from '../auth/request-context';
import { orNotFound } from '../common/errors';
import { BIG_BATCH, TenantDb } from '../db/tenant-db.service';

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

  private readonly config = loadConfig();

  constructor(
    private readonly db: TenantDb,
    private readonly mail: MailService,
    private readonly notify: NotifyService,
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
          leavesOn: true,
          forgottenAt: true,
          assignments: {
            where: { endAt: null },
            select: { seat: { select: { id: true, label: true, floorId: true } } },
          },
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
      const after = await this.changeRole(tx, ctx, before, input.appRole);
      return { id: after.id, appRole: after.appRole };
    });
  }

  /**
   * Set someone's team (department) by hand. For people from Microsoft this sticks: the sync
   * leaves it alone until `fromDirectory` hands the team back to Microsoft (next sync).
   */
  async setTeam(ctx: RequestContext, id: string, input: SetTeamInput) {
    const { after, notice } = await this.db.run(ctx.tenantId, async (tx) => {
      const before = orNotFound(
        await tx.person.findFirst({ where: { id, tenantId: ctx.tenantId, forgottenAt: null } }),
        'Person',
      );
      if ('fromDirectory' in input) {
        const after = await tx.person.update({ where: { id }, data: { teamManual: false } });
        await this.auditTeam(tx, ctx, before, after.department);
        return { after, notice: null };
      }
      return this.changeTeam(tx, ctx, before, input.team || null);
    });
    if (notice) await this.notify.send(ctx.tenantId, [notice]);
    return { id: after.id, department: after.department, teamManual: after.teamManual };
  }

  /** Add someone by hand; optionally e-mail them how to sign in. */
  async create(ctx: RequestContext, input: CreatePersonInput) {
    this.refuseOwnerAddress(input.email);
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
    await this.notify.send(ctx.tenantId, [
      { kind: 'joined', person: person.displayName, team: person.department },
    ]);
    const invited =
      input.invite && person.appRole
        ? await this.sendInvite(ctx, person.id, input.language)
        : false;
    return { ...person, invited };
  }

  /**
   * Read a spreadsheet (Excel or CSV) of people: each row with what would happen to it —
   * new, already in the list, twice in the file, or a problem (no name, bad e-mail).
   * Nothing is saved; the admin checks the list and then imports.
   */
  async readImport(ctx: RequestContext, file: Buffer, filename: string) {
    const rows = await readPeopleFile(file, filename);
    const taken = await this.db.run(ctx.tenantId, async (tx) =>
      tx.person.findMany({
        where: {
          tenantId: ctx.tenantId,
          email: { in: rows.map((r) => r.email), mode: 'insensitive' },
        },
        select: { email: true },
      }),
    );
    const known = new Set(taken.map((p) => p.email.toLowerCase()));
    const seen = new Set<string>();
    return {
      rows: rows.map((r) => {
        if (!r.problem && this.isOwnerAddress(r.email)) r.problem = 'bad_email';
        const status = r.problem
          ? ('invalid' as const)
          : known.has(r.email)
            ? ('exists' as const)
            : seen.has(r.email)
              ? ('duplicate' as const)
              : ('new' as const);
        seen.add(r.email);
        return { ...r, status };
      }),
    };
  }

  /** Add many people at once (all or nothing). People already in the list are skipped. */
  async importPeople(ctx: RequestContext, input: ImportPeopleInput) {
    for (const p of input.people) this.refuseOwnerAddress(p.email);
    const created = await this.db.run(
      ctx.tenantId,
      async (tx) => {
        const taken = await tx.person.findMany({
          where: {
            tenantId: ctx.tenantId,
            email: { in: input.people.map((p) => p.email), mode: 'insensitive' },
          },
          select: { email: true },
        });
        const skip = new Set(taken.map((p) => p.email.toLowerCase()));
        const out: Person[] = [];
        for (const p of input.people) {
          if (skip.has(p.email)) continue;
          skip.add(p.email);
          const person = await tx.person.create({
            data: {
              tenantId: ctx.tenantId,
              displayName: p.displayName,
              email: p.email,
              department: p.department || null,
              teamManual: !!p.department,
              jobTitle: p.jobTitle || null,
              appRole: input.appRole,
            },
          });
          await audit(tx, ctx, {
            action: 'person.create',
            entityType: 'person',
            entityId: person.id,
            after: {
              displayName: person.displayName,
              email: person.email,
              department: person.department,
              appRole: person.appRole,
              imported: true,
            },
          });
          out.push(person);
        }
        return out;
      },
      BIG_BATCH,
    );
    await this.notify.send(
      ctx.tenantId,
      created.map((p) => ({ kind: 'joined', person: p.displayName, team: p.department })),
    );
    let invited = 0;
    if (input.invite && input.appRole)
      for (const p of created)
        if (await this.sendInvite(ctx, p.id, input.language).catch(() => false)) invited++;
    return {
      created: created.length,
      skipped: input.people.length - created.length,
      invited,
    };
  }

  /** Correct name, e-mail or job title of someone added by hand. */
  update(ctx: RequestContext, id: string, input: UpdatePersonInput) {
    if (input.email) this.refuseOwnerAddress(input.email);
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
  async setActive(ctx: RequestContext, id: string, input: SetActiveInput) {
    const { after, notice } = await this.db.run(ctx.tenantId, async (tx) => {
      const before = await this.manual(tx, ctx.tenantId, id);
      if (before.active === input.active) return { after: before, notice: null };
      if (!input.active) return this.leave(tx, ctx, before);
      const after = await tx.person.update({
        where: { id },
        data: { active: true, leftAt: null, leavesOn: null },
      });
      await audit(tx, ctx, {
        action: 'person.return',
        entityType: 'person',
        entityId: id,
        before: { active: false },
        after: { active: true },
      });
      return { after, notice: null };
    });
    if (notice) await this.notify.send(ctx.tenantId, [notice]);
    return after;
  }

  /**
   * HR changes from the People table, saved together (all or nothing): team, role and
   * leaving date. A leaving date today or earlier lets the person go now, a later one is kept
   * for the nightly job. IT / facility get one notice e-mail about it all.
   */
  async applyChanges(ctx: RequestContext, input: PeopleChangesInput) {
    const today = zurichToday();
    const notices = await this.db.run(ctx.tenantId, async (tx) => {
      const out: Notice[] = [];
      for (const c of input.changes) {
        let person = orNotFound(
          await tx.person.findFirst({
            where: { id: c.personId, tenantId: ctx.tenantId, forgottenAt: null },
          }),
          'Person',
        );
        if (c.department !== undefined && (c.department || null) !== person.department) {
          const r = await this.changeTeam(tx, ctx, person, c.department || null);
          person = r.after;
          if (r.notice) out.push(r.notice);
        }
        if (c.appRole !== undefined && c.appRole !== person.appRole)
          person = await this.changeRole(tx, ctx, person, c.appRole);
        if (c.leavesOn !== undefined) {
          const was = person.leavesOn ? person.leavesOn.toISOString().slice(0, 10) : null;
          if (c.leavesOn && c.leavesOn <= today) {
            if (person.active) out.push((await this.leave(tx, ctx, person, c.leavesOn)).notice);
          } else if (c.leavesOn !== was) {
            // the night it comes, leave() would refuse — say so now, not in a log nobody reads
            if (c.leavesOn && person.active)
              await this.assertNotLastAdmin(tx, ctx.tenantId, person);
            const seats = c.leavesOn ? await openSeats(tx, ctx.tenantId, [person.id]) : null;
            person = await tx.person.update({
              where: { id: person.id },
              data: { leavesOn: c.leavesOn ? new Date(`${c.leavesOn}T00:00:00Z`) : null },
            });
            await audit(tx, ctx, {
              action: 'person.leaves_on',
              entityType: 'person',
              entityId: person.id,
              before: { leavesOn: was },
              after: { leavesOn: c.leavesOn },
            });
            if (c.leavesOn && person.active)
              out.push({
                kind: 'leaving',
                person: person.displayName,
                team: person.department,
                day: c.leavesOn,
                seats: seats?.get(person.id) ?? [],
              });
          }
        }
      }
      return out;
    });
    await this.notify.send(ctx.tenantId, notices);
    return { saved: input.changes.length };
  }

  /** Nightly: people whose leaving date has come leave (seats freed, history kept). */
  async leaveDue(tenantId: string, today: string) {
    const system = { tenantId, actorId: null };
    const notices = await this.db.run(tenantId, async (tx) => {
      const due = await tx.person.findMany({
        where: { tenantId, active: true, leavesOn: { lte: new Date(`${today}T00:00:00Z`) } },
      });
      const out: Notice[] = [];
      for (const person of due)
        out.push(
          (await this.leave(tx, system, person, person.leavesOn!.toISOString().slice(0, 10)))
            .notice,
        );
      return out;
    });
    await this.notify.send(tenantId, notices);
    return notices.length;
  }

  /** Rename a team for everyone in it (or remove it: to = null). Sticks for Microsoft people too. */
  renameTeam(ctx: RequestContext, input: RenameTeamInput) {
    return this.db.run(ctx.tenantId, async (tx) => {
      if (input.to && input.to !== input.from) {
        const clash = await tx.person.count({
          where: { tenantId: ctx.tenantId, department: input.to },
        });
        if (clash)
          throw new ConflictException({
            message: 'A team with this name exists — its people would be merged',
            code: 'team_exists',
          });
      }
      const { count } = await tx.person.updateMany({
        where: { tenantId: ctx.tenantId, department: input.from },
        data: { department: input.to, teamManual: true },
      });
      // the team's zones on the map and its space plan follow the name
      await tx.room.updateMany({
        where: { tenantId: ctx.tenantId, team: input.from },
        data: { team: input.to },
      });
      const plan = await tx.teamPlan.findFirst({
        where: { tenantId: ctx.tenantId, team: input.from },
      });
      if (plan) {
        const taken = input.to
          ? await tx.teamPlan.count({ where: { tenantId: ctx.tenantId, team: input.to } })
          : 0;
        if (input.to && !taken)
          await tx.teamPlan.update({ where: { id: plan.id }, data: { team: input.to } });
        else await tx.teamPlan.delete({ where: { id: plan.id } });
      }
      await audit(tx, ctx, {
        action: input.to ? 'team.rename' : 'team.remove',
        entityType: 'tenant',
        entityId: ctx.tenantId,
        before: { team: input.from },
        after: { team: input.to, people: count },
      });
      return { people: count };
    });
  }

  /** Let someone go: inactive from now, their open seats end (history kept). */
  private async leave(
    tx: Prisma.TransactionClient,
    actor: { tenantId: string; actorId: string | null },
    person: Person,
    day = zurichToday(),
  ): Promise<{ after: Person; notice: Notice }> {
    await this.assertNotLastAdmin(tx, actor.tenantId, person);
    const seats = (await openSeats(tx, actor.tenantId, [person.id])).get(person.id) ?? [];
    const at = new Date();
    const after = await tx.person.update({
      where: { id: person.id },
      data: { active: false, leftAt: at },
    });
    const open = await tx.seatAssignment.findMany({
      where: { tenantId: actor.tenantId, personId: person.id, endAt: null },
    });
    for (const a of open) {
      const closed = await tx.seatAssignment.update({ where: { id: a.id }, data: { endAt: at } });
      await audit(tx, actor, {
        action: 'assignment.end',
        entityType: 'seat_assignment',
        entityId: a.id,
        before: a,
        after: { ...closed, endNote: 'Left the organisation' },
      });
    }
    await cancelFutureBookings(tx, actor, [person.id]);
    await audit(tx, actor, {
      action: 'person.leave',
      entityType: 'person',
      entityId: person.id,
      before: { active: true },
      after: { active: false },
    });
    return {
      after,
      notice: { kind: 'left', person: person.displayName, team: person.department, day, seats },
    };
  }

  private async changeRole(
    tx: Prisma.TransactionClient,
    ctx: RequestContext,
    before: Person,
    appRole: AppRole | null,
  ) {
    if (appRole !== 'admin' && before.active)
      await this.assertNotLastAdmin(tx, ctx.tenantId, before);
    const after = await tx.person.update({ where: { id: before.id }, data: { appRole } });
    await audit(tx, ctx, {
      action: 'person.role',
      entityType: 'person',
      entityId: before.id,
      before: { appRole: before.appRole },
      after: { appRole: after.appRole },
    });
    return after;
  }

  private async changeTeam(
    tx: Prisma.TransactionClient,
    ctx: RequestContext,
    before: Person,
    team: string | null,
  ): Promise<{ after: Person; notice: Notice | null }> {
    const after = await tx.person.update({
      where: { id: before.id },
      data: { department: team, teamManual: true },
    });
    await this.auditTeam(tx, ctx, before, after.department);
    return {
      after,
      notice:
        before.department === after.department
          ? null
          : {
              kind: 'team',
              person: after.displayName,
              from: before.department,
              to: after.department,
            },
    };
  }

  private auditTeam(
    tx: Prisma.TransactionClient,
    ctx: RequestContext,
    before: Person,
    department: string | null,
  ) {
    return audit(tx, ctx, {
      action: 'person.team',
      entityType: 'person',
      entityId: before.id,
      before: { department: before.department },
      after: { department },
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

  /** Leaving or losing the admin role is refused for the workspace's last active admin. */
  private async assertNotLastAdmin(tx: Prisma.TransactionClient, tenantId: string, person: Person) {
    if (person.appRole !== 'admin') return;
    const admins = await tx.person.count({ where: { tenantId, appRole: 'admin', active: true } });
    if (admins <= 1) throw new ConflictException('A workspace needs at least one admin');
  }

  private isOwnerAddress(email: string) {
    return this.config.OWNER_EMAILS.includes(email.toLowerCase());
  }

  /**
   * The operator's address can't be added to a list by hand: the workspace holding it as an
   * active admin is the operator's own (free, and the door to /owner). It only gets there when
   * the operator signs up with it — the e-mail link proves the address.
   */
  private refuseOwnerAddress(email: string) {
    if (this.isOwnerAddress(email))
      throw new ConflictException({
        message: 'This address can’t be added here',
        code: 'reserved_email',
      });
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
