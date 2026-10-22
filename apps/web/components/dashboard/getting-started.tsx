'use client';

import { ArrowRight, Check, X } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useCallback, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { SETUP_LINKS, SETUP_STEPS, setupProgress } from '@/lib/getting-started';
import { useDirectory, useOverview } from '@/lib/queries';
import { cn } from '@/lib/utils';

// hidden per browser and workspace (a convenience; it also hides itself once all is done)
const key = (tenantId: string) => `seatline.gettingStarted.hidden.${tenantId}`;
const listeners = new Set<() => void>();

function useHidden(tenantId: string) {
  const hidden = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => {
      try {
        return localStorage.getItem(key(tenantId)) === '1';
      } catch {
        return false;
      }
    },
    () => true, // server: don't flash it
  );
  const hide = useCallback(() => {
    try {
      localStorage.setItem(key(tenantId), '1');
    } catch {
      // storage blocked — hidden until reload
    }
    listeners.forEach((l) => l());
  }, [tenantId]);
  return [hidden, hide] as const;
}

/** Home, for admins of a new workspace: the four steps to a working seating plan. */
export function GettingStarted({ tenantId }: { tenantId: string }) {
  const t = useTranslations('dashboard.gettingStarted');
  const overview = useOverview();
  const directory = useDirectory();
  const [hidden, hide] = useHidden(tenantId);
  const progress = setupProgress(overview.data, directory.data?.filter((p) => p.active).length);
  if (hidden || !progress || SETUP_STEPS.every((s) => progress[s])) return null;
  const done = SETUP_STEPS.filter((s) => progress[s]).length;
  const next = SETUP_STEPS.find((s) => !progress[s]);

  return (
    <section
      className="relative grid gap-4 rounded-xl border bg-card p-5"
      aria-labelledby="getting-started-title"
      data-testid="getting-started"
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-3 right-3 size-8"
        aria-label={t('hide')}
        onClick={hide}
      >
        <X />
      </Button>
      <div className="grid gap-1 pr-10">
        <h2 id="getting-started-title" className="font-semibold">
          {t('title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('progress', { done, total: SETUP_STEPS.length })}
        </p>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${(done / SETUP_STEPS.length) * 100}%` }}
          />
        </div>
      </div>
      <ol className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {SETUP_STEPS.map((step, i) => {
          const ok = progress[step];
          return (
            <li
              key={step}
              className={cn(
                'grid content-start gap-2 rounded-lg border p-3',
                step === next && 'border-primary/50 bg-primary/5',
              )}
            >
              <p className="flex items-center gap-2 text-sm font-medium">
                <span
                  className={cn(
                    'grid size-5 shrink-0 place-items-center rounded-full border text-xs',
                    ok && 'border-transparent bg-[var(--seat-free-stroke)] text-white',
                  )}
                  aria-hidden
                >
                  {ok ? <Check className="size-3" /> : i + 1}
                </span>
                <span className={cn(ok && 'text-muted-foreground line-through')}>
                  {t(`steps.${step}.title`)}
                </span>
                <span className="sr-only">{ok ? t('done') : t('todo')}</span>
              </p>
              {!ok && (
                <>
                  <p className="text-xs text-muted-foreground">{t(`steps.${step}.hint`)}</p>
                  <Button
                    asChild
                    size="sm"
                    variant={step === next ? 'default' : 'outline'}
                    className="justify-self-start"
                  >
                    <Link href={SETUP_LINKS[step]}>
                      {t(`steps.${step}.action`)} <ArrowRight />
                    </Link>
                  </Button>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
