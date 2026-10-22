import { NextResponse, type NextRequest } from 'next/server';
import { siteHosts, siteUrl } from '@/lib/site';
import { cookieOptions } from '@/lib/server/auth';
import { webConfig } from '@/lib/server/config';
import { SESSION_COOKIE } from '@/lib/server/session';

/**
 * Sign out of Seatline (POST, so a link on another site can't sign people out). Leaving the
 * demo (`to=site`) goes back to the website instead of the sign-in page.
 */
export async function POST(req: NextRequest) {
  const appUrl = webConfig().APP_URL;
  const to = String((await req.formData().catch(() => null))?.get('to') ?? '');
  const website = siteHosts(appUrl).length ? `${siteUrl(appUrl)}/` : new URL('/welcome', appUrl);
  const target = to === 'site' ? website : new URL('/signin?signedOut=1', appUrl);
  const res = NextResponse.redirect(target, 303);
  res.cookies.set(SESSION_COOKIE, '', cookieOptions(0));
  return res;
}
