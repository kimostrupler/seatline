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

/** Address of the public website, e.g. https://seatline.ch (falls back to the app). */
export function siteUrl(appUrl: string): string {
  const apex = siteHosts(appUrl)[0];
  return apex ? `https://${apex}` : new URL(appUrl).origin;
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
    pathname.startsWith('/site-img/') ||
    pathname.startsWith('/fonts/') ||
    pathname === '/robots.txt' ||
    pathname === '/indexnow.txt' ||
    pathname === '/sitemap.xml'
  );
}

/** The landing page in German and French has its own address (for search engines). */
export const SITE_LANGUAGE_PATHS = { en: '/', de: '/de', fr: '/fr' } as const;

/** Price per active seat per month, as shown on the website (the real price lives in Stripe). */
export const SITE_PRICE_CHF = 2;

/** The landing page as seen from the app: the website's own domain, else /welcome on the app. */
export function websiteHref(appUrl: string): string {
  return siteHosts(appUrl).length ? `${siteUrl(appUrl)}/` : '/welcome';
}

/**
 * IndexNow (Bing, Yandex, Seznam…): the deploy tells them which website pages exist; this key,
 * served at /indexnow.txt, proves the site is ours. Public by design — not a secret.
 */
export const INDEXNOW_KEY = '4a804241a422b8f43ae8a72403f48098';
