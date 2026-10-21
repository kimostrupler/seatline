'use client';

import { SEAT_OCCUPANCY } from '@seatline/shared';
import { useTranslations } from 'next-intl';
import type { Seat } from '@/lib/types';
import { cn } from '@/lib/utils';
import { StatusDot } from './status-dot';

export function MapLegend({ seats, className }: { seats: Seat[]; className?: string }) {
  const t = useTranslations('status');
  const count = (s: (typeof SEAT_OCCUPANCY)[number]) =>
    seats.filter((x) => x.occupancy === s).length;
  return (
    <ul
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-background/95 px-3 py-1.5 text-xs text-muted-foreground shadow-sm',
        className,
      )}
    >
      {SEAT_OCCUPANCY.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <StatusDot status={s} />
          <span>
            {t(s)} <span className="tabular-nums text-foreground">{count(s)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
