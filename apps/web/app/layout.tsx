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
  return { title: t('name'), description: t('tagline') };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  // the website's texts are only used on the server: keep them out of every app page
  const { site: _site, ...messages } = await getMessages();
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
