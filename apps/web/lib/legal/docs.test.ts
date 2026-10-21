import { describe, expect, it } from 'vitest';
import { LANGUAGES } from '@/lib/locales';
import { LEGAL_DOCS, LEGAL_TEXTS, legalText } from './docs';

describe('legal texts', () => {
  for (const doc of LEGAL_DOCS)
    it(`${doc}: every language has the same sections and paragraphs`, () => {
      const shape = (lang: (typeof LANGUAGES)[number]) =>
        LEGAL_TEXTS[doc][lang].map((s) => s.paragraphs.length);
      for (const lang of LANGUAGES) expect(shape(lang), lang).toEqual(shape('en'));
    });

  it('fills in the operator and leaves no unknown {placeholders}', () => {
    for (const doc of LEGAL_DOCS)
      for (const lang of LANGUAGES)
        for (const s of legalText(doc, lang))
          for (const p of s.paragraphs) expect(p, `${doc}/${lang}`).not.toMatch(/\{\w+\}/);
  });

  it('German is Swiss German (ss, not ß)', () => {
    expect(
      JSON.stringify(LEGAL_TEXTS.terms.de) + JSON.stringify(LEGAL_TEXTS.privacy.de),
    ).not.toContain('ß');
  });
});
