import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { webConfig } from '@/lib/server/config';
import { siteHosts, siteUrl } from '@/lib/site';

/** Search engines may index the website (seatline.ch), never the app. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').split(':')[0]!.toLowerCase();
  const { APP_URL } = webConfig();
  if (!siteHosts(APP_URL).includes(host)) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${siteUrl(APP_URL)}/sitemap.xml`,
  };
}
