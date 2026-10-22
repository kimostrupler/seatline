import type { MetadataRoute } from 'next';
import { LEGAL_UPDATED } from '@/lib/legal/operator';
import { webConfig } from '@/lib/server/config';
import { languageAlternates } from '@/lib/seo';
import { siteUrl, SITE_LANGUAGE_PATHS } from '@/lib/site';

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
    ...['terms', 'privacy', 'dpa', 'imprint'].map((doc) => ({
      url: `${base}/legal/${doc}`,
      lastModified: LEGAL_UPDATED,
      priority: 0.3,
    })),
  ];
}
