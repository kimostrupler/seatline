'use client';

import Link from 'next/link';
import { AccountMenu } from '@/components/workspace/account-menu';
import { LanguageSelect } from './language-select';
import { Logo } from './logo';
import { NavLinks } from './nav-links';

/** The app's one navigation bar, the same on every page (map, view and edit mode included). */
export function TopBar() {
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
        <LanguageSelect compact />
        <div className="shrink-0 sm:w-52">
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
