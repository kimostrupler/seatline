'use client';

import { X } from 'lucide-react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { FEATURE_ICONS } from '@/components/map/markers';
import { StatusDot } from '@/components/map/status-dot';
import { Button } from '@/components/ui/button';
import { useSeatHistory } from '@/lib/queries';
import type { Room, Seat } from '@/lib/types';
import { AssignPicker } from './assign-picker';
import { HistoryList } from './history-list';
import { ReserveForm } from './reserve-form';
import type { useSeatActions } from './use-seat-actions';

export function SeatPanel({
  seat,
  room,
  canEdit,
  actions,
  onClose,
  onSelectPerson,
}: {
  seat: Seat;
  room: Room | undefined;
  canEdit: boolean;
  actions: ReturnType<typeof useSeatActions>;
  onClose: () => void;
  onSelectPerson: (personId: string) => void;
}) {
  const t = useTranslations('seat');
  const ts = useTranslations('status');
  const th = useTranslations('history');
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const history = useSeatHistory(seat.id);
  const current = seat.currentAssignment;
  const ti = useTranslations('inspector');
  const tz = useTranslations('map');

  return (
    <div className="grid gap-4" data-testid="seat-panel">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{t('title', { label: seat.label })}</h2>
          <p className="text-sm text-muted-foreground">
            {room ? t('room', { room: room.name }) : t('noRoom')}
            {room?.team && ` · ${tz('zone', { team: room.team })}`}
          </p>
          {!!seat.features?.length && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={ti('features')}>
              {seat.features.map((f) => {
                const Icon = FEATURE_ICONS[f];
                return (
                  <li
                    key={f}
                    className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                  >
                    <Icon className="size-3.5 text-muted-foreground" aria-hidden />
                    {ti(`feature.${f}`)}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 size-8"
          aria-label={t('close')}
          onClick={onClose}
        >
          <X />
        </Button>
      </header>

      <div className="grid gap-3 rounded-lg border p-3">
        <p className="flex items-center gap-2 text-sm font-medium" data-testid="seat-status">
          <StatusDot status={seat.occupancy} />
          {ts(seat.occupancy)}
        </p>
        {current?.person && (
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-medium"
            >
              {current.person.displayName
                .split(/\s+/)
                .map((w) => w[0])
                .slice(0, 2)
                .join('')}
            </span>
            <div className="min-w-0">
              <button
                type="button"
                className="text-base font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                onClick={() => onSelectPerson(current.person!.id)}
              >
                {current.person.displayName}
              </button>
              {current.person.department && (
                <p className="text-sm text-muted-foreground">{current.person.department}</p>
              )}
            </div>
          </div>
        )}
        {current?.kind === 'reserved' && (
          <p className="text-base font-medium">
            {t('reservedFor', { name: current.reservedFor ?? '' })}
          </p>
        )}
        {current && (
          <p className="text-xs text-muted-foreground">
            {t('sinceFor', {
              date: format.dateTime(new Date(current.startAt), { dateStyle: 'medium' }),
              duration: format.relativeTime(new Date(current.startAt), now),
            })}
          </p>
        )}
        {seat.status === 'blocked' && (
          <p className="text-sm text-muted-foreground">{t('blockedInfo')}</p>
        )}

        {canEdit && seat.status === 'active' && (
          <div className="flex flex-wrap gap-2">
            {seat.occupancy === 'free' && (
              <>
                <AssignPicker
                  seatId={seat.id}
                  label={t('assign')}
                  disabled={actions.busy}
                  onPick={(person) => actions.assign(seat.id, person)}
                />
                <ReserveForm
                  disabled={actions.busy}
                  onReserve={(name) => actions.reserve(seat.id, name)}
                />
              </>
            )}
            {seat.occupancy === 'reserved' && current && (
              <>
                <AssignPicker
                  seatId={seat.id}
                  label={t('assign')}
                  disabled={actions.busy}
                  onPick={(person) => actions.assign(seat.id, person)}
                />
                <Button
                  variant="outline"
                  disabled={actions.busy}
                  onClick={() => actions.free(current)}
                >
                  {t('cancelReservation')}
                </Button>
              </>
            )}
            {seat.occupancy === 'taken' && current && (
              <Button
                variant="outline"
                disabled={actions.busy}
                onClick={() => actions.free(current)}
              >
                {t('free')}
              </Button>
            )}
          </div>
        )}
        {!canEdit && <p className="text-xs text-muted-foreground">{t('viewOnly')}</p>}
      </div>

      <HistoryList
        entries={history.data}
        loading={history.isPending}
        show="seat"
        emptyText={th('empty')}
        folded
      />
    </div>
  );
}
