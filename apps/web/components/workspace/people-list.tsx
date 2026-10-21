'use client';

import { GripVertical, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useDeferredValue, useState } from 'react';
import { PERSON_DRAG_TYPE } from '@/components/map/floor-map';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { usePeople } from '@/lib/queries';
import { cn } from '@/lib/utils';

export function PeopleList({
  floorId,
  selectedPersonId,
  canEdit,
  onSelect,
}: {
  floorId: string | undefined;
  selectedPersonId: string | null;
  canEdit: boolean;
  onSelect: (personId: string) => void;
}) {
  const t = useTranslations('people');
  const [search, setSearch] = useState('');
  const deferred = useDeferredValue(search.trim());
  const people = usePeople(deferred);

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-2" aria-labelledby="people-title">
      <h2 id="people-title" className="px-1 text-xs font-medium text-muted-foreground">
        {t('title')}
      </h2>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('search')}
          aria-label={t('search')}
          className="pl-8"
        />
      </div>
      {canEdit && <p className="px-1 text-xs text-muted-foreground">{t('dragHint')}</p>}
      <ul className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1" data-testid="people-list">
        {people.isPending &&
          Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="px-2 py-2">
              <Skeleton className="h-4 w-3/4" />
            </li>
          ))}
        {people.data?.length === 0 && (
          <li className="px-2 py-3 text-sm text-muted-foreground">
            {t('none', { search: deferred })}
          </li>
        )}
        {people.data?.map((person) => {
          const seat = person.assignments[0]?.seat;
          const where = !seat
            ? t('noSeat')
            : seat.floorId === floorId
              ? t('seat', { label: seat.label })
              : t('otherFloor', { label: seat.label });
          return (
            <li key={person.id}>
              <button
                type="button"
                draggable={canEdit}
                onDragStart={(e) => {
                  e.dataTransfer.setData(PERSON_DRAG_TYPE, person.id);
                  e.dataTransfer.setData('text/plain', person.displayName);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => onSelect(person.id)}
                aria-pressed={person.id === selectedPersonId}
                className={cn(
                  'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  person.id === selectedPersonId && 'bg-accent',
                  canEdit && 'cursor-grab active:cursor-grabbing',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{person.displayName}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[where, person.department].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {canEdit && (
                  <GripVertical
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
