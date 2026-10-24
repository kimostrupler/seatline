'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useDismissed } from '@/lib/use-dismissed';

const STEPS = ['colours', 'click', 'undo'] as const;

/**
 * First visit to the map: three short tips (colours, click a desk, undo) in a card over the
 * map. Skippable, and never shown again in this browser once closed or finished.
 */
export function MapTour({ canEdit }: { canEdit: boolean }) {
  const t = useTranslations('map.tour');
  const [hidden, hide] = useDismissed('seatline-map-tour-v1');
  const [step, setStep] = useState(0);
  if (hidden) return null;
  const id = STEPS[step]!;
  const last = step === STEPS.length - 1;
  return (
    <section
      className="absolute top-3 right-3 z-10 grid w-[min(20rem,calc(100%-1.5rem))] gap-2 rounded-xl border bg-card p-4 text-sm shadow-lg"
      aria-labelledby="map-tour-title"
      data-testid="map-tour"
      data-print="hide"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 id="map-tour-title" className="font-semibold">
          {t(`${id}.title`)}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="-mt-1 -mr-2 size-7"
          aria-label={t('skip')}
          onClick={hide}
        >
          <X />
        </Button>
      </div>
      <p className="text-muted-foreground">
        {id === 'click' && !canEdit ? t('click.bodyViewer') : t(`${id}.body`)}
      </p>
      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-xs text-muted-foreground tabular-nums">
          {t('progress', { n: step + 1, total: STEPS.length })}
        </span>
        <Button size="sm" onClick={last ? hide : () => setStep(step + 1)}>
          {last ? t('done') : t('next')}
        </Button>
      </div>
    </section>
  );
}
