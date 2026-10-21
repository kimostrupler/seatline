import { NextResponse } from 'next/server';
import { cookieOptions } from '@/lib/server/auth';
import { webConfig } from '@/lib/server/config';
import { SESSION_COOKIE } from '@/lib/server/session';

/** Sign out of Seatline (POST, so a link on another site can't sign people out). */
export async function POST() {
  const res = NextResponse.redirect(new URL('/signin?signedOut=1', webConfig().APP_URL), 303);
  res.cookies.set(SESSION_COOKIE, '', cookieOptions(0));
  return res;
}
