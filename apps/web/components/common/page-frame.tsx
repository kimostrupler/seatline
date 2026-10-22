'use client';

import type { ReactNode } from 'react';
import { BillingBanner } from '@/components/billing/billing-banner';
import { cn } from '@/lib/utils';
import { TopBar } from './top-bar';

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
  /** dashboards use the full width; lists and tables a bit more than text pages */
  wide?: boolean | 'medium';
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <BillingBanner />
      <TopBar />
      <main
        className={cn(
          'mx-auto grid gap-8 px-4 py-6 sm:px-6',
          wide === 'medium' ? 'max-w-5xl' : wide ? 'max-w-7xl' : 'max-w-3xl',
        )}
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
