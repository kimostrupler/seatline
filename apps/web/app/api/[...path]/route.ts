import type { NextRequest } from 'next/server';
import { webConfig } from '@/lib/server/config';
import { internalToken, readSession, SESSION_COOKIE } from '@/lib/server/session';

// Forwards /api/* to the NestJS API. The address is read at runtime (API_URL), so one
// build works in every environment and the API itself can stay private.
// Microsoft sign-in: the session cookie becomes a 60 s signed token for the API; anything
// identity-like the browser sends is dropped. Dev sign-in: the demo headers pass through.
const FORWARD_HEADERS = ['accept', 'content-type'];
/** Stripe calls this one directly (no session); it's verified by its signature in the API. */
const STRIPE_WEBHOOK = 'billing/webhook';
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
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const stripeWebhook = path.join('/') === STRIPE_WEBHOOK && req.method === 'POST';
  if (stripeWebhook) {
    const signature = req.headers.get('stripe-signature');
    if (signature) headers.set('stripe-signature', signature);
  } else if (config.AUTH_MODE === 'entra') {
    // changes only from our own pages (the Teams cookie is SameSite=None)
    const origin = req.headers.get('origin');
    if (hasBody && origin && origin !== new URL(config.APP_URL).origin)
      return Response.json({ message: 'Not allowed from another site' }, { status: 403 });
    const user = await readSession(req.cookies.get(SESSION_COOKIE)?.value, config.SESSION_SECRET);
    if (!user) return Response.json({ message: 'Sign in with Microsoft' }, { status: 401 });
    headers.set(
      'authorization',
      `Bearer ${await internalToken(user, config.INTERNAL_AUTH_SECRET)}`,
    );
  }
  const res = await fetch(url, {
    method: req.method,
    headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
    cache: 'no-store',
  });
  const out = new Headers({
    'content-type': res.headers.get('content-type') ?? 'application/json',
  });
  // downloads (exports) keep their file name; plan images keep their caching
  for (const name of ['content-disposition', 'cache-control', 'etag']) {
    const value = res.headers.get(name);
    if (value) out.set(name, value);
  }
  return new Response(res.status === 204 ? null : res.body, { status: res.status, headers: out });
}

export const dynamic = 'force-dynamic';
export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
