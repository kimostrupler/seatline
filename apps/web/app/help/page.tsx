import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { helpPath } from '@/lib/help';
import type { Language } from '@/lib/locales';

/** /help → the help center in the visitor's language. */
export default async function Help() {
  redirect(helpPath((await getLocale()).slice(0, 2) as Language));
}
