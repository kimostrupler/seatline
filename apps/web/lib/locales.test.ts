import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LANGUAGES, pickLanguage } from './locales';

describe('language', () => {
  it('the saved choice wins, then the browser, else English', () => {
    expect(pickLanguage('fr', 'de-CH,de;q=0.9')).toBe('fr');
    expect(pickLanguage(undefined, 'de-CH,de;q=0.9,en;q=0.8')).toBe('de');
    expect(pickLanguage(undefined, 'it-CH, fr;q=0.7, en;q=0.9')).toBe('en');
    expect(pickLanguage(undefined, 'it-CH,es')).toBe('en');
    expect(pickLanguage('xx', null)).toBe('en');
  });
});

type Tree = { [k: string]: string | Tree };
const flat = (o: Tree, p = ''): Record<string, string> =>
  Object.fromEntries(
    Object.entries(o).flatMap(([k, v]) =>
      typeof v === 'string' ? [[p + k, v]] : Object.entries(flat(v, `${p}${k}.`)),
    ),
  );
const load = (lang: string) =>
  flat(JSON.parse(readFileSync(new URL(`../messages/${lang}.json`, import.meta.url), 'utf8')));
/** {name}, {count, plural, …} → the variable names a text uses (not plural branches like =0 {…}) */
const vars = (text: string) =>
  [
    ...new Set(
      [...text.matchAll(/(?<!(?:=\d+|zero|one|two|few|many|other)\s*)\{\s*(\w+)\s*[,}]/g)].map(
        (m) => m[1],
      ),
    ),
  ].sort();

describe('translations', () => {
  const en = load('en');
  for (const lang of LANGUAGES.filter((l) => l !== 'en')) {
    it(`${lang} has every text, with the same placeholders`, () => {
      const other = load(lang);
      expect(Object.keys(other).sort()).toEqual(Object.keys(en).sort());
      for (const [key, text] of Object.entries(en))
        expect(vars(other[key]!), `${lang}: ${key}`).toEqual(vars(text));
    });
  }
});
