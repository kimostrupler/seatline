import 'server-only';
import { cookies } from 'next/headers';
import { webConfig } from './config';
import { internalToken, readSession, SESSION_COOKIE, type SessionUser } from './session';

export async function currentUser(): Promise<SessionUser | null> {
  const config = webConfig();
  if (config.AUTH_MODE !== 'entra') return null;
  return readSession((await cookies()).get(SESSION_COOKIE)?.value, config.SESSION_SECRET);
}

export type MembershipStatus =
  | 'ok'
  | 'no_workspace'
  | 'no_access'
  | 'inactive'
  /** e-mail sign-in: the address is in several workspaces */
  | 'choose'
  /** e-mail sign-in: the address only belongs to workspaces that sign in with Microsoft */
  | 'use_microsoft';

export interface Session {
  status: MembershipStatus;
  workspaces: Array<{ id: string; name: string }>;
}

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

export async function session(user: SessionUser): Promise<Session> {
  const res = await apiAsUser<Session>(user, '/auth/session', { method: 'POST' });
  if (res.status !== 200) throw new Error(`Session check failed (${res.status})`);
  return res.body;
}

export const membership = async (user: SessionUser) => (await session(user)).status;

/** Where to go after signing in (or when a page needs a member). */
export function landing(status: MembershipStatus): string {
  if (status === 'ok') return '/';
  if (status === 'no_workspace') return '/onboarding';
  if (status === 'choose') return '/signin/workspace';
  return `/no-access?reason=${status}`;
}

/** Public API calls made by the server before anyone is signed in (e-mail sign-in). */
export async function publicApi<T>(path: string, body?: unknown) {
  const res = await fetch(`${webConfig().API_URL}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as T };
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
