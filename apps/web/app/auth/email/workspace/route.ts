import type { NextRequest } from 'next/server';
import { cookieOptions, currentUser, landing, membership } from '@/lib/server/auth';
import { webConfig } from '@/lib/server/config';
import { fromThisApp, seeOther } from '@/lib/server/forms';
import { SESSION_COOKIE, SESSION_HOURS, sealSession } from '@/lib/server/session';

/** An address in several workspaces picks one (the API checks it really belongs to it). */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!fromThisApp(req) || user?.kind !== 'email') return seeOther('/signin');
  const tenantId = String((await req.formData()).get('tenantId') ?? '');
  const picked = { ...user, tenantId: /^[0-9a-f-]{36}$/i.test(tenantId) ? tenantId : null };
  const out = seeOther(landing(await membership(picked)));
  out.cookies.set(
    SESSION_COOKIE,
    await sealSession(picked, webConfig().SESSION_SECRET),
    cookieOptions(SESSION_HOURS * 3600),
  );
  return out;
}
