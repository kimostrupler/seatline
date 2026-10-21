import { Injectable } from '@nestjs/common';
import type { ListPeopleQuery } from '@seatline/shared';
import type { RequestContext } from '../auth/request-context';
import { orNotFound } from '../common/errors';
import { TenantDb } from '../db/tenant-db.service';

/** Read-only for now: people come from Microsoft Graph (Phase 4) or the seed. */
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
        include: {
          assignments: {
            where: { endAt: null },
            select: { id: true, seat: { select: { id: true, label: true, floorId: true } } },
          },
        },
        orderBy: { displayName: 'asc' },
        take: query.limit,
      }),
    );
  }

  get(ctx: RequestContext, id: string) {
    return this.db.run(ctx.tenantId, async (tx) =>
      orNotFound(await tx.person.findFirst({ where: { id, tenantId: ctx.tenantId } }), 'Person'),
    );
  }
}
