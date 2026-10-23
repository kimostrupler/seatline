'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe, usePerson, usePersonHistory } from '@/lib/queries';
import { HistoryList } from './history-list';

export function PersonPanel({
  personId,
  onClose,
  onShowSeat,
}: {
  personId: string;
  onClose: () => void;
  onShowSeat: (seat: { id: string; floorId: string; buildingId: string }) => void;
}) {
  const t = useTranslations('person');
  const th = useTranslations('history');
  const ts = useTranslations('seat');
  const { data: person } = usePerson(personId);
  const history = usePersonHistory(personId);
  const me = useMe();
  const canEdit = me.data?.role === 'admin' || me.data?.role === 'editor';
  const seat = person?.assignments[0]?.seat;

  if (!person) return <Skeleton className="h-24 w-full" />;
  return (
    <div className="grid gap-4" data-testid="person-panel">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{person.displayName}</h2>
          <p className="text-sm text-muted-foreground">
            {[person.jobTitle, person.department].filter(Boolean).join(' · ')}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 size-8"
          aria-label={ts('close')}
          onClick={onClose}
        >
          <X />
        </Button>
      </header>
      <div className="grid gap-2 rounded-lg border p-3">
        <p className="text-xs font-medium text-muted-foreground">{t('currentSeat')}</p>
        {seat ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-base font-medium">
              {ts('title', { label: seat.label })}{' '}
              <span className="text-sm font-normal text-muted-foreground">· {seat.floor.name}</span>
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onShowSeat({
                  id: seat.id,
                  floorId: seat.floorId,
                  buildingId: seat.floor.buildingId,
                })
              }
            >
              {t('showSeat')}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('noSeat')}</p>
        )}
      </div>
      <HistoryList
        entries={history.data}
        loading={history.isPending}
        show="person"
        emptyText={th('emptyPerson')}
        folded
      />
      {canEdit && (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="justify-self-start text-muted-foreground"
        >
          <Link href={`/activity?personId=${person.id}`}>{t('allChanges')}</Link>
        </Button>
      )}
    </div>
  );
}
