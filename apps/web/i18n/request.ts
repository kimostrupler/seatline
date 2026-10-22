import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { LANGUAGE_COOKIE, LOCALES, PAGE_LANGUAGE_HEADER, pickLanguage } from '@/lib/locales';

// German, French or English: the website's language pages (/de, /fr — set by the middleware),
// else the person's choice (cookie), else their browser's language.
// Locales are Swiss (de-CH / fr-CH) or en-GB, so dates read "21 Sep 2026" with 24-hour time.
export default getRequestConfig(async () => {
  const h = await headers();
  const language = pickLanguage(
    h.get(PAGE_LANGUAGE_HEADER) ?? (await cookies()).get(LANGUAGE_COOKIE)?.value,
    h.get('accept-language'),
  );
  return {
    locale: LOCALES[language],
    timeZone: 'Europe/Zurich',
    messages: (await import(`../messages/${language}.json`)).default,
  };
});
