import type { NextRequest } from 'next/server';
import { getLocale } from 'next-intl/server';
import { cookieOptions, publicApi, signedInMarker } from '@/lib/server/auth';
import { webConfig } from '@/lib/server/config';
import { clientIp, fromThisApp, seeOther } from '@/lib/server/forms';
import { allow } from '@/lib/server/rate-limit';
import { SESSION_COOKIE, SESSION_HOURS, sealSession, type SessionUser } from '@/lib/server/session';

/** Opens a new demo workspace and signs the visitor in as its admin. */
export async function POST(req: NextRequest) {
  const config = webConfig();
  if (config.AUTH_MODE !== 'entra' || !fromThisApp(req)) return seeOther('/auth/demo');
  // a few demos per address and hour is plenty for a person
  if (!allow(`demo:${clientIp(req)}`, 5, 3_600_000)) return seeOther('/auth/demo?error=busy');
  const language = (await getLocale()).slice(0, 2);
  const res = await publicApi<{ tenantId: string; email: string }>('/auth/demo', { language });
  if (res.status !== 200 || !res.body?.tenantId)
    return seeOther(`/auth/demo?error=${res.status === 503 ? 'busy' : 'failed'}`);
  const user: SessionUser = { kind: 'email', email: res.body.email, tenantId: res.body.tenantId };
  const out = seeOther('/');
  out.cookies.set(
    SESSION_COOKIE,
    await sealSession(user, config.SESSION_SECRET),
    cookieOptions(SESSION_HOURS * 3600),
  );
  signedInMarker(out, SESSION_HOURS * 3600);
  return out;
}
