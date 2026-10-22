'use client';

import { Briefcase, Mail, MapPin, Users } from 'lucide-react';
import Link from 'next/link';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { PageFrame } from '@/components/common/page-frame';
import { FEATURE_ICONS } from '@/components/map/markers';
import { StatusDot } from '@/components/map/status-dot';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { HistoryList } from '@/components/workspace/history-list';
import { useFloorMap, usePerson, useSeat, useSeatHistory } from '@/lib/queries';
import { usePersonName } from '@/lib/use-person-name';

/**
 * One desk, made for a phone that just scanned its sticker: where it is, who sits there (name,
 * team, job, e-mail, since when), what the desk has, and who sat there before.
 */
export function DeskPage({ seatId }: { seatId: string }) {
  const t = useTranslations('desk');
  const ts = useTranslations('status');
  const tseat = useTranslations('seat');
  const ti = useTranslations('inspector');
  const th = useTranslations('history');
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const personName = usePersonName();
  const seat = useSeat(seatId);
  const map = useFloorMap(seat.data?.floorId).data;
  const current = seat.data?.currentAssignment;
  const person = usePerson(current?.person?.id).data;
  const history = useSeatHistory(seatId);

  if (seat.isError)
    return (
      <PageFrame title={t('notFound')}>
        <p className="text-sm text-muted-foreground">{t('notFoundHint')}</p>
      </PageFrame>
    );
  if (!seat.data || !map)
    return <PageFrame title={<Skeleton className="h-8 w-40" />}>{null}</PageFrame>;

  const s = seat.data;
  const room = map.rooms.find((r) => r.id === s.roomId);
  const place = [map.floor.building.name, map.floor.name, room?.name].filter(Boolean).join(' › ');
  const mapHref = `/map?building=${map.floor.building.id}&floor=${map.floor.id}&seat=${s.id}`;

  return (
    <PageFrame title={t('title', { label: s.label })}>
      <div className="-mt-5 grid gap-6" data-testid="desk-page">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="size-4 shrink-0" aria-hidden /> {place}
        </p>

        <section className="grid gap-4 rounded-xl border bg-card p-5" aria-label={t('whoSitsHere')}>
          <p className="flex items-center gap-2 text-sm font-medium" data-testid="desk-status">
            <StatusDot status={s.occupancy} />
            {ts(s.occupancy)}
          </p>
          {current?.person ? (
            <div className="grid gap-2">
              <p className="text-2xl font-semibold">{personName(current.person.displayName)}</p>
              {person?.jobTitle && (
                <p className="flex items-center gap-2 text-sm">
                  <Briefcase className="size-4 text-muted-foreground" aria-hidden />
                  {person.jobTitle}
                </p>
              )}
              {(person?.department ?? current.person.department) && (
                <p className="flex items-center gap-2 text-sm">
                  <Users className="size-4 text-muted-foreground" aria-hidden />
                  {person?.department ?? current.person.department}
                </p>
              )}
              {person?.email && (
                <a
                  href={`mailto:${person.email}`}
                  className="flex items-center gap-2 text-sm text-primary underline-offset-4 hover:underline"
                >
                  <Mail className="size-4" aria-hidden />
                  {person.email}
                </a>
              )}
            </div>
          ) : current?.kind === 'reserved' ? (
            <p className="text-2xl font-semibold">
              {tseat('reservedFor', { name: current.reservedFor ?? '' })}
            </p>
          ) : (
            <p className="text-lg">{s.status === 'blocked' ? tseat('blockedInfo') : t('free')}</p>
          )}
          {current && (
            <p className="text-xs text-muted-foreground">
              {tseat('sinceFor', {
                date: format.dateTime(new Date(current.startAt), { dateStyle: 'medium' }),
                duration: format.relativeTime(new Date(current.startAt), now),
              })}
            </p>
          )}
        </section>

        {!!s.features?.length && (
          <section className="grid gap-2">
            <h2 className="text-xs font-medium text-muted-foreground">{ti('features')}</h2>
            <ul className="flex flex-wrap gap-1.5">
              {s.features.map((f) => {
                const Icon = FEATURE_ICONS[f];
                return (
                  <li
                    key={f}
                    className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm"
                  >
                    <Icon className="size-4 text-muted-foreground" aria-hidden />
                    {ti(`feature.${f}`)}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <Button asChild size="lg" className="justify-self-start">
          <Link href={mapHref}>
            <MapPin /> {t('showOnMap')}
          </Link>
        </Button>

        <HistoryList
          entries={history.data}
          loading={history.isPending}
          show="seat"
          emptyText={th('empty')}
        />
      </div>
    </PageFrame>
  );
}
