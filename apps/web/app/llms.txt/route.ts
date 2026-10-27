import { getTranslations } from 'next-intl/server';
import { HELP, HELP_TOPICS, helpPath } from '@/lib/help';
import { TEMPLATE, templatePath } from '@/lib/help/template';
import { VIDEO, videoPath } from '@/lib/help/video';
import { POSTS, updatesPath } from '@/lib/updates';
import { webConfig } from '@/lib/server/config';
import { SITE_PRICE_CHF, SITE_VOLUME_PRICE_CHF, siteUrl } from '@/lib/site';

/**
 * /llms.txt: a plain summary of Seatline for AI assistants and their crawlers (llmstxt.org),
 * built from the website's own texts so it never drifts.
 */
export async function GET() {
  const t = await getTranslations({ locale: 'en-GB', namespace: 'site' });
  const base = siteUrl(webConfig().APP_URL);
  const features = Array.from(
    { length: 11 },
    (_, i) => `- ${t(`f${i + 1}Title` as 'f1Title')}: ${t(`f${i + 1}Body` as 'f1Body')}`,
  );
  const faq = Array.from(
    { length: 8 },
    (_, i) => `### ${t(`q${i + 1}` as 'q1')}\n\n${t(`a${i + 1}` as 'a1')}`,
  );
  const text = `# Seatline

> ${t('metaDescription')}

Seatline is web software for office seat management, made in Switzerland: companies draw or import their floor plans, give people a desk, plan moves and keep the history. Data is hosted in Switzerland (Microsoft Azure, Zurich). Available in German, French and English. Price: CHF ${SITE_PRICE_CHF} per active desk per month for the first 50 desks, CHF ${SITE_VOLUME_PRICE_CHF} for every desk from the 51st; 30 days free.

## Features

${features.join('\n')}

## Questions

${faq.join('\n\n')}

## Help center (step by step, with screenshots)

${HELP_TOPICS.map((t) => `- [${HELP.en.topics[t].title}](${base}${helpPath('en', t)}): ${HELP.en.topics[t].summary}`).join('\n')}

## Video tour

- [${VIDEO.en.title}](${base}${videoPath('en')}): ${VIDEO.en.intro} ${VIDEO.en.spoken} The page has chapters and the whole text. (Also with [German](${base}${videoPath('de')}) and [French](${base}${videoPath('fr')}) subtitles.)

## What's new (latest first)

${POSTS.slice(0, 5)
  .map(
    (p) =>
      `- ${p.date}: [${p.text.en.title}](${base}${updatesPath('en', p.slug)}): ${p.text.en.summary}`,
  )
  .join('\n')}

All updates: ${base}${updatesPath('en')}

## Free download

- [${TEMPLATE.en.title}](${base}${templatePath('en')}): ${TEMPLATE.en.intro} (also in [German](${base}${templatePath('de')}) and [French](${base}${templatePath('fr')}))

## Links

- [Website](${base}/) (also in [German](${base}/de) and [French](${base}/fr))
- [Try the demo](${webConfig().APP_URL}/auth/demo): a sample office, no sign-up
- [Terms of service](${base}/legal/terms)
- [Privacy policy](${base}/legal/privacy)
- [Data processing agreement](${base}/legal/dpa)
- [Imprint](${base}/legal/imprint)
`;
  return new Response(text, { headers: { 'content-type': 'text/markdown; charset=utf-8' } });
}
