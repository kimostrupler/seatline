import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Identity } from './identity';
import type { RequestContext } from './request-context';

export const IS_PUBLIC = 'isPublic';
export const IDENTITY_ONLY = 'identityOnly';
export const ADMIN_ONLY = 'adminOnly';
export const EDITORS_ONLY = 'editorsOnly';

/** Skip authentication (health checks). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Signed in with Microsoft, but not necessarily a member yet (session check, onboarding). */
export const IdentityOnly = () => SetMetadata(IDENTITY_ONLY, true);

/** Only workspace admins (roles, settings, people sync). */
export const AdminOnly = () => SetMetadata(ADMIN_ONLY, true);

/** Only editors and admins, also for reading (e.g. the full change history). */
export const EditorsOnly = () => SetMetadata(EDITORS_ONLY, true);

/** Injects the caller's RequestContext. */
export const Ctx = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestContext =>
    context.switchToHttp().getRequest<{ ctx: RequestContext }>().ctx,
);

/** Injects the verified Microsoft identity (only on @IdentityOnly routes). */
export const CurrentIdentity = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Identity =>
    context.switchToHttp().getRequest<{ identity: Identity }>().identity,
);
