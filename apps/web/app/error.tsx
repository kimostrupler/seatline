'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Centered } from '@/components/auth/centered';
import { Button } from '@/components/ui/button';
import { reportClientError } from '@/lib/client-errors';

/** A page crashed: say so plainly, report it, offer a way back. */
export default function PageError({ error, reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('errors');
  useEffect(() => reportClientError(error, 'render'), [error]);
  return (
    <Centered>
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('body')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={reset}>{t('retry')}</Button>
        <Button asChild variant="outline">
          <a href="/">{t('home')}</a>
        </Button>
      </div>
    </Centered>
  );
}
