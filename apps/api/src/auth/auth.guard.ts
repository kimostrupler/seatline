import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { z } from 'zod';
import { loadConfig } from '../config';
import { TenantDb } from '../db/tenant-db.service';
import { ADMIN_ONLY, EDITORS_ONLY, IDENTITY_ONLY, IS_PUBLIC } from './decorators';
import { verifyInternalToken, type Identity } from './identity';
import { IdentityService } from './identity.service';
import type { RequestContext } from './request-context';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const uuid = z.uuid();

interface AuthRequest {
  method: string;
  headers: Record<string, string | string[] | undefined>;
  ctx?: RequestContext;
  identity?: Identity;
}

/**
 * Who is calling:
 * - Microsoft sign-in (production): the web app signs a short-lived token per request
 *   (`Authorization: Bearer …`, INTERNAL_AUTH_SECRET). Mapped to a workspace and person.
 * - Dev sign-in (DEV_AUTH=true, never in production): x-tenant-id / x-user-id headers.
 * Then: viewers may read; writes need editor or admin; @AdminOnly needs admin.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly config = loadConfig();

  constructor(
    private readonly reflector: Reflector,
    private readonly db: TenantDb,
    private readonly identities: IdentityService,
  ) {}

  private flag(key: string, context: ExecutionContext) {
    return this.reflector.getAllAndOverride<boolean>(key, [
      context.getHandler(),
      context.getClass(),
    ]);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.flag(IS_PUBLIC, context)) return true;
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const bearer = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ''))?.[1];

    let ctx: RequestContext;
    if (bearer && this.config.INTERNAL_AUTH_SECRET) {
      const identity = await verifyInternalToken(bearer, this.config.INTERNAL_AUTH_SECRET);
      if (!identity) throw new UnauthorizedException('Your sign-in has expired');
      if (this.flag(IDENTITY_ONLY, context)) {
        req.identity = identity;
        return true;
      }
      const membership = await this.identities.resolve(identity);
      if (membership.status !== 'ok')
        throw new ForbiddenException({
          message: 'No access to this workspace',
          code: membership.status,
        });
      ctx = membership.ctx;
    } else if (this.config.DEV_AUTH && !this.flag(IDENTITY_ONLY, context)) {
      ctx = await this.devContext(req);
    } else {
      throw new UnauthorizedException('Sign in with Microsoft');
    }

    if (!READ_METHODS.has(req.method) && ctx.role === 'viewer')
      throw new ForbiddenException('Viewers cannot make changes');
    if (this.flag(ADMIN_ONLY, context) && ctx.role !== 'admin')
      throw new ForbiddenException('Only admins can do this');
    if (this.flag(EDITORS_ONLY, context) && ctx.role === 'viewer')
      throw new ForbiddenException('Only editors and admins can see this');
    req.ctx = ctx;
    return true;
  }

  private async devContext(req: AuthRequest): Promise<RequestContext> {
    const tenantId = uuid.safeParse(req.headers['x-tenant-id']);
    const userId = uuid.safeParse(req.headers['x-user-id']);
    if (!tenantId.success || !userId.success)
      throw new UnauthorizedException('Missing or invalid x-tenant-id / x-user-id');
    const person = await this.db.run(tenantId.data, (tx) =>
      tx.person.findFirst({
        where: { id: userId.data, tenantId: tenantId.data, active: true },
        select: { appRole: true },
      }),
    );
    if (!person?.appRole) throw new UnauthorizedException('No access to this workspace');
    return { tenantId: tenantId.data, actorId: userId.data, role: person.appRole };
  }
}
