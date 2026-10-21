'use client';

import { ArrowRight, TriangleAlert, X } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AssignPicker } from '@/components/workspace/assign-picker';
import { Button } from '@/components/ui/button';
import { useMovePlanActions } from '@/lib/queries';
import type { MoveItem, MovePlanDetail, Room, Seat } from '@/lib/types';
import { PlanStatus } from './plan-status';

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Adding to a plan instead of changing seats: the same gestures, recorded as planned moves. */
export function usePlanEdits(plan: MovePlanDetail | undefined) {
  const t = useTranslations('moves.planMode');
  const actions = useMovePlanActions(plan?.id ?? '');
  const editable = plan?.status === 'draft';
  const guard = () => {
    if (!editable) toast(t('readOnly'));
    return editable;
  };
  return {
    editable,
    busy: actions.setItems.isPending || actions.removeItem.isPending,
    /** person → seat (null = gives up their seat) */
    move: (
      person: { id: string; displayName: string },
      seat: { id: string; label: string } | null,
    ) => {
      if (!guard()) return;
      actions.setItems.mutateAsync([{ personId: person.id, toSeatId: seat?.id ?? null }]).then(
        () =>
          toast.success(
            seat
              ? t('added', { person: person.displayName, seat: seat.label })
              : t('freed', { person: person.displayName }),
          ),
        (error: unknown) => toast.error(errorText(error)),
      );
    },
    remove: (personId: string) => {
      if (!guard()) return;
      actions.removeItem
        .mutateAsync(personId)
        .catch((error: unknown) => toast.error(errorText(error)));
    },
  };
}

/** Top of the map while planning: which plan, how many moves/problems, and the way out. */
export function PlanBar({ plan, onExit }: { plan: MovePlanDetail; onExit: () => void }) {
  const t = useTranslations('moves.planMode');
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-primary/5 px-3 py-2 text-sm"
      data-testid="plan-bar"
    >
      <span className="font-medium">{t('banner', { name: plan.name })}</span>
      <PlanStatus status={plan.status} effectiveDate={plan.effectiveDate} />
      <span className="text-muted-foreground">{t('count', { count: plan.items.length })}</span>
      {plan.problems.length > 0 && (
        <span className="flex items-center gap-1 text-destructive">
          <TriangleAlert className="size-3.5" /> {t('problems', { count: plan.problems.length })}
        </span>
      )}
      <span className="hidden flex-1 truncate text-xs text-muted-foreground xl:block">
        {plan.status === 'draft' ? t('hint') : t('readOnly')}
      </span>
      <span className="ml-auto flex gap-1">
        <Button asChild size="sm" variant="outline">
          <Link href={`/moves/${plan.id}`}>{t('backToPlan')}</Link>
        </Button>
        <Button size="sm" variant="ghost" onClick={onExit} aria-label={t('exit')} title={t('exit')}>
          <X />
        </Button>
      </span>
    </div>
  );
}

/** A selected seat while planning: who sits there now, who will, and plan actions. */
export function PlanSeatPanel({
  seat,
  planned,
  room,
  plan,
  edits,
  onClose,
}: {
  /** the seat as it is today */
  seat: Seat;
  /** the seat as it will be after the plan */
  planned: Seat;
  room: Room | undefined;
  plan: MovePlanDetail;
  edits: ReturnType<typeof usePlanEdits>;
  onClose: () => void;
}) {
  const t = useTranslations('moves.planMode');
  const ts = useTranslations('seat');
  const tst = useTranslations('status');
  const now = seat.currentAssignment;
  const arriving = plan.items.find((i) => i.toSeat?.id === seat.id);
  const leaving = plan.items.find((i) => i.fromSeat?.id === seat.id && i.toSeat?.id !== seat.id);
  const willSit = planned.currentAssignment?.person;
  const where = (i: MoveItem) =>
    i.toSeat
      ? t('toOtherFloor', { seat: i.toSeat.label, floor: i.toSeat.floor.name })
      : t('toNoSeat');

  return (
    <div className="grid gap-4" data-testid="plan-seat-panel">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{ts('title', { label: seat.label })}</h2>
          <p className="text-sm text-muted-foreground">
            {room ? ts('room', { room: room.name }) : ts('noRoom')}
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

      <div className="grid gap-1 rounded-lg border p-3 text-sm">
        <p className="text-xs font-medium text-muted-foreground">{tst(seat.occupancy)}</p>
        <p>
          {now?.person?.displayName ??
            (now?.kind === 'reserved' ? ts('reservedFor', { name: now.reservedFor ?? '' }) : '–')}
        </p>
      </div>

      <div className="grid gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
        <p className="text-xs font-medium text-primary">{t('planned')}</p>
        {arriving ? (
          <p className="flex flex-wrap items-center gap-1">
            {arriving.fromSeat
              ? t('movesHere', {
                  person: arriving.person.displayName,
                  from: arriving.fromSeat.label,
                })
              : t('getsSeat', { person: arriving.person.displayName })}
          </p>
        ) : null}
        {leaving && (
          <p className="flex items-center gap-1 text-muted-foreground">
            <ArrowRight className="size-3.5" />
            {t('leaves', { person: leaving.person.displayName, to: where(leaving) })}
          </p>
        )}
        {!arriving && !leaving && <p className="text-muted-foreground">{tst(planned.occupancy)}</p>}

        {edits.editable && seat.status === 'active' && (
          <div className="flex flex-wrap gap-2 pt-1">
            {!willSit && (
              <AssignPicker
                seatId={seat.id}
                label={t('assign')}
                disabled={edits.busy}
                onPick={(person) => edits.move(person, seat)}
              />
            )}
            {willSit && (
              <Button
                variant="outline"
                disabled={edits.busy}
                onClick={() => edits.move(willSit, null)}
              >
                {t('free')}
              </Button>
            )}
            {arriving && (
              <Button
                variant="ghost"
                disabled={edits.busy}
                onClick={() => edits.remove(arriving.personId)}
              >
                {t('remove')}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
