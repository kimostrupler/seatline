'use client';

import type { ReactNode } from 'react';
import { AccountMenu } from '@/components/workspace/account-menu';
import { cn } from '@/lib/utils';
import { NavLinks } from './nav-links';

/** Pages next to the map (Home, Overview, Activity, People & access): top bar + title. */
export function PageFrame({
  title,
  actions,
  wide,
  children,
}: {
  title: ReactNode;
  /** buttons on the right of the title */
  actions?: ReactNode;
  /** dashboards use the full width */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div
          className={cn(
            'mx-auto flex items-center gap-2 px-4 py-2 sm:px-6',
            wide ? 'max-w-7xl' : 'max-w-3xl',
          )}
        >
          <div className="min-w-0 flex-1">
            <NavLinks orientation="horizontal" />
          </div>
          <div className="w-52 shrink-0 max-sm:w-40">
            <AccountMenu withNav={false} />
          </div>
        </div>
      </header>
      <main
        className={cn('mx-auto grid gap-8 px-4 py-6 sm:px-6', wide ? 'max-w-7xl' : 'max-w-3xl')}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
        {children}
      </main>
    </div>
  );
}

export function PageSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}
