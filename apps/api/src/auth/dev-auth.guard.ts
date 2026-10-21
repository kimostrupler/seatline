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
import { IS_PUBLIC } from './decorators';
import type { RequestContext } from './request-context';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const uuid = z.uuid();

/**
 * Phase 1 stand-in for Microsoft Entra ID: trusts the x-tenant-id / x-user-id headers
 * (only when DEV_AUTH=true), then checks the caller is an active person with an app role.
 * Viewers may read; writes need editor or admin.
 */
@Injectable()
export class DevAuthGuard implements CanActivate {
  private readonly devAuth = loadConfig().DEV_AUTH;

  constructor(
    private readonly reflector: Reflector,
    private readonly db: TenantDb,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    if (!this.devAuth) throw new UnauthorizedException('Sign-in is not configured');

    const req = context.switchToHttp().getRequest<{
      method: string;
      headers: Record<string, string | string[] | undefined>;
      ctx?: RequestContext;
    }>();
    const tenantId = uuid.safeParse(req.headers['x-tenant-id']);
    const userId = uuid.safeParse(req.headers['x-user-id']);
    if (!tenantId.success || !userId.success) {
      throw new UnauthorizedException('Missing or invalid x-tenant-id / x-user-id');
    }

    const person = await this.db.run(tenantId.data, (tx) =>
      tx.person.findFirst({
        where: { id: userId.data, tenantId: tenantId.data, active: true },
        select: { appRole: true },
      }),
    );
    if (!person?.appRole) throw new UnauthorizedException('No access to this workspace');
    if (!READ_METHODS.has(req.method) && person.appRole === 'viewer') {
      throw new ForbiddenException('Viewers cannot make changes');
    }

    req.ctx = { tenantId: tenantId.data, actorId: userId.data, role: person.appRole };
    return true;
  }
}
