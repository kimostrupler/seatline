import 'server-only';
import { cookies } from 'next/headers';
import { webConfig } from './config';
import { internalToken, readSession, SESSION_COOKIE, type SessionUser } from './session';

export async function currentUser(): Promise<SessionUser | null> {
  const config = webConfig();
  if (config.AUTH_MODE !== 'entra') return null;
  return readSession((await cookies()).get(SESSION_COOKIE)?.value, config.SESSION_SECRET);
}

export type MembershipStatus = 'ok' | 'no_workspace' | 'no_access' | 'inactive';

/** Server-side call to the API as the signed-in user. */
export async function apiAsUser<T>(
  user: SessionUser,
  path: string,
  init?: { method?: string; body?: unknown },
) {
  const config = webConfig();
  const res = await fetch(`${config.API_URL}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      authorization: `Bearer ${await internalToken(user, config.INTERNAL_AUTH_SECRET)}`,
      ...(init?.body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as T };
}

export async function membership(user: SessionUser): Promise<MembershipStatus> {
  const res = await apiAsUser<{ status: MembershipStatus }>(user, '/auth/session', {
    method: 'POST',
  });
  if (res.status !== 200) throw new Error(`Session check failed (${res.status})`);
  return res.body.status;
}

export function cookieOptions(maxAgeSeconds: number, path = '/') {
  return {
    httpOnly: true,
    secure: webConfig().APP_URL.startsWith('https://'),
    sameSite: 'lax' as const,
    path,
    maxAge: maxAgeSeconds,
  };
}
