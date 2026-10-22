import type { NextRequest } from 'next/server';
import { getLocale } from 'next-intl/server';
import { publicApi } from '@/lib/server/auth';
import { webConfig } from '@/lib/server/config';
import { clientIp, fromThisApp, seeOther } from '@/lib/server/forms';
import { allow } from '@/lib/server/rate-limit';

/** "Send me a sign-in link": the API e-mails a one-time link; we show "check your inbox". */
export async function POST(req: NextRequest) {
  if (webConfig().AUTH_MODE !== 'entra' || !fromThisApp(req)) return seeOther('/signin');
  const form = await req.formData();
  const email = String(form.get('email') ?? '').trim();
  const back = (error: string) =>
    seeOther(`/signin?error=${error}&email=${encodeURIComponent(email)}`);
  if (!allow(`ip:${clientIp(req)}`, 10, 60 * 60_000)) return back('too_many');
  const res = await publicApi('/auth/email/start', {
    email,
    language: (await getLocale()).slice(0, 2),
  });
  if (res.status === 200) return seeOther(`/signin/check?email=${encodeURIComponent(email)}`);
  return back(res.status === 400 ? 'bad_email' : res.status === 429 ? 'too_many' : 'failed');
}
