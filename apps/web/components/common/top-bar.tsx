'use client';

import { CircleHelp } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { AccountMenu } from '@/components/workspace/account-menu';
import { helpPath } from '@/lib/help';
import type { Language } from '@/lib/locales';
import { LanguageSelect } from './language-select';
import { Logo } from './logo';
import { NavLinks } from './nav-links';

/** The app's one navigation bar, the same on every page (map, view and edit mode included). */
export function TopBar() {
  const t = useTranslations('nav');
  const language = useLocale().slice(0, 2) as Language;
  return (
    <header
      className="sticky top-0 z-20 shrink-0 border-b bg-background/95 backdrop-blur"
      data-testid="top-bar"
    >
      {/* full width everywhere, so the links never move between pages */}
      <div className="flex items-center gap-2 px-4 py-2 sm:px-6">
        <Link href="/" className="shrink-0 rounded-md" aria-label="Seatline" data-testid="app-logo">
          <Logo className="size-7" />
        </Link>
        <div className="min-w-0 flex-1">
          <NavLinks orientation="horizontal" />
        </div>
        <Button asChild variant="ghost" size="sm" className="shrink-0" data-testid="help-link">
          <Link href={helpPath(language)} target="_blank" rel="noopener">
            <CircleHelp /> <span className="max-md:sr-only">{t('help')}</span>
          </Link>
        </Button>
        <LanguageSelect compact />
        <div className="shrink-0 sm:w-52">
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
