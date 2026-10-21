import { sanitizeReport } from '@/lib/client-errors';

// Browser errors end up in the server log (Azure Log Analytics, Switzerland), where the
// error alert picks them up. A small per-instance budget keeps a broken page from flooding it.
const PER_MINUTE = 30;
let windowStart = 0;
let count = 0;

export async function POST(req: Request) {
  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    count = 0;
  }
  if (++count > PER_MINUTE) return new Response(null, { status: 429 });
  const text = (await req.text()).slice(0, 5000);
  let report;
  try {
    report = sanitizeReport(JSON.parse(text));
  } catch {
    report = null;
  }
  if (!report) return new Response(null, { status: 400 });
  console.error(
    `ERROR [client-error] ${report.kind} on ${report.path}: ${report.message}`,
    report.stack ?? '',
  );
  return new Response(null, { status: 204 });
}
