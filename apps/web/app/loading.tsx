import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/common/logo';

/**
 * Shown while a page loads — e.g. when the servers wake up after a quiet moment. The hint only
 * appears after a few seconds, so quick loads don't flash text.
 */
export default async function Loading() {
  const t = await getTranslations('loading');
  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas p-6 text-center"
      role="status"
      aria-live="polite"
      data-testid="app-loading"
    >
      <Logo className="size-14 animate-pulse" />
      <p className="text-sm font-medium">{t('title')}</p>
      <p className="loading-hint max-w-xs text-xs text-muted-foreground">{t('hint')}</p>
    </main>
  );
}
