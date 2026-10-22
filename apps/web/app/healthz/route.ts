import { webConfig } from '@/lib/server/config';

/** For the uptime check: the web app answers and can reach the API (and its database). */
export async function GET() {
  try {
    const res = await fetch(`${webConfig().API_URL}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return Response.json({ ok: true });
  } catch {
    // reported below
  }
  return Response.json({ ok: false }, { status: 503 });
}

export const dynamic = 'force-dynamic';
