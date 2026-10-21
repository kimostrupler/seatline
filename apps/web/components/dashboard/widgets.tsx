'use client';

import type { WidgetType } from '@seatline/shared';
import { ArrowRight, Map as MapIcon, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { EntryRow, mergeRefs } from '@/components/activity/activity-page';
import { StatusDot } from '@/components/map/status-dot';
import { OccupancyBar, Tile } from '@/components/overview/overview-page';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useActivity,
  useFloorMap,
  useMe,
  useOverview,
  usePeople,
  usePerson,
  useStats,
  useTenant,
} from '@/lib/queries';
import type { Stats } from '@/lib/types';

const mapHref = (params: Record<string, string>) => `/map?${new URLSearchParams(params)}`;

/** The content of one widget (its card, title and edit controls come from the dashboard). */
export function WidgetBody({ type }: { type: WidgetType }) {
  switch (type) {
    case 'summary':
      return <Summary />;
    case 'occupancy':
      return <Occupancy />;
    case 'activity':
      return <RecentActivity />;
    case 'trend':
      return <Trend />;
    case 'unseated':
      return <Unseated />;
    case 'reservations':
      return <Reservations />;
    case 'departments':
      return <Departments />;
    case 'freeSeats':
      return <FreeSeats />;
    case 'blocked':
      return <Blocked />;
    case 'sync':
      return <Sync />;
    case 'mySeat':
      return <MySeat />;
    case 'quickActions':
      return <QuickActions />;
  }
}

/** "See all" style link in a widget's header. */
export const WIDGET_LINKS: Partial<Record<WidgetType, string>> = {
  summary: '/overview',
  occupancy: '/overview',
  activity: '/activity',
  sync: '/people',
};

function Loading() {
  return <Skeleton className="h-24" />;
}
function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
function More({ count }: { count: number }) {
  const t = useTranslations('dashboard');
  return count > 0 ? (
    <p className="text-xs text-muted-foreground">{t('andMore', { count })}</p>
  ) : null;
}

function useStatsOr() {
  const stats = useStats();
  return stats.data;
}

// ---- seats ---------------------------------------------------------------------

function Summary() {
  const t = useTranslations();
  const o = useOverview().data;
  if (!o) return <Loading />;
  const used = o.seats ? Math.round(((o.taken + o.reserved) / o.seats) * 100) : 0;
  return (
    <div className="grid gap-3">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label={t('overview.seats')} value={o.seats} />
        <Tile label={t('overview.free')} value={o.free} status="free" />
        <Tile label={t('overview.taken')} value={o.taken} status="taken" />
        <Tile label={t('overview.reserved')} value={o.reserved} status="reserved" />
      </dl>
      <p className="text-sm text-muted-foreground">
        {t('dashboard.usedShare', { percent: used, blocked: o.blocked })}
      </p>
    </div>
  );
}

function Occupancy() {
  const t = useTranslations('dashboard');
  const o = useOverview().data;
  if (!o) return <Loading />;
  if (!o.buildings.length) return <Empty>{t('noBuildings')}</Empty>;
  return (
    <ul className="grid gap-3">
      {o.buildings.flatMap((b) =>
        b.floors.map((f) => (
          <li key={f.id} className="grid gap-1">
            <Link
              href={mapHref({ building: b.id, floor: f.id })}
              className="text-sm font-medium underline-offset-2 hover:underline"
            >
              {o.buildings.length > 1 ? `${b.name} › ${f.name}` : f.name}
            </Link>
            <OccupancyBar counts={f} label={f.name} compact />
          </li>
        )),
      )}
    </ul>
  );
}

function FreeSeats() {
  const t = useTranslations('dashboard');
  const s = useStatsOr();
  if (!s) return <Loading />;
  if (!s.freeSeats.length) return <Empty>{t('noFreeSeats')}</Empty>;
  return (
    <ul className="grid gap-2.5">
      {s.freeSeats.map((f) => (
        <li key={f.floorId} className="text-sm">
          <Link
            href={mapHref({ building: f.buildingId, floor: f.floorId })}
            className="flex items-center gap-1.5 font-medium underline-offset-2 hover:underline"
          >
            <StatusDot status="free" /> {t('freeOn', { count: f.free, floor: f.floorName })}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {f.labels.join(', ')}
            {f.free > f.labels.length && ' …'}
          </p>
        </li>
      ))}
    </ul>
  );
}

function Blocked() {
  const t = useTranslations('dashboard');
  const format = useFormatter();
  const s = useStatsOr();
  if (!s) return <Loading />;
  if (!s.blocked.total) return <Empty>{t('noBlocked')}</Empty>;
  return (
    <div className="grid gap-2">
      <ul className="grid gap-2">
        {s.blocked.items.map((b) => (
          <li key={b.seatId} className="flex items-baseline justify-between gap-2 text-sm">
            <Link
              href={mapHref({ building: b.buildingId, floor: b.floorId, seat: b.seatId })}
              className="truncate underline-offset-2 hover:underline"
            >
              {t('seatOn', { seat: b.label, floor: b.floorName })}
            </Link>
            <span className="shrink-0 text-xs text-muted-foreground">
              {format.dateTime(new Date(b.since), { day: 'numeric', month: 'short' })}
            </span>
          </li>
        ))}
      </ul>
      <More count={s.blocked.total - s.blocked.items.length} />
    </div>
  );
}

function Reservations() {
  const t = useTranslations('dashboard');
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const s = useStatsOr();
  if (!s) return <Loading />;
  if (!s.reservations.total) return <Empty>{t('noReservations')}</Empty>;
  return (
    <div className="grid gap-2">
      <ul className="grid gap-2">
        {s.reservations.items.map((r) => (
          <li key={r.id} className="grid text-sm">
            <Link
              href={mapHref({ building: r.buildingId, floor: r.floorId, seat: r.seatId })}
              className="flex items-center gap-1.5 truncate font-medium underline-offset-2 hover:underline"
            >
              <StatusDot status="reserved" /> {r.reservedFor}
            </Link>
            <span className="text-xs text-muted-foreground">
              {t('seatOn', { seat: r.seatLabel, floor: r.floorName })} ·{' '}
              {t('waiting', { since: format.relativeTime(new Date(r.startAt), now) })}
            </span>
          </li>
        ))}
      </ul>
      <More count={s.reservations.total - s.reservations.items.length} />
    </div>
  );
}

// ---- people --------------------------------------------------------------------

function Unseated() {
  const t = useTranslations('dashboard');
  const s = useStatsOr();
  if (!s) return <Loading />;
  if (!s.unseated.total) return <Empty>{t('everyoneSeated')}</Empty>;
  return (
    <div className="grid gap-2">
      <p className="text-2xl font-semibold tabular-nums">{s.unseated.total}</p>
      <ul className="grid gap-1.5">
        {s.unseated.people.slice(0, 8).map((p) => (
          <li key={p.id} className="flex items-baseline justify-between gap-2 text-sm">
            <Link
              href={mapHref({ person: p.id })}
              className="truncate underline-offset-2 hover:underline"
            >
              {p.displayName}
            </Link>
            {p.department && (
              <span className="truncate text-xs text-muted-foreground">{p.department}</span>
            )}
          </li>
        ))}
      </ul>
      <More count={s.unseated.total - Math.min(8, s.unseated.people.length)} />
    </div>
  );
}

function Departments() {
  const t = useTranslations('dashboard');
  const s = useStatsOr();
  if (!s) return <Loading />;
  if (!s.departments.length) return <Empty>{t('noPeople')}</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr>
            <th className="py-1.5 pr-3 font-medium">{t('department')}</th>
            <th className="py-1.5 pr-3 text-right font-medium">{t('people')}</th>
            <th className="py-1.5 pr-3 text-right font-medium">{t('seated')}</th>
            <th className="py-1.5 font-medium">{t('where')}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {s.departments.map((d) => (
            <tr key={d.name ?? ''}>
              <td className="py-2 pr-3 font-medium">{d.name ?? t('noDepartment')}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{d.people}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {d.seated}{' '}
                <span className="text-xs text-muted-foreground">
                  ({Math.round((d.seated / d.people) * 100)}%)
                </span>
              </td>
              <td className="py-2">
                <span className="flex flex-wrap gap-1">
                  {d.floors.length === 0 && <span className="text-muted-foreground">–</span>}
                  {d.floors.map((f) => (
                    <Link
                      key={f.floorId}
                      href={mapHref({ building: f.buildingId, floor: f.floorId })}
                      className="rounded-md border px-1.5 py-0.5 text-xs hover:bg-muted"
                    >
                      {f.floorName} · {f.count}
                    </Link>
                  ))}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MySeat() {
  const t = useTranslations('dashboard');
  const me = useMe().data;
  const person = usePerson(me?.person.id).data;
  const seat = person?.assignments[0]?.seat;
  const map = useFloorMap(seat?.floorId).data;
  if (!me || !person) return <Loading />;
  if (!seat) return <Empty>{t('noSeatMine')}</Empty>;
  const mine = map?.seats.find((s) => s.id === seat.id);
  const neighbours = (map?.seats ?? [])
    .filter((s) => s.id !== seat.id && mine?.roomId && s.roomId === mine.roomId)
    .map((s) => s.currentAssignment?.person?.displayName)
    .filter((n): n is string => !!n);
  const room = map?.rooms.find((r) => r.id === mine?.roomId);
  return (
    <div className="grid gap-3">
      <div>
        <p className="text-2xl font-semibold">{seat.label}</p>
        <p className="text-sm text-muted-foreground">
          {[seat.floor.name, room?.name].filter(Boolean).join(' · ')}
        </p>
      </div>
      {neighbours.length > 0 && (
        <p className="text-sm">
          <span className="text-muted-foreground">{t('nearYou')}</span> {neighbours.join(', ')}
        </p>
      )}
      <Button asChild variant="outline" size="sm" className="justify-self-start">
        <Link
          href={mapHref({ building: seat.floor.buildingId, floor: seat.floorId, seat: seat.id })}
        >
          <MapIcon /> {t('showMySeat')}
        </Link>
      </Button>
    </div>
  );
}

function Sync() {
  const t = useTranslations();
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const tenant = useTenant().data;
  if (!tenant) return <Loading />;
  const status = tenant.peopleSyncStatus;
  if (!tenant.entraTenantId) return <Empty>{t('admin.notConnected')}</Empty>;
  if (!status) return <Empty>{t('admin.neverSynced')}</Empty>;
  return (
    <div className="grid gap-1 text-sm">
      <p className="font-medium">
        {status.ok
          ? t('admin.lastSync', { when: format.relativeTime(new Date(status.at), now) })
          : t('admin.syncFailed', { message: status.message ?? status.error ?? '' })}
      </p>
      {status.ok && (
        <p className="text-muted-foreground">
          {t('admin.syncCounts', {
            created: status.created ?? 0,
            updated: status.updated ?? 0,
            deactivated: status.deactivated ?? 0,
            seatsFreed: status.seatsFreed ?? 0,
          })}
        </p>
      )}
    </div>
  );
}

// ---- activity ------------------------------------------------------------------

function RecentActivity() {
  const t = useTranslations('dashboard');
  const activity = useActivity({ limit: 6 });
  const page = activity.data?.pages[0];
  if (!page) return <Loading />;
  if (!page.items.length) return <Empty>{t('noActivity')}</Empty>;
  const refs = mergeRefs([page.refs]);
  return (
    <ul className="-my-2.5 divide-y">
      {page.items.map((e) => (
        <EntryRow key={e.id} entry={e} refs={refs} />
      ))}
    </ul>
  );
}

/** Seat changes per week: one series, so no legend; hover/focus a bar for the details. */
function Trend() {
  const t = useTranslations('dashboard');
  const format = useFormatter();
  const s = useStatsOr();
  const [active, setActive] = useState<number | null>(null);
  if (!s) return <Loading />;
  const weeks = s.weeks.map((w) => ({ ...w, total: w.assigned + w.moved + w.reserved + w.freed }));
  const max = Math.max(1, ...weeks.map((w) => w.total));
  const total = weeks.reduce((n, w) => n + w.total, 0);
  const label = (w: { start: string }) =>
    format.dateTime(new Date(`${w.start}T12:00:00Z`), { day: 'numeric', month: 'short' });
  const shown = active === null ? null : weeks[active]!;
  return (
    <div className="grid gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t('trendTotal', { count: total })}</p>
        <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
          {shown
            ? t('trendWeek', {
                week: label(shown),
                assigned: shown.assigned,
                moved: shown.moved,
                reserved: shown.reserved,
                freed: shown.freed,
              })
            : t('trendHint')}
        </p>
      </div>
      <div className="flex h-28 items-end gap-1 border-b" onPointerLeave={() => setActive(null)}>
        {weeks.map((w, i) => (
          <button
            key={w.start}
            type="button"
            className="group flex h-full flex-1 items-end focus-visible:outline-none"
            aria-label={`${label(w)}: ${w.total}`}
            onPointerEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
          >
            <span
              className="w-full rounded-t bg-(--chart-1) opacity-85 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-focus-visible:ring-2 group-focus-visible:ring-ring"
              style={{
                height: w.total ? `${(w.total / max) * 100}%` : 0,
                minHeight: w.total ? 3 : 0,
              }}
            />
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label(weeks[0]!)}</span>
        <span>{t('thisWeek')}</span>
      </div>
      <TrendTable weeks={weeks} label={label} />
    </div>
  );
}

function TrendTable({
  weeks,
  label,
}: {
  weeks: Array<Stats['weeks'][number] & { total: number }>;
  label: (w: { start: string }) => string;
}) {
  const t = useTranslations('dashboard');
  return (
    <table className="sr-only">
      <caption>{t('trend')}</caption>
      <thead>
        <tr>
          <th>{t('week')}</th>
          <th>{t('assigned')}</th>
          <th>{t('moved')}</th>
          <th>{t('reserved')}</th>
          <th>{t('freed')}</th>
        </tr>
      </thead>
      <tbody>
        {weeks.map((w) => (
          <tr key={w.start}>
            <td>{label(w)}</td>
            <td>{w.assigned}</td>
            <td>{w.moved}</td>
            <td>{w.reserved}</td>
            <td>{w.freed}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---- shortcuts -----------------------------------------------------------------

function QuickActions() {
  const t = useTranslations('dashboard');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const people = usePeople('');
  return (
    <div className="grid gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="justify-start text-muted-foreground">
            <Search /> {t('findPerson')}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <Command>
            <CommandInput placeholder={t('findPerson')} />
            <CommandList>
              <CommandEmpty>{t('nobody')}</CommandEmpty>
              {people.data?.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.displayName} ${p.department ?? ''} ${p.email}`}
                  onSelect={() => router.push(mapHref({ person: p.id }))}
                >
                  <span className="flex-1 truncate">{p.displayName}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.assignments[0]?.seat.label ?? ''}
                  </span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Button asChild variant="ghost" className="justify-between">
        <Link href="/map">
          {t('openFloorMap')} <ArrowRight />
        </Link>
      </Button>
      <Button asChild variant="ghost" className="justify-between">
        <Link href="/overview">
          {t('seeAllFloors')} <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}
