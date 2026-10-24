import type { NextRequest } from 'next/server';
import { clientIp } from '@/lib/server/forms';
import { webConfig } from '@/lib/server/config';
import { tooLarge } from '@/lib/server/body-limit';
import { allow } from '@/lib/server/rate-limit';
import { siteHosts } from '@/lib/site';
import { siteVisit } from '@/lib/site-stats';

/**
 * Website statistics (lib/site-stats.ts): one anonymous log line per page view. The address is
 * only used, in memory, to stop one visitor from flooding the counts — never logged or stored.
 */
export async function POST(req: NextRequest) {
  if (!allow(`visit:${clientIp(req)}`, 60, 3_600_000)) return new Response(null, { status: 204 });
  if (tooLarge(req, 2000)) return new Response(null, { status: 413 });
  const appUrl = webConfig().APP_URL;
  let body: unknown = null;
  try {
    body = JSON.parse(await req.text());
  } catch {
    // not JSON
  }
  const visit = siteVisit(body, req.headers.get('user-agent') ?? '', [
    ...siteHosts(appUrl),
    new URL(appUrl).hostname,
  ]);
  if (visit) console.log(`[site-visit] ${JSON.stringify(visit)}`);
  return new Response(null, { status: 204 });
}
