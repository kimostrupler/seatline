import { ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { ListPeopleQuery, SetRoleInput } from '@seatline/shared';
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

/** People come from Microsoft 365 (sync / first sign-in); admins only manage roles. */
@Injectable()
export class PeopleService {
  constructor(private readonly db: TenantDb) {}

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
          jobTitle: true,
          appRole: true,
          active: true,
          syncedAt: true,
          entraObjectId: true,
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
}
