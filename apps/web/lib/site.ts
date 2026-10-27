import { PRICE_TIERS } from '@seatline/shared/dist/pricing';
/**
 * The public website (landing page + legal pages) lives on the app's parent domain:
 * app.seatline.ch → seatline.ch and www.seatline.ch. Other app addresses (localhost, the
 * Azure address) have no site domain; there the landing page is at /welcome.
 */
export function siteHosts(appUrl: string): string[] {
  const parts = new URL(appUrl).hostname.split('.');
  if (parts.length !== 3) return [];
  const apex = parts.slice(1).join('.');
  return [apex, `www.${apex}`];
}

/** Website pages (not files): on the app's address they're copies of the site's. */
export const SITE_PAGE_PREFIXES = ['/welcome', '/help', '/updates', '/legal/'] as const;
const isSitePage = (pathname: string) =>
  SITE_PAGE_PREFIXES.some((p) =>
    p.endsWith('/') ? pathname.startsWith(p) : pathname === p || pathname.startsWith(`${p}/`),
  );

/**
 * One address per page, so search engines don't see duplicates: www.seatline.ch → seatline.ch,
 * seatline.ch/welcome → seatline.ch/, and website pages opened on the app's address
 * (app.seatline.ch/help/…) → the same page on seatline.ch. Null = serve it here. Without a site
 * domain (local, e2e, the Azure address) nothing moves.
 */
export function canonicalRedirect(
  appUrl: string,
  host: string,
  pathname: string,
  search: string,
): string | null {
  const [apex, www] = siteHosts(appUrl);
  if (!apex) return null;
  const site = `https://${apex}`;
  if (host === www) return `${site}${pathname}${search}`;
  if (host === apex) return pathname === '/welcome' ? `${site}/${search}` : null;
  if (host === new URL(appUrl).hostname && isSitePage(pathname))
    return `${site}${pathname === '/welcome' ? '/' : pathname}${search}`;
  return null;
}

/** Address of the public website, e.g. https://seatline.ch (falls back to the app). */
export function siteUrl(appUrl: string): string {
  const apex = siteHosts(appUrl)[0];
  return apex ? `https://${apex}` : new URL(appUrl).origin;
}

/**
 * Short links for e-mails (seatline.ch/video, /de/video, /fr/video): where they lead, the landing
 * page in that language scrolled to the promo video, keeping ?utm_source=… for the statistics.
 * Without a site domain (local, e2e) the English landing page is /welcome, since / is the app.
 */
export function videoLink(appUrl: string, pathname: string, search: string): string | null {
  const match = /^\/(?:(de|fr)\/)?video\/?$/.exec(pathname);
  if (!match) return null;
  const site = siteUrl(appUrl);
  const path = match[1] ? `/${match[1]}` : siteHosts(appUrl).length ? '/' : '/welcome';
  return `${site}${path}${search}#video`;
}

/** Paths anyone may open without signing in (on the app and the site domain). */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/welcome' ||
    pathname === '/de' ||
    pathname === '/fr' ||
    pathname === '/llms.txt' ||
    pathname === '/og-image' ||
    pathname.startsWith('/icon') ||
    pathname.startsWith('/apple-icon') ||
    pathname.startsWith('/legal/') ||
    pathname === '/help' ||
    pathname.startsWith('/help/') ||
    pathname.startsWith('/help-img/') ||
    pathname === '/updates' ||
    pathname.startsWith('/updates/') ||
    pathname.startsWith('/updates-img/') ||
    pathname.startsWith('/site-img/') ||
    pathname.startsWith('/site-video/') ||
    pathname.startsWith('/templates/') ||
    pathname.startsWith('/fonts/') ||
    pathname === '/robots.txt' ||
    pathname === '/indexnow.txt' ||
    pathname === '/sitemap.xml'
  );
}

/** The landing page in German and French has its own address (for search engines). */
export const SITE_LANGUAGE_PATHS = { en: '/', de: '/de', fr: '/fr' } as const;

/** Price per active seat per month, as shown on the website (the real price lives in Stripe). */
export const SITE_PRICE_CHF = PRICE_TIERS[0]!.amount;
/** … and for every seat from the 51st (PRICE_TIERS). */
export const SITE_VOLUME_PRICE_CHF = PRICE_TIERS[1]!.amount;

/** The landing page as seen from the app: the website's own domain, else /welcome on the app. */
export function websiteHref(appUrl: string): string {
  return siteHosts(appUrl).length ? `${siteUrl(appUrl)}/` : '/welcome';
}

/**
 * IndexNow (Bing, Yandex, Seznam…): the deploy tells them which website pages exist; this key,
 * served at /indexnow.txt, proves the site is ours. Public by design — not a secret.
 */
export const INDEXNOW_KEY = '4a804241a422b8f43ae8a72403f48098';
