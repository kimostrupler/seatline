import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { webConfig } from './config';

/** A redirect after a form POST (303: the browser follows with GET). */
export const seeOther = (path: string) =>
  NextResponse.redirect(new URL(path, webConfig().APP_URL), 303);

/**
 * Sign-in forms only accept posts from this app's own pages. Stops other sites from signing a
 * visitor in to *their* account (login CSRF) or sending links in someone's name.
 */
export function fromThisApp(req: NextRequest): boolean {
  return req.headers.get('origin') === new URL(webConfig().APP_URL).origin;
}

/**
 * The caller's address as seen by Azure's ingress: the LAST X-Forwarded-For entry, the one the
 * ingress appended. Earlier entries come from the caller and can be made up (a fake one per
 * request would get around every per-address limit).
 */
export const clientIp = (req: Pick<NextRequest, 'headers'>) =>
  req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown';
