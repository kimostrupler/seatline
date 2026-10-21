import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { AppRole } from '@seatline/shared';
import { audit } from '../common/audit';
import { TenantDb } from '../db/tenant-db.service';
import type { Identity } from './identity';
import type { RequestContext } from './request-context';

export type Membership =
  | { status: 'ok'; ctx: RequestContext; workspace: { id: string; name: string } }
  | { status: 'no_workspace' }
  | { status: 'no_access'; workspace: { id: string; name: string } }
  | { status: 'inactive'; workspace: { id: string; name: string } };

function slugify(name: string) {
  const base = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${base || 'workspace'}-${randomUUID().slice(0, 6)}`;
}

/** Maps a Microsoft identity to a Seatline workspace and person. */
@Injectable()
export class IdentityService {
  constructor(private readonly db: TenantDb) {}

  /**
   * Finds (or, on first sign-in, creates) the person behind a Microsoft identity.
   * Matching order: Entra object id, then e-mail of a person not yet linked
   * (e.g. created before Microsoft was connected), else a new person with the
   * workspace's default role.
   */
  async resolve(identity: Identity): Promise<Membership> {
    const tenantId = await this.db.resolveTenant(identity.tid);
    if (!tenantId) return { status: 'no_workspace' };
    try {
      return await this.member(tenantId, identity);
    } catch (error) {
      // two first requests at once: the other one created the person — just look again
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        return this.member(tenantId, identity);
      throw error;
    }
  }

  private member(tenantId: string, identity: Identity): Promise<Membership> {
    return this.db.run(tenantId, async (tx) => {
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId } });
      const workspace = { id: tenant.id, name: tenant.name };
      let person =
        (await tx.person.findFirst({ where: { tenantId, entraObjectId: identity.oid } })) ??
        (await this.link(tx, tenantId, identity));
      if (!person) {
        person = await tx.person.create({
          data: {
            tenantId,
            entraObjectId: identity.oid,
            email: identity.email,
            displayName: identity.name,
            appRole: tenant.defaultAppRole,
          },
        });
        await audit(
          tx,
          { tenantId, actorId: person.id, role: person.appRole ?? 'viewer' },
          {
            action: 'person.first_sign_in',
            entityType: 'person',
            entityId: person.id,
            after: {
              displayName: person.displayName,
              email: person.email,
              appRole: person.appRole,
            },
          },
        );
      }
      if (!person.active) return { status: 'inactive', workspace };
      if (!person.appRole) return { status: 'no_access', workspace };
      return {
        status: 'ok',
        workspace,
        ctx: { tenantId, actorId: person.id, role: person.appRole },
      };
    });
  }

  private async link(tx: Prisma.TransactionClient, tenantId: string, identity: Identity) {
    const unlinked = await tx.person.findFirst({
      where: {
        tenantId,
        entraObjectId: null,
        email: { equals: identity.email, mode: 'insensitive' },
      },
    });
    if (!unlinked) return null;
    const person = await tx.person.update({
      where: { id: unlinked.id },
      data: { entraObjectId: identity.oid },
    });
    await audit(
      tx,
      { tenantId, actorId: person.id, role: person.appRole ?? 'viewer' },
      {
        action: 'person.link_microsoft',
        entityType: 'person',
        entityId: person.id,
        before: { entraObjectId: null },
        after: { entraObjectId: identity.oid },
      },
    );
    return person;
  }

  /** First sign-in from a new organisation: create its workspace with the caller as admin. */
  async onboard(identity: Identity, companyName: string) {
    if (await this.db.resolveTenant(identity.tid))
      throw new ConflictException('Your organisation already has a Seatline workspace');
    const tenantId = randomUUID();
    try {
      return await this.db.run(tenantId, async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            id: tenantId,
            name: companyName,
            slug: slugify(companyName),
            entraTenantId: identity.tid,
          },
        });
        const admin = await tx.person.create({
          data: {
            tenantId,
            entraObjectId: identity.oid,
            email: identity.email,
            displayName: identity.name,
            appRole: 'admin' satisfies AppRole,
          },
        });
        await audit(
          tx,
          { tenantId, actorId: admin.id, role: 'admin' },
          {
            action: 'tenant.create',
            entityType: 'tenant',
            entityId: tenantId,
            after: { name: tenant.name, entraTenantId: identity.tid, firstAdmin: admin.id },
          },
        );
        return { workspace: { id: tenant.id, name: tenant.name } };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('Your organisation already has a Seatline workspace');
      throw error;
    }
  }
}
