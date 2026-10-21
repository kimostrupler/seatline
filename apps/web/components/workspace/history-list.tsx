'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { usePersonName } from '@/lib/use-person-name';
import { Skeleton } from '@/components/ui/skeleton';
import type { HistoryEntry } from '@/lib/types';

/** Timeline of assignments, newest first. `show` decides what each row is about. */
export function HistoryList({
  entries,
  loading,
  show,
  emptyText,
}: {
  entries: HistoryEntry[] | undefined;
  loading: boolean;
  show: 'person' | 'seat';
  emptyText: string;
}) {
  const t = useTranslations('history');
  const format = useFormatter();
  const personName = usePersonName();
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium' });

  return (
    <section aria-labelledby="history-title" className="grid gap-2">
      <h3 id="history-title" className="text-xs font-medium text-muted-foreground">
        {t('title')}
      </h3>
      {loading && <Skeleton className="h-12 w-full" />}
      {entries?.length === 0 && <p className="text-sm text-muted-foreground">{emptyText}</p>}
      <ol className="grid gap-0" data-testid="history">
        {entries?.map((e) => {
          const title =
            show === 'seat'
              ? e.person
                ? personName(e.person.displayName)
                : t('reserved', { name: e.reservedFor ?? '' })
              : t('seat', { label: e.seat.label });
          const open = e.endAt === null;
          return (
            <li key={e.id} className="relative border-l pb-3 pl-4 last:pb-0">
              <span
                aria-hidden
                className={`absolute top-1.5 -left-[5px] size-2.5 rounded-full border-2 border-background ${open ? 'bg-primary' : 'bg-muted-foreground/40'}`}
              />
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-muted-foreground">
                {t('range', { from: date(e.startAt), to: open ? t('now') : date(e.endAt!) })} ·{' '}
                {t('by', { name: personName(e.assignedBy.displayName) })}
              </p>
              {e.note && <p className="mt-0.5 text-xs text-muted-foreground italic">{e.note}</p>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
