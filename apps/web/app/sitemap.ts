import type { MetadataRoute } from 'next';
import { LEGAL_UPDATED } from '@/lib/legal/operator';
import { webConfig } from '@/lib/server/config';
import { HELP_TOPICS, helpAlternates, helpPath } from '@/lib/help';
import { templatePath } from '@/lib/help/template';
import { videoPath } from '@/lib/help/video';
import { languageAlternates } from '@/lib/seo';
import { POSTS, updatesPath } from '@/lib/updates';
import { siteUrl, SITE_LANGUAGE_PATHS } from '@/lib/site';

// built per request: APP_URL is only known at runtime (a build-time sitemap said localhost)
export const dynamic = 'force-dynamic';

/** The website's pages: the landing page in each language (with hreflang) and the legal pages. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl(webConfig().APP_URL);
  const languages = languageAlternates(base);
  return [
    ...Object.values(SITE_LANGUAGE_PATHS).map((path) => ({
      url: `${base}${path}`,
      changeFrequency: 'monthly' as const,
      priority: 1,
      alternates: { languages },
    })),
    ...[undefined, ...HELP_TOPICS].flatMap((topic) =>
      (['en', 'de', 'fr'] as const).map((language) => ({
        url: `${base}${helpPath(language, topic)}`,
        changeFrequency: 'monthly' as const,
        priority: topic ? 0.6 : 0.8,
        alternates: { languages: helpAlternates(base, topic) },
      })),
    ),
    ...(['en', 'de', 'fr'] as const).map((language) => ({
      url: `${base}${updatesPath(language)}`,
      lastModified: POSTS[0]?.date,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
      alternates: {
        languages: Object.fromEntries(
          (['en', 'de', 'fr'] as const).map((l) => [l, `${base}${updatesPath(l)}`]),
        ),
      },
    })),
    ...[templatePath, videoPath].flatMap((path) =>
      (['en', 'de', 'fr'] as const).map((language) => ({
        url: `${base}${path(language)}`,
        changeFrequency: 'monthly' as const,
        priority: 0.7,
        alternates: {
          languages: Object.fromEntries(
            (['en', 'de', 'fr'] as const).map((l) => [l, `${base}${path(l)}`]),
          ),
        },
      })),
    ),
    ...['terms', 'privacy', 'dpa', 'imprint'].map((doc) => ({
      url: `${base}/legal/${doc}`,
      lastModified: LEGAL_UPDATED,
      priority: 0.3,
    })),
  ];
}
