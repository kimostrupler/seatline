import { NextResponse, type NextRequest } from 'next/server';
import { siteHosts, siteUrl } from '@/lib/site';
import { apiAsUser, cookieOptions, signedInMarker } from '@/lib/server/auth';
import { webConfig } from '@/lib/server/config';
import { fromThisApp, seeOther } from '@/lib/server/forms';
import { readSession, SESSION_COOKIE } from '@/lib/server/session';

/**
 * Sign out of Seatline (POST from our own pages only, so another site can't sign people out
 * with a hidden form). Leaving the demo (`to=site`) goes back to the website instead of the
 * sign-in page.
 */
export async function POST(req: NextRequest) {
  if (!fromThisApp(req)) return seeOther('/');
  const config = webConfig();
  const appUrl = config.APP_URL;
  // end this sign-in in the API too, so a copy of the cookie stops working (best effort: the
  // cookie goes either way)
  const user = await readSession(req.cookies.get(SESSION_COOKIE)?.value, config.SESSION_SECRET);
  if (user?.sid) await apiAsUser(user, '/auth/signout', { method: 'POST' }).catch(() => null);
  const to = String((await req.formData().catch(() => null))?.get('to') ?? '');
  const website = siteHosts(appUrl).length ? `${siteUrl(appUrl)}/` : new URL('/welcome', appUrl);
  const target = to === 'site' ? website : new URL('/signin?signedOut=1', appUrl);
  const res = NextResponse.redirect(target, 303);
  res.cookies.set(SESSION_COOKIE, '', cookieOptions(0));
  signedInMarker(res, 0);
  return res;
}
