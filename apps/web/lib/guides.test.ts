import { describe, expect, it } from 'vitest';
import { GUIDES, GUIDE_TEXT, guideAlternates, guideBySlug, guidePath } from './guides';

const LANGS = ['en', 'de', 'fr'] as const;

describe('guides', () => {
  it('every language has every guide, with the same shape', () => {
    for (const g of GUIDES) {
      const en = GUIDE_TEXT.en[g];
      for (const l of LANGS) {
        const text = GUIDE_TEXT[l][g];
        expect(text.sections.map((s) => s.bullets?.length ?? 0)).toEqual(
          en.sections.map((s) => s.bullets?.length ?? 0),
        );
        expect(text.table?.rows.length).toBe(en.table?.rows.length);
        for (const row of text.table?.rows ?? [])
          expect(row).toHaveLength(text.table!.columns.length + 1);
        expect(text.description.length).toBeLessThanOrEqual(170); // fits a search result
      }
    }
  });

  it('each address belongs to one guide and language', () => {
    const slugs = LANGS.flatMap((l) => GUIDES.map((g) => GUIDE_TEXT[l][g].slug));
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const l of LANGS)
      for (const g of GUIDES) {
        expect(guideBySlug(GUIDE_TEXT[l][g].slug)).toEqual({ guide: g, language: l });
        expect(guidePath(g, l)).toMatch(/^\/guides\/[a-z0-9-]+$/);
      }
    expect(guideBySlug('nope')).toBeUndefined();
  });

  it('links the languages to each other', () => {
    expect(guideAlternates('https://seatline.ch', 'excel')).toEqual({
      en: 'https://seatline.ch/guides/seatline-vs-excel',
      de: 'https://seatline.ch/guides/seatline-vs-excel-sitzplan',
      fr: 'https://seatline.ch/guides/seatline-vs-excel-plan-de-places',
      'x-default': 'https://seatline.ch/guides/seatline-vs-excel',
    });
  });

  it('German uses Swiss spelling', () => {
    expect(JSON.stringify(GUIDE_TEXT.de)).not.toContain('ß');
  });
});
