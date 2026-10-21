'use client';

import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useState } from 'react';
import { PageFrame } from '@/components/common/page-frame';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { describe, linkHref } from '@/lib/activity';
import { initials } from '@/lib/map-geometry';
import { useActivity, useMe, usePeople, type ActivityFilters } from '@/lib/queries';
import type { ActivityEntry, ActivityKind, ActivityRefs } from '@/lib/types';

const KINDS: ActivityKind[] = ['seating', 'moves', 'layout', 'places', 'people'];
const ALL = 'all';

/** Editors and admins: every change in the workspace, newest first, with filters. */
export function ActivityPage() {
  const t = useTranslations('activity');
  const me = useMe();
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // filters live in the URL, so a filtered view can be shared or opened from a person
  const filters: ActivityFilters = {
    kind: (KINDS as string[]).includes(search.get('kind') ?? '')
      ? (search.get('kind') as ActivityKind)
      : undefined,
    personId: search.get('personId') ?? undefined,
    from: search.get('from') ?? undefined,
    to: search.get('to') ?? undefined,
  };
  const setFilter = (key: keyof ActivityFilters, value: string | undefined) => {
    const next = new URLSearchParams(search);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  };
  const filtered = Object.values(filters).some(Boolean);
  const canSee = me.data && me.data.role !== 'viewer';
  const activity = useActivity(canSee ? filters : { kind: undefined });

  if (me.data && !canSee)
    return (
      <PageFrame title={t('title')}>
        <p className="text-sm text-muted-foreground">{t('onlyEditors')}</p>
      </PageFrame>
    );

  const pages = activity.data?.pages ?? [];
  const refs: ActivityRefs = mergeRefs(pages.map((p) => p.refs));
  const items = pages.flatMap((p) => p.items);

  return (
    <PageFrame title={t('title')}>
      <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label={t('filters')}>
        <div className="grid gap-1.5">
          <Label htmlFor="activity-kind">{t('kind')}</Label>
          <Select
            value={filters.kind ?? ALL}
            onValueChange={(v) => setFilter('kind', v === ALL ? undefined : v)}
          >
            <SelectTrigger id="activity-kind" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('kinds.all')}</SelectItem>
              {KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {t(`kinds.${k}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="activity-person">{t('person')}</Label>
          <PersonFilter
            personId={filters.personId}
            name={filters.personId ? refs.people[filters.personId]?.displayName : undefined}
            onChange={(id) => setFilter('personId', id)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="activity-from">{t('from')}</Label>
          <Input
            id="activity-from"
            type="date"
            value={filters.from ?? ''}
            max={filters.to}
            onChange={(e) => setFilter('from', e.target.value || undefined)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="activity-to">{t('to')}</Label>
          <Input
            id="activity-to"
            type="date"
            value={filters.to ?? ''}
            min={filters.from}
            onChange={(e) => setFilter('to', e.target.value || undefined)}
          />
        </div>
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            className="justify-self-start text-muted-foreground"
            onClick={() => router.replace(pathname)}
          >
            <X /> {t('clear')}
          </Button>
        )}
      </div>

      {activity.isPending ? (
        <Skeleton className="h-60" />
      ) : activity.isError ? (
        <p className="text-sm text-muted-foreground">{t('error')}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{filtered ? t('noneFiltered') : t('none')}</p>
      ) : (
        <div className="grid gap-6" data-testid="activity-list">
          {groupByDay(items).map(([day, entries]) => (
            <section key={day} className="grid gap-1">
              <DayHeading day={day} />
              <ul className="divide-y">
                {entries.map((e) => (
                  <EntryRow key={e.id} entry={e} refs={refs} />
                ))}
              </ul>
            </section>
          ))}
          {activity.hasNextPage && (
            <Button
              variant="outline"
              className="justify-self-center"
              disabled={activity.isFetchingNextPage}
              onClick={() => activity.fetchNextPage()}
            >
              {activity.isFetchingNextPage && <Loader2 className="animate-spin" />}
              {t('more')}
            </Button>
          )}
        </div>
      )}
    </PageFrame>
  );
}

export function mergeRefs(list: ActivityRefs[]): ActivityRefs {
  const out: ActivityRefs = { people: {}, seats: {}, rooms: {}, floors: {}, buildings: {} };
  for (const r of list)
    for (const k of Object.keys(out) as (keyof ActivityRefs)[]) Object.assign(out[k], r[k]);
  return out;
}

/** Local calendar day (YYYY-MM-DD) → entries of that day, newest day first. */
function groupByDay(items: ActivityEntry[]): Array<[string, ActivityEntry[]]> {
  const groups = new Map<string, ActivityEntry[]>();
  for (const e of items) {
    const d = new Date(e.createdAt);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    groups.set(day, [...(groups.get(day) ?? []), e]);
  }
  return [...groups];
}

function DayHeading({ day }: { day: string }) {
  const t = useTranslations('activity');
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today.getTime() - date.getTime()) / 86_400_000);
  return (
    <h2 className="sticky top-0 z-10 bg-background py-1 text-xs font-medium text-muted-foreground">
      {diff === 0
        ? t('today')
        : diff === 1
          ? t('yesterday')
          : format.dateTime(date, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
    </h2>
  );
}

export function EntryRow({ entry, refs }: { entry: ActivityEntry; refs: ActivityRefs }) {
  const t = useTranslations();
  const format = useFormatter();
  const d = describe(entry, refs, t('activity.unknown'));
  const values = { ...d.values };
  if (typeof values.role === 'string' && values.role)
    values.role = t(`devLogin.role.${values.role}` as 'devLogin.role.admin');
  if (typeof values.type === 'string' && values.type)
    values.type = t(`inspector.seatType.${values.type}` as 'inspector.seatType.desk');
  const actor = entry.actorId
    ? (refs.people[entry.actorId]?.displayName ?? t('activity.unknown'))
    : t('activity.system');

  return (
    <li className="flex gap-3 py-2.5">
      <span
        aria-hidden
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground"
      >
        {entry.actorId ? initials(actor) : 'S'}
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p>
          <span className="font-medium">{actor}</span>{' '}
          {t(`activity.entries.${d.key}` as 'activity.entries.other', values)}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <time dateTime={entry.createdAt}>
            {format.dateTime(new Date(entry.createdAt), { hour: '2-digit', minute: '2-digit' })}
          </time>
          {d.link && (
            <>
              <span aria-hidden>·</span>
              <Link href={linkHref(d.link)} className="underline-offset-2 hover:underline">
                {'person' in d.link
                  ? t('activity.showPerson')
                  : 'plan' in d.link
                    ? t('activity.showPlan')
                    : t('activity.showOnMap')}
              </Link>
            </>
          )}
        </p>
      </div>
    </li>
  );
}

function PersonFilter({
  personId,
  name,
  onChange,
}: {
  personId: string | undefined;
  name: string | undefined;
  onChange: (id: string | undefined) => void;
}) {
  const t = useTranslations('activity');
  const [open, setOpen] = useState(false);
  const people = usePeople('');
  const label = personId
    ? (name ?? people.data?.find((p) => p.id === personId)?.displayName ?? '…')
    : t('anyone');
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id="activity-person"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandInput placeholder={t('searchPerson')} />
          <CommandList>
            <CommandEmpty>{t('nobody')}</CommandEmpty>
            <CommandItem
              value={`__anyone ${t('anyone')}`}
              onSelect={() => {
                setOpen(false);
                onChange(undefined);
              }}
            >
              <span className="flex-1">{t('anyone')}</span>
              {!personId && <Check />}
            </CommandItem>
            {people.data?.map((p) => (
              <CommandItem
                key={p.id}
                value={`${p.displayName} ${p.email}`}
                onSelect={() => {
                  setOpen(false);
                  onChange(p.id);
                }}
              >
                <span className="flex-1 truncate">{p.displayName}</span>
                {p.id === personId && <Check />}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
