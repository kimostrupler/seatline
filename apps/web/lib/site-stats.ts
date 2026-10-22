/**
 * Website statistics without tracking: each page view (and click on a main button) becomes
 * one log line — page, referring site, campaign, language, phone or computer. No cookies, no
 * IP address, no identifier, nothing that links two visits. Logs stay in Switzerland.
 */
export const SITE_EVENTS = ['view', 'cta-trial', 'cta-demo'] as const;
export type SiteEvent = (typeof SITE_EVENTS)[number];

export interface SiteVisit {
  event: SiteEvent;
  path: string;
  /** the referring website's host, or "direct" */
  ref: string;
  /** ?utm_source=… (a campaign), or "" */
  source: string;
  lang: string;
  device: 'mobile' | 'desktop';
}

const token = (v: unknown, max: number) =>
  typeof v === 'string'
    ? v
        .toLowerCase()
        .replace(/[^a-z0-9.-]/g, '')
        .slice(0, max)
    : '';

/** Checks and trims what the page sends; null = not a website visit we count. */
export function siteVisit(body: unknown, userAgent: string, ownHosts: string[]): SiteVisit | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const event = SITE_EVENTS.find((e) => e === b.event);
  const path = typeof b.path === 'string' ? b.path : '';
  if (!event || !/^\/(welcome|legal\/(terms|privacy|dpa|imprint))?$/.test(path)) return null;
  let ref = '';
  try {
    ref = typeof b.ref === 'string' && b.ref ? new URL(b.ref).hostname.toLowerCase() : '';
  } catch {
    ref = '';
  }
  if (ownHosts.includes(ref)) ref = ''; // moving around our own site isn't a referral
  return {
    event,
    path: path === '/welcome' ? '/' : path,
    ref: token(ref.replace(/^www\./, ''), 100) || 'direct',
    source: token(b.source, 50),
    lang: token(b.lang, 2),
    device: /Mobi|Android|iPhone|iPad/i.test(userAgent) ? 'mobile' : 'desktop',
  };
}
