import { NextResponse, type NextRequest } from 'next/server';
import { readSession, SESSION_COOKIE } from '@/lib/server/session';
import { PAGE_LANGUAGE_HEADER } from '@/lib/locales';
import { contentSecurityPolicy, newNonce } from '@/lib/csp';
import { isPublicPath, siteHosts } from '@/lib/site';

/**
 * seatline.ch / www: the public website (landing page + legal pages); anything else there goes
 * to the app. App address: with Microsoft sign-in on, every page except the website needs a
 * session (the /api proxy checks its own).
 */
export async function middleware(req: NextRequest) {
  // every page gets its own script nonce: Next.js reads it from the request's CSP header and
  // stamps its scripts with it; the browser gets the same policy on the response
  const csp = contentSecurityPolicy(newNonce(), process.env.NODE_ENV !== 'production');
  const res = await route(req, csp);
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

async function route(req: NextRequest, csp: string) {
  const { pathname, search } = req.nextUrl;
  const headers = new Headers(req.headers);
  headers.set('Content-Security-Policy', csp);
  const appUrl = process.env.APP_URL ?? req.url;
  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '')
    .split(':')[0]!
    .toLowerCase();
  // the landing page in German / French: its own address, so search engines index each language
  if (pathname === '/de' || pathname === '/fr') {
    headers.set(PAGE_LANGUAGE_HEADER, pathname.slice(1));
    return NextResponse.rewrite(new URL('/welcome', req.url), { request: { headers } });
  }
  // the help center's address says its language (/help/de/…): header and footer follow it
  const pageLanguage = /^\/help\/(en|de|fr)(\/|$)/.exec(pathname)?.[1];
  if (pageLanguage) headers.set(PAGE_LANGUAGE_HEADER, pageLanguage);
  const next = () => NextResponse.next({ request: { headers } });
  if (siteHosts(appUrl).includes(host)) {
    if (pathname === '/')
      return NextResponse.rewrite(new URL('/welcome', req.url), { request: { headers } });
    // /.well-known: domain checks (e.g. Azure's certificate validation) must not be redirected
    if (
      isPublicPath(pathname) ||
      pathname === '/client-errors' ||
      pathname === '/site-visit' ||
      pathname.startsWith('/.well-known/')
    )
      return next();
    return NextResponse.redirect(new URL(pathname + search, appUrl));
  }

  if (process.env.AUTH_MODE !== 'entra') return next();
  if (
    pathname === '/signin' ||
    pathname.startsWith('/signin/') || // check your inbox; picking a workspace checks itself
    pathname === '/client-errors' || // also from the sign-in page; rate-limited, nothing personal
    pathname === '/healthz' || // the uptime check
    pathname === '/site-visit' || // anonymous website statistics
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/api/') ||
    isPublicPath(pathname)
  )
    return next();
  const user = await readSession(
    req.cookies.get(SESSION_COOKIE)?.value,
    process.env.SESSION_SECRET ?? '',
  );
  if (user) return next();
  return NextResponse.redirect(new URL('/signin', appUrl));
}

export const config = {
  runtime: 'nodejs', // reads secrets from the runtime environment
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
