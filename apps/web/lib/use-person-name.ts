'use client';

import { useTranslations } from 'next-intl';

/** How the database names people whose personal data was removed (see forget_person). */
export const FORGOTTEN_NAME = 'Former employee';

/** A person's name for display: forgotten people get "Former employee" in the UI's language. */
export function usePersonName() {
  const t = useTranslations('admin.privacy');
  return (name: string) => (name === FORGOTTEN_NAME ? t('formerEmployee') : name);
}
