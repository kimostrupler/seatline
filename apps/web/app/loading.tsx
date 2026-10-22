import { getTranslations } from 'next-intl/server';

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
      <svg aria-hidden viewBox="0 0 24 24" className="size-14 animate-pulse">
        <rect x="2" y="2" width="20" height="20" rx="6" fill="var(--primary)" />
        <rect x="6" y="6.5" width="5" height="4.5" rx="1.2" fill="white" />
        <rect x="13" y="6.5" width="5" height="4.5" rx="1.2" fill="white" opacity="0.55" />
        <rect x="6" y="13" width="5" height="4.5" rx="1.2" fill="white" opacity="0.55" />
        <rect x="13" y="13" width="5" height="4.5" rx="1.2" fill="#4ade80" />
      </svg>
      <p className="text-sm font-medium">{t('title')}</p>
      <p className="loading-hint max-w-xs text-xs text-muted-foreground">{t('hint')}</p>
    </main>
  );
}
