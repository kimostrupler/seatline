import type { MetadataRoute } from 'next';
import { LEGAL_UPDATED } from '@/lib/legal/operator';
import { webConfig } from '@/lib/server/config';
import { siteUrl } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl(webConfig().APP_URL);
  return [
    { url: `${base}/`, changeFrequency: 'monthly', priority: 1 },
    ...['terms', 'privacy', 'dpa', 'imprint'].map((doc) => ({
      url: `${base}/legal/${doc}`,
      lastModified: LEGAL_UPDATED,
      priority: 0.3,
    })),
  ];
}
