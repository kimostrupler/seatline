import { describe, expect, it } from 'vitest';
import { landingJsonLd, languageAlternates, pageUrl } from './seo';

describe('search engine data', () => {
  it('gives every language its own address', () => {
    expect(languageAlternates('https://seatline.ch')).toEqual({
      en: 'https://seatline.ch/',
      de: 'https://seatline.ch/de',
      fr: 'https://seatline.ch/fr',
      'x-default': 'https://seatline.ch/',
    });
    expect(pageUrl('https://seatline.ch', 'en')).toBe('https://seatline.ch/');
    expect(pageUrl('https://seatline.ch', 'fr')).toBe('https://seatline.ch/fr');
  });

  it('describes the product, its price and the questions', () => {
    const data = landingJsonLd({
      base: 'https://seatline.ch',
      language: 'de',
      name: 'Seatline',
      description: 'Sitzpläne',
      faq: [{ q: 'Wo sind die Daten?', a: 'In der Schweiz.' }],
    });
    const graph = data['@graph'];
    expect(graph.find((x) => x['@type'] === 'SoftwareApplication')).toMatchObject({
      offers: { price: '2.00', priceCurrency: 'CHF' },
      url: 'https://seatline.ch/de',
    });
    expect(graph.find((x) => x['@type'] === 'FAQPage')).toMatchObject({
      mainEntity: [{ name: 'Wo sind die Daten?', acceptedAnswer: { text: 'In der Schweiz.' } }],
    });
    // safe inside a <script> tag
    expect(JSON.stringify(data)).not.toContain('</');
  });
});
