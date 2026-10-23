import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { LanguageSelect } from '@/components/common/language-select';
import { Logo } from '@/components/common/logo';
import { Button } from '@/components/ui/button';
import { OPERATOR } from '@/lib/legal/operator';
import { LANGUAGES, LANGUAGE_NAMES, type Language } from '@/lib/locales';
import { helpPath } from '@/lib/help';
import { SITE_LANGUAGE_PATHS } from '@/lib/site';
import { SiteBeacon } from './site-beacon';
import { looksSignedIn } from '@/lib/server/auth';
import { webConfig } from '@/lib/server/config';

export const signInUrl = () => `${webConfig().APP_URL}/signin`;
/** The app itself, for visitors who are already signed in. */
export const appHomeUrl = () => `${webConfig().APP_URL}/`;
/** A demo workspace with sample data, no sign-up. */
export const demoUrl = () => `${webConfig().APP_URL}/auth/demo`;

/**
 * The landing page's languages as plain links (/, /de, /fr): each language has its own address,
 * which search engines index separately.
 */
async function LanguageLinks({
  paths = SITE_LANGUAGE_PATHS,
}: {
  paths?: Record<Language, string>;
}) {
  const current = (await getLocale()).slice(0, 2);
  return (
    <nav aria-label="Language" className="flex items-center gap-1 text-xs font-medium">
      {LANGUAGES.map((l) => (
        <a
          key={l}
          href={paths[l]}
          hrefLang={l}
          lang={l}
          title={LANGUAGE_NAMES[l]}
          aria-current={l === current ? 'page' : undefined}
          className={
            l === current
              ? 'rounded px-1.5 py-1 text-foreground'
              : 'rounded px-1.5 py-1 text-muted-foreground hover:text-foreground'
          }
        >
          {l.toUpperCase()}
        </a>
      ))}
    </nav>
  );
}

/** Top bar of the public website (landing page and legal pages). */
export async function SiteHeader({
  languagePaths,
}: {
  /** pages whose address says their language (landing page, help center) link to the others */
  languagePaths?: Record<Language, string>;
}) {
  const t = await getTranslations('site');
  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:px-6">
        <Link href="/" className="mr-auto flex items-center gap-2 font-semibold">
          <Logo className="size-7" />
          Seatline
        </Link>
        <Button asChild variant="ghost" size="sm">
          <Link href={helpPath((await getLocale()).slice(0, 2) as Language)}>{t('navHelp')}</Link>
        </Button>
        {languagePaths ? <LanguageLinks paths={languagePaths} /> : <LanguageSelect compact />}
        {(await looksSignedIn()) ? (
          <Button asChild size="sm">
            <a href={appHomeUrl()}>{t('openApp')}</a>
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <a href={signInUrl()}>{t('signIn')}</a>
          </Button>
        )}
      </div>
    </header>
  );
}

export async function SiteFooter() {
  const t = await getTranslations();
  return (
    <footer className="border-t bg-canvas">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-8 text-sm text-muted-foreground sm:px-6">
        <span className="flex items-center gap-2 font-medium text-foreground">
          <Logo className="size-5" /> Seatline
        </span>
        <span>{t('site.madeIn')}</span>
        <a className="hover:text-foreground" href={`mailto:${OPERATOR.email}`}>
          {OPERATOR.email}
        </a>
        <nav
          aria-label={t('legal.legalLinks')}
          className="flex flex-wrap gap-x-4 gap-y-1 sm:ml-auto"
        >
          <LegalLinks />
        </nav>
        <span className="w-full text-xs">
          {t('site.copyright', { year: new Date().getFullYear() })}
        </span>
      </div>
    </footer>
  );
}

/** Terms · Privacy · Imprint, for footers (site, sign-in page, account menu). */
export async function LegalLinks({ className }: { className?: string }) {
  const t = await getTranslations('legal');
  return (['terms', 'privacy', 'dpa', 'imprint'] as const).map((doc) => (
    <Link key={doc} href={`/legal/${doc}`} className={className ?? 'hover:text-foreground'}>
      {t(doc)}
    </Link>
  ));
}

export function SitePage({
  children,
  languagePaths,
}: {
  children: ReactNode;
  languagePaths?: Record<Language, string>;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader languagePaths={languagePaths} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <SiteBeacon />
    </div>
  );
}
