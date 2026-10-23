'use client';

import { BookOpen, X } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { helpPath } from '@/lib/help';
import type { Language } from '@/lib/locales';
import { useDismissed } from '@/lib/use-dismissed';

/** Home: points to the help center until it is hidden (per browser). */
export function HelpBanner() {
  const t = useTranslations('dashboard.helpBanner');
  const language = useLocale().slice(0, 2) as Language;
  const [hidden, hide] = useDismissed('seatline.helpBanner.hidden');
  if (hidden) return null;
  return (
    <section
      className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4"
      data-testid="help-banner"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <BookOpen className="size-5" aria-hidden />
      </span>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="font-semibold">{t('title')}</p>
        <p className="text-sm text-muted-foreground">{t('body')}</p>
      </div>
      <Button asChild>
        <Link href={helpPath(language)}>{t('open')}</Link>
      </Button>
      <Button variant="ghost" size="icon" aria-label={t('hide')} onClick={hide}>
        <X />
      </Button>
    </section>
  );
}
