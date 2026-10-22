import { INDEXNOW_KEY } from '@/lib/site';

/** The IndexNow key (see INDEXNOW_KEY): search engines fetch it to check our pings. */
export function GET() {
  return new Response(INDEXNOW_KEY, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
