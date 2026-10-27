import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import type { Language } from '@/lib/locales';
import { updatesPath } from '@/lib/updates';

/** /updates → What's new in the visitor's language. */
export default async function Updates() {
  redirect(updatesPath((await getLocale()).slice(0, 2) as Language));
}
