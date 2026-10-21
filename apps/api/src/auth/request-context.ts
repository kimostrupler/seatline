import type { AppRole } from '@seatline/shared';

/** Who is calling, resolved once per request by the auth guard. */
export interface RequestContext {
  tenantId: string;
  /** people.id of the caller */
  actorId: string;
  role: AppRole;
}
