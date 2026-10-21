import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { LANGUAGE_COOKIE, LOCALES, pickLanguage } from '@/lib/locales';

// German, French or English: the person's choice (cookie), else their browser's language.
// Locales are Swiss (de-CH / fr-CH) or en-GB, so dates read "21 Sep 2026" with 24-hour time.
export default getRequestConfig(async () => {
  const language = pickLanguage(
    (await cookies()).get(LANGUAGE_COOKIE)?.value,
    (await headers()).get('accept-language'),
  );
  return {
    locale: LOCALES[language],
    timeZone: 'Europe/Zurich',
    messages: (await import(`../messages/${language}.json`)).default,
  };
});
