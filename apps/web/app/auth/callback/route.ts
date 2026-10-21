import { NextResponse, type NextRequest } from 'next/server';
import { cookieOptions, membership } from '@/lib/server/auth';
import { webConfig } from '@/lib/server/config';
import { finishLogin, SignInError, type LoginTransaction } from '@/lib/server/oidc';
import {
  OIDC_COOKIE,
  SESSION_COOKIE,
  SESSION_HOURS,
  sealSession,
  unseal,
} from '@/lib/server/session';

/** Microsoft sends the user back here with a one-time code. */
export async function GET(req: NextRequest) {
  const config = webConfig();
  const to = (path: string) => NextResponse.redirect(new URL(path, config.APP_URL));
  const params = req.nextUrl.searchParams;
  const transaction = await unseal<LoginTransaction>(
    req.cookies.get(OIDC_COOKIE)?.value,
    config.SESSION_SECRET,
    'oidc',
  );

  if (params.get('error'))
    return to(`/signin?error=${encodeURIComponent(params.get('error') ?? 'failed')}`);
  if (!transaction || params.get('state') !== transaction.state || !params.get('code'))
    return to('/signin?error=expired');

  let res: NextResponse;
  try {
    const user = await finishLogin({
      loginUrl: config.ENTRA_LOGIN_URL,
      clientId: config.ENTRA_CLIENT_ID,
      clientSecret: config.ENTRA_CLIENT_SECRET,
      redirectUri: `${config.APP_URL}/auth/callback`,
      code: params.get('code')!,
      transaction,
    });
    const status = await membership(user);
    res = to(
      status === 'ok'
        ? '/'
        : status === 'no_workspace'
          ? '/onboarding'
          : `/no-access?reason=${status}`,
    );
    res.cookies.set(
      SESSION_COOKIE,
      await sealSession(user, config.SESSION_SECRET),
      cookieOptions(SESSION_HOURS * 3600),
    );
  } catch (error) {
    console.error('Sign-in failed', error);
    res = to(`/signin?error=${error instanceof SignInError ? 'invalid' : 'failed'}`);
  }
  res.cookies.set(OIDC_COOKIE, '', cookieOptions(0, '/auth'));
  return res;
}
