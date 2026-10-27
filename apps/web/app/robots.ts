import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { webConfig } from '@/lib/server/config';
import { SITE_PAGE_PREFIXES, siteHosts, siteUrl } from '@/lib/site';

/** AI assistants' crawlers, welcome on the website (it's what we want them to know about us). */
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'Bingbot',
  'CCBot',
];

/** Search engines and AI crawlers may read the website (seatline.ch), never the app. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').split(':')[0]!.toLowerCase();
  const { APP_URL } = webConfig();
  // the app: nothing to read, except the website pages' old addresses, which redirect to the
  // site (crawlers must be allowed to fetch them to see the redirect)
  if (!siteHosts(APP_URL).includes(host))
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
        ...(siteHosts(APP_URL).length > 0 && { allow: [...SITE_PAGE_PREFIXES] }),
      },
    };
  return {
    rules: [
      { userAgent: '*', allow: '/' },
      { userAgent: AI_CRAWLERS, allow: '/' },
    ],
    sitemap: `${siteUrl(APP_URL)}/sitemap.xml`,
  };
}
