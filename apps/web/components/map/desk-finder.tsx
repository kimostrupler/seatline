'use client';

import { SEAT_FEATURES, type SeatFeature } from '@seatline/shared';
import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Seat } from '@/lib/types';
import { cn } from '@/lib/utils';
import { FEATURE_ICONS } from './markers';

/**
 * "Find a free desk with a standing desk and two screens": pick features, the matching free
 * desks light up on the map. Only shown when desks on this floor have features at all.
 */
export function DeskFinder({
  seats,
  wanted,
  onChange,
  found,
}: {
  seats: Seat[];
  wanted: SeatFeature[];
  onChange: (wanted: SeatFeature[]) => void;
  found: ReadonlySet<string> | null;
}) {
  const t = useTranslations('map.finder');
  const tf = useTranslations('inspector.feature');
  const offered = SEAT_FEATURES.filter((f) => seats.some((s) => s.features?.includes(f)));
  if (!offered.length) return null;
  return (
    <div className="flex items-center gap-1">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={wanted.length ? 'default' : 'outline'}
            size="sm"
            className="shadow-sm"
            data-testid="desk-finder"
          >
            <Search />
            {wanted.length ? t('found', { count: found?.size ?? 0 }) : t('button')}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="grid w-72 gap-3">
          <p className="text-sm font-medium">{t('title')}</p>
          <div className="flex flex-wrap gap-1.5">
            {offered.map((f) => {
              const Icon = FEATURE_ICONS[f];
              const on = wanted.includes(f);
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange(on ? wanted.filter((w) => w !== f) : [...wanted, f])}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs',
                    on ? 'border-primary bg-primary/10' : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  <Icon className="size-3.5" aria-hidden /> {tf(f)}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {wanted.length ? t('result', { count: found?.size ?? 0 }) : t('hint')}
          </p>
        </PopoverContent>
      </Popover>
      {wanted.length > 0 && (
        <Button
          variant="outline"
          size="icon"
          className="size-8 shadow-sm"
          aria-label={t('clear')}
          onClick={() => onChange([])}
        >
          <X />
        </Button>
      )}
    </div>
  );
}
