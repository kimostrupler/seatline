import { SITE_LANGUAGE_PATHS, SITE_PRICE_CHF, SITE_VOLUME_PRICE_CHF } from './site';
import type { Language } from './locales';
import { OPERATOR } from './legal/operator';

/** hreflang alternates for the landing page (one address per language). */
export function languageAlternates(base: string) {
  return {
    en: `${base}${SITE_LANGUAGE_PATHS.en}`,
    de: `${base}${SITE_LANGUAGE_PATHS.de}`,
    fr: `${base}${SITE_LANGUAGE_PATHS.fr}`,
    'x-default': `${base}${SITE_LANGUAGE_PATHS.en}`,
  };
}

/** The landing page's address in a language. */
export const pageUrl = (base: string, language: Language) =>
  `${base}${SITE_LANGUAGE_PATHS[language]}`;

/**
 * Structured data (schema.org JSON-LD) for search engines and AI assistants: who we are, what
 * Seatline is and costs, and the questions and answers on the page.
 */
export function landingJsonLd(opts: {
  base: string;
  language: Language;
  name: string;
  description: string;
  faq: Array<{ q: string; a: string }>;
}) {
  const url = pageUrl(opts.base, opts.language);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${opts.base}/#organization`,
        name: 'Seatline',
        url: opts.base,
        logo: `${opts.base}/apple-icon.png`,
        email: OPERATOR.email,
        address: { '@type': 'PostalAddress', addressCountry: 'CH' },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${opts.base}/#software`,
        name: 'Seatline',
        url,
        description: opts.description,
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: 'Desk and seating management',
        operatingSystem: 'Web',
        inLanguage: ['de-CH', 'fr-CH', 'en'],
        offers: {
          '@type': 'Offer',
          price: SITE_PRICE_CHF.toFixed(2),
          priceCurrency: 'CHF',
          description: `Per active desk per month; CHF ${SITE_VOLUME_PRICE_CHF.toFixed(2)} for every desk from the 51st. 30 days free.`,
          priceSpecification: [
            {
              '@type': 'UnitPriceSpecification',
              price: SITE_PRICE_CHF.toFixed(2),
              priceCurrency: 'CHF',
              referenceQuantity: {
                '@type': 'QuantitativeValue',
                value: 1,
                unitText: 'desk per month',
              },
              eligibleQuantity: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 50 },
            },
            {
              '@type': 'UnitPriceSpecification',
              price: SITE_VOLUME_PRICE_CHF.toFixed(2),
              priceCurrency: 'CHF',
              referenceQuantity: {
                '@type': 'QuantitativeValue',
                value: 1,
                unitText: 'desk per month',
              },
              eligibleQuantity: { '@type': 'QuantitativeValue', minValue: 51 },
            },
          ],
        },
        publisher: { '@id': `${opts.base}/#organization` },
      },
      {
        '@type': 'WebPage',
        '@id': `${url}#page`,
        url,
        name: opts.name,
        description: opts.description,
        inLanguage: opts.language,
        isPartOf: { '@type': 'WebSite', url: opts.base, name: 'Seatline' },
      },
      {
        '@type': 'FAQPage',
        mainEntity: opts.faq.map(({ q, a }) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      },
    ],
  };
}
