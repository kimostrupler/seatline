import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { webConfig } from '@/lib/server/config';
import { Providers } from './providers';
import './globals.css';

// Rendered per request: the sign-in mode (AUTH_MODE) and the user are only known at runtime.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('app');
  // the app isn't for search engines; the website's pages say otherwise themselves
  return { title: t('name'), description: t('tagline'), robots: { index: false, follow: false } };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  // the website's texts are only used on the server, and the owner dashboard's only on its own
  // page: keep both out of every app page
  const { site: _site, owner: _owner, ...messages } = await getMessages();
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <Providers authMode={webConfig().AUTH_MODE}>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
