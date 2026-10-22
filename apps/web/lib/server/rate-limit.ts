import 'server-only';

const hits = new Map<string, number[]>();

/**
 * At most `max` calls per key within `windowMs` (in memory: per server instance, which is
 * enough against someone hammering one form; the API also limits per e-mail address).
 */
export function allow(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) hits.clear(); // never grows without bound
  return true;
}
