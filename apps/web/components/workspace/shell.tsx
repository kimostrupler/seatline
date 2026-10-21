'use client';

import { Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { BillingBanner } from '@/components/billing/billing-banner';

/** Three columns on desktop (sidebar · main · details); on phones the sidebar is a sheet. */
export function Shell({
  sidebar,
  title,
  headerEnd,
  main,
  details,
  detailsLabel,
  mobileDetails,
}: {
  sidebar: ReactNode;
  title: ReactNode;
  headerEnd?: ReactNode;
  main: ReactNode;
  details: ReactNode;
  detailsLabel: string;
  /** phones: the details as a bottom sheet (rendered by the caller) */
  mobileDetails?: ReactNode;
}) {
  const t = useTranslations('map');
  return (
    <div className="grid h-dvh grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_340px]">
      <aside className="hidden min-h-0 border-r lg:block">{sidebar}</aside>
      <main className="flex min-h-0 flex-col">
        <BillingBanner />
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 lg:hidden"
                aria-label={t('openSidebar')}
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0 pt-10">
              <SheetTitle className="sr-only">{t('openSidebar')}</SheetTitle>
              {/* room above for the sheet's close button, so it never covers the account menu */}
              {sidebar}
            </SheetContent>
          </Sheet>
          <h1 className="min-w-0 flex-1 truncate text-sm">{title}</h1>
          {headerEnd}
        </header>
        <div className="relative min-h-0 flex-1">{main}</div>
      </main>
      <aside
        className="hidden min-h-0 overflow-y-auto border-l p-4 lg:block"
        aria-label={detailsLabel}
      >
        {details}
      </aside>
      {mobileDetails}
    </div>
  );
}

export function MapMessage({
  text,
  action,
}: {
  text: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-canvas p-6 text-center">
      {text ? (
        <p className="text-sm text-muted-foreground">{text}</p>
      ) : (
        <Skeleton className="h-40 w-64" />
      )}
      {action && (
        <Button variant="outline" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
