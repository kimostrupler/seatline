import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { RequestContext } from './request-context';

export const IS_PUBLIC = 'isPublic';
/** Skip authentication (health checks). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Injects the caller's RequestContext. */
export const Ctx = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestContext =>
    context.switchToHttp().getRequest<{ ctx: RequestContext }>().ctx,
);
