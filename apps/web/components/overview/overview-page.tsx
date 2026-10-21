'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ExportMenu } from '@/components/common/export-menu';
import { PageFrame, PageSection } from '@/components/common/page-frame';
import { StatusDot } from '@/components/map/status-dot';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useOverview } from '@/lib/queries';
import type { OccupancyCounts } from '@/lib/types';
import { cn } from '@/lib/utils';

const STATES = ['free', 'taken', 'reserved', 'blocked'] as const;
const FILL: Record<(typeof STATES)[number], string> = {
  free: 'bg-(--seat-free-stroke)',
  taken: 'bg-(--seat-taken-stroke)',
  reserved: 'bg-(--seat-reserved-stroke)',
  // texture as well as colour, so blocked never reads as "taken"
  blocked:
    'bg-[repeating-linear-gradient(135deg,var(--seat-blocked-stroke)_0_2px,transparent_2px_5px)]',
};

/** Everyone: how full each building and floor is right now. */
export function OverviewPage() {
  const t = useTranslations('overview');
  const overview = useOverview();
  const data = overview.data;

  return (
    <PageFrame title={t('title')} actions={<ExportMenu />}>
      {!data ? (
        overview.isError ? (
          <p className="text-sm text-muted-foreground">{t('error')}</p>
        ) : (
          <Skeleton className="h-40" />
        )
      ) : data.buildings.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="overview-totals">
            <Tile label={t('seats')} value={data.seats} />
            {STATES.slice(0, 3).map((s) => (
              <Tile key={s} label={t(s)} value={data[s]} status={s} />
            ))}
          </dl>
          {data.buildings.map((b) => (
            <PageSection key={b.id} title={b.name}>
              {b.address && <p className="-mt-2 text-sm text-muted-foreground">{b.address}</p>}
              <OccupancyBar counts={b} label={b.name} />
              {b.floors.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noFloors')}</p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {b.floors.map((f) => (
                    <li
                      key={f.id}
                      className="grid gap-2 px-3 py-3 sm:grid-cols-[10rem_1fr_auto] sm:items-center"
                    >
                      <span className="truncate text-sm font-medium">{f.name}</span>
                      <OccupancyBar counts={f} label={f.name} compact />
                      <Button asChild variant="ghost" size="sm" className="justify-self-start">
                        <Link href={`/map?building=${b.id}&floor=${f.id}`}>{t('openMap')}</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </PageSection>
          ))}
        </>
      )}
    </PageFrame>
  );
}

export function Tile({
  label,
  value,
  status,
}: {
  label: string;
  value: number;
  status?: (typeof STATES)[number];
}) {
  return (
    <div className="rounded-lg border px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {status && <StatusDot status={status} />}
        {label}
      </dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/** Stacked bar (free · taken · reserved · blocked) with the numbers written next to it. */
export function OccupancyBar({
  counts,
  label,
  compact,
}: {
  counts: OccupancyCounts;
  label: string;
  compact?: boolean;
}) {
  const t = useTranslations('overview');
  const parts = STATES.filter((s) => counts[s] > 0);
  const summary = t('summary', { ...counts });
  return (
    <div className="grid gap-1.5">
      <div
        role="img"
        aria-label={`${label}: ${summary}`}
        className={cn('flex gap-0.5 overflow-hidden rounded', compact ? 'h-2' : 'h-3')}
      >
        {counts.seats === 0 ? (
          <div className="flex-1 rounded bg-muted" />
        ) : (
          parts.map((s) => (
            <div
              key={s}
              title={`${t(s)}: ${counts[s]}`}
              className={cn('first:rounded-l last:rounded-r', FILL[s])}
              style={{ flexGrow: counts[s], flexBasis: 0 }}
            />
          ))
        )}
      </div>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {counts.seats === 0
          ? t('noSeats')
          : STATES.filter((s) => s !== 'blocked' || counts.blocked > 0).map((s) => (
              <span key={s} className="flex items-center gap-1 tabular-nums">
                <StatusDot status={s} /> {counts[s]} {t(s).toLowerCase()}
              </span>
            ))}
      </p>
    </div>
  );
}
