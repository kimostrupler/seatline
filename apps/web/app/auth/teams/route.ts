import { NextResponse, type NextRequest } from 'next/server';
import { cookieOptions, landing, membership } from '@/lib/server/auth';
import { webConfig } from '@/lib/server/config';
import { fromThisApp } from '@/lib/server/forms';
import { SignInError, verifyTeamsToken } from '@/lib/server/oidc';
import { SESSION_COOKIE, SESSION_HOURS, sealSession } from '@/lib/server/session';

/**
 * Teams / Outlook tab sign-in: the tab page sends the token Teams gave it; we start a session.
 * The tab runs inside Teams (another site), so the cookie is SameSite=None and partitioned:
 * it only exists inside Teams' frame, never on other sites.
 */
export async function POST(req: NextRequest) {
  const config = webConfig();
  if (config.AUTH_MODE !== 'entra' || !fromThisApp(req))
    return NextResponse.json({ error: 'not_allowed' }, { status: 403 });
  const { token } = (await req.json().catch(() => ({}))) as { token?: unknown };
  if (typeof token !== 'string' || token.length > 20_000)
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  try {
    const user = await verifyTeamsToken(token, {
      loginUrl: config.ENTRA_LOGIN_URL,
      clientId: config.ENTRA_CLIENT_ID,
      appUrl: config.APP_URL,
    });
    const res = NextResponse.json({ next: landing(await membership(user)) });
    const secure = config.APP_URL.startsWith('https://');
    res.cookies.set(SESSION_COOKIE, await sealSession(user, config.SESSION_SECRET), {
      ...cookieOptions(SESSION_HOURS * 3600),
      ...(secure && { sameSite: 'none' as const, partitioned: true }),
    });
    return res;
  } catch (error) {
    if (!(error instanceof SignInError)) console.error('Teams sign-in failed', error);
    return NextResponse.json({ error: 'invalid' }, { status: 401 });
  }
}
