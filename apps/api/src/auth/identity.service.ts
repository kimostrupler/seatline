import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { AppRole } from '@seatline/shared';
import { audit } from '../common/audit';
import { TenantDb } from '../db/tenant-db.service';
import type { EmailIdentity, Identity, MicrosoftIdentity } from './identity';
import type { RequestContext } from './request-context';

type Workspace = { id: string; name: string };

export type Membership =
  | { status: 'ok'; ctx: RequestContext; workspace: Workspace }
  | { status: 'no_workspace' }
  /** e-mail sign-in: the address belongs to several workspaces, pick one */
  | { status: 'choose'; workspaces: Workspace[] }
  /** e-mail sign-in: the address only belongs to workspaces that sign in with Microsoft */
  | { status: 'use_microsoft' }
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

/** Maps a signed-in identity (Microsoft or e-mail link) to a Seatline workspace and person. */
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
    if (identity.kind === 'email') return this.resolveEmail(identity);
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

  /**
   * E-mail link: the person with this address in a workspace that doesn't use Microsoft
   * (those keep Microsoft's sign-in, with its MFA and offboarding). Never creates people:
   * an admin adds them, or the first person creates a new workspace.
   */
  private async resolveEmail(identity: EmailIdentity): Promise<Membership> {
    const rows = await this.db.emailWorkspaces(identity.email);
    const open = rows.filter((r) => !r.microsoft).map((r) => ({ id: r.tenant_id, name: r.name }));
    const picked = identity.tenantId
      ? open.find((w) => w.id === identity.tenantId)
      : open.length === 1
        ? open[0]
        : undefined;
    if (!picked) {
      if (open.length > 1) return { status: 'choose', workspaces: open };
      if (open.length === 0 && rows.length > 0) return { status: 'use_microsoft' };
      return { status: 'no_workspace' };
    }
    return this.db.run(picked.id, async (tx) => {
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: picked.id } });
      if (tenant.entraTenantId) return { status: 'use_microsoft' };
      const workspace = { id: tenant.id, name: tenant.name };
      const person = await tx.person.findFirst({
        where: {
          tenantId: tenant.id,
          forgottenAt: null,
          email: { equals: identity.email, mode: 'insensitive' },
        },
      });
      if (!person) return { status: 'no_workspace' };
      if (!person.active) return { status: 'inactive', workspace };
      if (!person.appRole) return { status: 'no_access', workspace };
      return {
        status: 'ok',
        workspace,
        ctx: { tenantId: tenant.id, actorId: person.id, role: person.appRole },
      };
    });
  }

  private member(tenantId: string, identity: MicrosoftIdentity): Promise<Membership> {
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
          { tenantId, actorId: person.id },
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

  private async link(tx: Prisma.TransactionClient, tenantId: string, identity: MicrosoftIdentity) {
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
      { tenantId, actorId: person.id },
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

  /**
   * First sign-in from a new organisation: create its workspace with the caller as admin.
   * With Microsoft, one workspace per Microsoft 365 organisation; with an e-mail link, the
   * workspace signs in by e-mail (the person gives their name, Microsoft isn't there to).
   */
  async onboard(identity: Identity, companyName: string, yourName?: string) {
    if (identity.kind === 'email') {
      if (!yourName) throw new BadRequestException('Please enter your name');
      const rows = await this.db.emailWorkspaces(identity.email);
      if (rows.some((r) => !r.microsoft))
        throw new ConflictException('You already have a Seatline workspace');
    } else if (await this.db.resolveTenant(identity.tid))
      throw new ConflictException('Your organisation already has a Seatline workspace');
    const microsoft = identity.kind === 'microsoft' ? identity : null;
    const tenantId = randomUUID();
    try {
      const result = await this.db.run(tenantId, async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            id: tenantId,
            name: companyName,
            slug: slugify(companyName),
            entraTenantId: microsoft?.tid ?? null,
          },
        });
        const admin = await tx.person.create({
          data: {
            tenantId,
            entraObjectId: microsoft?.oid ?? null,
            email: identity.email,
            displayName: microsoft?.name ?? yourName!,
            appRole: 'admin' satisfies AppRole,
          },
        });
        await audit(
          tx,
          { tenantId, actorId: admin.id },
          {
            action: 'tenant.create',
            entityType: 'tenant',
            entityId: tenantId,
            after: {
              name: tenant.name,
              entraTenantId: microsoft?.tid ?? null,
              signIn: microsoft ? 'microsoft' : 'email',
              firstAdmin: admin.id,
            },
          },
        );
        return { workspace: { id: tenant.id, name: tenant.name } };
      });
      // for the website statistics (infra/azure/site-stats.sh): no names, just that it happened
      new Logger('Onboarding').log(
        `New workspace ${tenantId} (${microsoft ? 'microsoft' : 'email'})`,
      );
      return result;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('Your organisation already has a Seatline workspace');
      throw error;
    }
  }
}
