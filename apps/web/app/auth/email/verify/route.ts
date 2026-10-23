import type { NextRequest } from 'next/server';
import { cookieOptions, landing, membership, publicApi, signedInMarker } from '@/lib/server/auth';
import { webConfig } from '@/lib/server/config';
import { fromThisApp, seeOther } from '@/lib/server/forms';
import { SESSION_COOKIE, SESSION_HOURS, sealSession, type SessionUser } from '@/lib/server/session';

/** Uses a sign-in link (once) and starts the session for the proven address. */
export async function POST(req: NextRequest) {
  const config = webConfig();
  if (config.AUTH_MODE !== 'entra' || !fromThisApp(req)) return seeOther('/signin');
  const token = String((await req.formData()).get('token') ?? '');
  const res = await publicApi<{ email: string }>('/auth/email/verify', { token });
  if (res.status !== 200 || !res.body?.email) return seeOther('/signin?error=link_invalid');
  const user: SessionUser = { kind: 'email', email: res.body.email, tenantId: null };
  const out = seeOther(landing(await membership(user)));
  out.cookies.set(
    SESSION_COOKIE,
    await sealSession(user, config.SESSION_SECRET),
    cookieOptions(SESSION_HOURS * 3600),
  );
  signedInMarker(out, SESSION_HOURS * 3600);
  return out;
}
