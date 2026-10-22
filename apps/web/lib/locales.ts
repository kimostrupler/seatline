/** UI languages. The value is the formatting locale (Swiss conventions for de/fr). */
export const LOCALES = { de: 'de-CH', fr: 'fr-CH', en: 'en-GB' } as const;
export type Language = keyof typeof LOCALES;
export const LANGUAGES = Object.keys(LOCALES) as Language[];
export const LANGUAGE_COOKIE = 'seatline-language';
/** Set by the middleware for the website's /de and /fr pages (one address per language for search engines). */
export const PAGE_LANGUAGE_HEADER = 'x-seatline-language';
export const LANGUAGE_NAMES: Record<Language, string> = {
  de: 'Deutsch',
  fr: 'Français',
  en: 'English',
};

const isLanguage = (v: string | undefined): v is Language => !!v && v in LOCALES;

/** The person's choice (cookie) wins; otherwise the browser's preferred language; else English. */
export function pickLanguage(cookie: string | undefined, acceptLanguage: string | null): Language {
  if (isLanguage(cookie)) return cookie;
  const wanted = (acceptLanguage ?? '')
    .split(',')
    .map((part) => {
      const [tag = '', q] = part.trim().split(';q=');
      return { lang: tag.slice(0, 2).toLowerCase(), q: q ? Number(q) : 1 };
    })
    .filter((x) => x.lang && x.q > 0)
    .sort((a, b) => b.q - a.q);
  return wanted.map((x) => x.lang).find(isLanguage) ?? 'en';
}
