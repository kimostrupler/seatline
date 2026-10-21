import { NextResponse, type NextRequest } from 'next/server';
import { readSession, SESSION_COOKIE } from '@/lib/server/session';

/** With Microsoft sign-in on, every page needs a session (the /api proxy checks its own). */
export async function middleware(req: NextRequest) {
  if (process.env.AUTH_MODE !== 'entra') return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (
    pathname === '/signin' ||
    pathname === '/client-errors' || // also from the sign-in page; rate-limited, nothing personal
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/api/')
  )
    return NextResponse.next();
  const user = await readSession(
    req.cookies.get(SESSION_COOKIE)?.value,
    process.env.SESSION_SECRET ?? '',
  );
  if (user) return NextResponse.next();
  return NextResponse.redirect(new URL('/signin', process.env.APP_URL ?? req.url));
}

export const config = {
  runtime: 'nodejs', // reads secrets from the runtime environment
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
