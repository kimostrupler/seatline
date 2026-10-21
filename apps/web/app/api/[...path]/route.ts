import type { NextRequest } from 'next/server';

// Forwards /api/* to the NestJS API. The address is read at runtime (API_URL), so one
// build works in every environment and the API itself can stay private.
const FORWARD_HEADERS = ['accept', 'authorization', 'content-type', 'x-tenant-id', 'x-user-id'];

async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const base = process.env.API_URL ?? 'http://localhost:3001';
  const url = `${base}/${path.map(encodeURIComponent).join('/')}${req.nextUrl.search}`;

  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
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
