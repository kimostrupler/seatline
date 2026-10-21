'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useAssign, useEndAssignment, useReserve } from '@/lib/queries';
import type { Assignment, AssignResult, Seat } from '@/lib/types';

/**
 * Seat changes with feedback: every change shows a toast with Undo.
 * Undo never rewrites history — it makes the opposite change, which the history shows too.
 */
export function useSeatActions(seats: Seat[]) {
  const t = useTranslations('toast');
  const assignM = useAssign();
  const reserveM = useReserve();
  const endM = useEndAssignment();
  const label = (seatId: string) => seats.find((s) => s.id === seatId)?.label;

  const busy = assignM.isPending || reserveM.isPending || endM.isPending;

  const fail = (error: unknown) =>
    toast.error(t('error', { message: error instanceof Error ? error.message : String(error) }));

  const withUndo = (message: string, undo: () => Promise<unknown>) =>
    toast.success(message, {
      duration: 8000, // time to notice a mistake and undo it
      action: {
        label: t('undo'),
        onClick: () =>
          undo().then(
            () => toast(t('undone')),
            (error: unknown) => fail(error),
          ),
      },
    });

  const undoAssign = async ({ assignment, closed }: AssignResult) => {
    const previous = closed.find(
      (c) => c.kind === 'assigned' && c.personId === assignment.personId,
    );
    const reservation = closed.find((c) => c.kind === 'reserved');
    if (previous)
      await assignM.mutateAsync({ seatId: previous.seatId, personId: assignment.personId! });
    else await endM.mutateAsync({ id: assignment.id });
    if (reservation?.reservedFor)
      await reserveM.mutateAsync({
        seatId: reservation.seatId,
        reservedFor: reservation.reservedFor,
      });
  };

  const assign = async (seatId: string, person: { id: string; displayName: string }) => {
    try {
      const result = await assignM.mutateAsync({ seatId, personId: person.id });
      const previous = result.closed.find((c) => c.kind === 'assigned');
      const from = previous && label(previous.seatId);
      const to = label(seatId) ?? '';
      withUndo(
        from
          ? t('moved', { person: person.displayName, from, to })
          : t('assigned', { person: person.displayName, label: to }),
        () => undoAssign(result),
      );
    } catch (error) {
      fail(error);
    }
  };

  const reserve = async (seatId: string, reservedFor: string) => {
    try {
      const created = await reserveM.mutateAsync({ seatId, reservedFor });
      withUndo(t('reserved', { label: label(seatId) ?? '', name: reservedFor }), () =>
        endM.mutateAsync({ id: created.id }),
      );
      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  };

  const free = async (current: Assignment) => {
    try {
      await endM.mutateAsync({ id: current.id });
      withUndo(t('freed', { label: label(current.seatId) ?? '' }), async () => {
        if (current.kind === 'assigned' && current.personId)
          await assignM.mutateAsync({ seatId: current.seatId, personId: current.personId });
        else if (current.reservedFor)
          await reserveM.mutateAsync({ seatId: current.seatId, reservedFor: current.reservedFor });
      });
    } catch (error) {
      fail(error);
    }
  };

  return { assign, reserve, free, busy };
}
