import type { NextRequest } from 'next/server';
import { webConfig } from '@/lib/server/config';
import { internalToken, readSession, SESSION_COOKIE } from '@/lib/server/session';

// Forwards /api/* to the NestJS API. The address is read at runtime (API_URL), so one
// build works in every environment and the API itself can stay private.
// Microsoft sign-in: the session cookie becomes a 60 s signed token for the API; anything
// identity-like the browser sends is dropped. Dev sign-in: the demo headers pass through.
const FORWARD_HEADERS = ['accept', 'content-type'];
const DEV_HEADERS = ['x-tenant-id', 'x-user-id'];

async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const config = webConfig();
  const url = `${config.API_URL}/${path.map(encodeURIComponent).join('/')}${req.nextUrl.search}`;

  const headers = new Headers();
  const forward =
    config.AUTH_MODE === 'dev' ? [...FORWARD_HEADERS, ...DEV_HEADERS] : FORWARD_HEADERS;
  for (const name of forward) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (config.AUTH_MODE === 'entra') {
    const user = await readSession(req.cookies.get(SESSION_COOKIE)?.value, config.SESSION_SECRET);
    if (!user) return Response.json({ message: 'Sign in with Microsoft' }, { status: 401 });
    headers.set(
      'authorization',
      `Bearer ${await internalToken(user, config.INTERNAL_AUTH_SECRET)}`,
    );
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const res = await fetch(url, {
    method: req.method,
    headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
    cache: 'no-store',
  });
  return new Response(res.status === 204 ? null : res.body, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export const dynamic = 'force-dynamic';
export { proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE };
