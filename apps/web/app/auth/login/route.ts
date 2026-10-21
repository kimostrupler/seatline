import { NextResponse, type NextRequest } from 'next/server';
import { cookieOptions } from '@/lib/server/auth';
import { webConfig } from '@/lib/server/config';
import { startLogin } from '@/lib/server/oidc';
import { OIDC_COOKIE, seal } from '@/lib/server/session';

/** Start "Sign in with Microsoft": remember state/nonce/PKCE verifier, go to Microsoft. */
export async function GET(req: NextRequest) {
  const config = webConfig();
  if (config.AUTH_MODE !== 'entra') return NextResponse.redirect(new URL('/', config.APP_URL));
  const { url, transaction } = await startLogin({
    loginUrl: config.ENTRA_LOGIN_URL,
    clientId: config.ENTRA_CLIENT_ID,
    redirectUri: `${config.APP_URL}/auth/callback`,
    loginHint: req.nextUrl.searchParams.get('login_hint') ?? undefined,
  });
  const res = NextResponse.redirect(url);
  res.cookies.set(
    OIDC_COOKIE,
    await seal({ ...transaction }, config.SESSION_SECRET, 'oidc', '10m'),
    cookieOptions(600, '/auth'),
  );
  return res;
}
