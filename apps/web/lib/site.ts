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
    pathname.startsWith('/legal/') ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  );
}

/** Price per active seat per month, as shown on the website (the real price lives in Stripe). */
export const SITE_PRICE_CHF = 2;
