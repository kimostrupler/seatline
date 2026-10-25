import type { NextRequest } from 'next/server';
import { cookieOptions, landing, membership, publicApi, signedInMarker } from '@/lib/server/auth';
import { webConfig } from '@/lib/server/config';
import { clientIp, fromThisApp, seeOther } from '@/lib/server/forms';
import { allow } from '@/lib/server/rate-limit';
import { SESSION_COOKIE, SESSION_HOURS, sealSession, type SessionUser } from '@/lib/server/session';

/**
 * The code from the sign-in e-mail, typed in on "Check your inbox" — for an iPhone home-screen
 * app, which keeps its own sign-in (links in e-mails open Safari). Starts the session like the link.
 */
export async function POST(req: NextRequest) {
  const config = webConfig();
  if (config.AUTH_MODE !== 'entra' || !fromThisApp(req)) return seeOther('/signin');
  const form = await req.formData();
  const email = String(form.get('email') ?? '').trim();
  const code = String(form.get('code') ?? '');
  const back = (error: string) =>
    seeOther(`/signin/check?email=${encodeURIComponent(email)}&error=${error}`);
  // the API allows 5 wrong codes per e-mail; this keeps one address from trying many e-mails
  if (!allow(`code:${clientIp(req)}`, 20, 15 * 60_000)) return back('too_many_codes');
  const res = await publicApi<{ email: string }>('/auth/email/code', { email, code });
  if (res.status !== 200 || !res.body?.email) return back('code_invalid');
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
