'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { AccountMenu } from '@/components/workspace/account-menu';
import { helpPath, helpTopicFor } from '@/lib/help';
import { videoPath } from '@/lib/help/video-path';
import { updatesPath } from '@/lib/updates/path';
import type { Language } from '@/lib/locales';
import { HelpMenu } from './help-menu';
import { LanguageSelect } from './language-select';
import { Logo } from './logo';
import { MobileTabBar } from './mobile-tab-bar';
import { NavLinks } from './nav-links';

/** The app's one navigation bar, the same on every page (map, view and edit mode included). */
export function TopBar() {
  const t = useTranslations('nav');
  const language = useLocale().slice(0, 2) as Language;
  // Help opens the topic for this page (map, moves, people…)
  const pathname = usePathname();
  const search = useSearchParams();
  return (
    <>
      <header
        className="sticky top-0 z-20 shrink-0 border-b bg-background/95 backdrop-blur"
        data-testid="top-bar"
      >
        {/* full width everywhere, so the links never move between pages */}
        <div className="flex items-center gap-2 px-4 py-2 sm:px-6">
          <Link
            href="/"
            className="shrink-0 rounded-md"
            aria-label="Seatline"
            data-testid="app-logo"
          >
            <Logo className="size-7" />
          </Link>
          {/* phones: the pages are in the bottom tab bar instead */}
          <div className="min-w-0 flex-1">
            <div className="max-md:hidden">
              <NavLinks orientation="horizontal" />
            </div>
          </div>
          <HelpMenu
            label={t('help')}
            newTab
            className="shrink-0 text-foreground max-md:hidden"
            items={[
              {
                href: helpPath(language, helpTopicFor(pathname, search)),
                label: t('helpPage'),
                icon: 'help',
              },
              { href: videoPath(language), label: t('videoTour'), icon: 'video' },
              { href: updatesPath(language), label: t('updates'), icon: 'updates' },
            ]}
          />
          <LanguageSelect compact />
          <div className="shrink-0 sm:w-52">
            <AccountMenu />
          </div>
        </div>
      </header>
      {/* outside the header: its backdrop blur would pin a fixed child to the header */}
      <MobileTabBar />
    </>
  );
}
