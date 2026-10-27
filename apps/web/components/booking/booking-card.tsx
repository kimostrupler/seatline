'use client';

import { CalendarCheck, CalendarX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { StatusDot } from '@/components/map/status-dot';
import { Button } from '@/components/ui/button';
import { AssignPicker } from '@/components/workspace/assign-picker';
import { ApiError } from '@/lib/api';
import type { Booking } from '@/lib/bookings';
import { useBookDesk, useCancelBooking } from '@/lib/queries';
import type { Seat } from '@/lib/types';
import { useDayName } from './day-picker';

/**
 * A shared desk on the chosen day: who booked it, or "Book". Everyone books for themselves;
 * editors and admins can also book for someone else and cancel anyone's booking.
 */
export function BookingCard({
  seat,
  day,
  today,
  booking,
  meId,
  canManage,
  onSelectPerson,
}: {
  seat: Seat;
  day: string;
  today: string;
  booking: Booking | undefined;
  meId: string | undefined;
  canManage: boolean;
  onSelectPerson: (personId: string) => void;
}) {
  const t = useTranslations('booking');
  const tt = useTranslations('toast');
  const dayName = useDayName(today);
  const bookM = useBookDesk();
  const cancelM = useCancelBooking();
  const busy = bookM.isPending || cancelM.isPending;
  const mine = booking?.personId === meId;

  const fail = (error: unknown) =>
    toast.error(
      error instanceof ApiError && error.code && t.has(`error.${error.code}` as 'error.desk_booked')
        ? t(`error.${error.code}` as 'error.desk_booked')
        : tt('error', { message: error instanceof Error ? error.message : String(error) }),
    );
  const withUndo = (message: string, undo: () => Promise<unknown>) =>
    toast.success(message, {
      duration: 8000,
      action: {
        label: tt('undo'),
        onClick: () => undo().then(() => toast(tt('undone')), fail),
      },
    });

  const book = (person?: { id: string; displayName: string }) =>
    bookM
      .mutateAsync({ seatId: seat.id, day, personId: person?.id })
      .then(
        (b) =>
          withUndo(
            person && person.id !== meId
              ? t('bookedFor', { label: seat.label, name: person.displayName, day: dayName(day) })
              : t('booked', { label: seat.label, day: dayName(day) }),
            () => cancelM.mutateAsync(b.id),
          ),
        fail,
      );
  const cancel = (b: Booking) =>
    cancelM
      .mutateAsync(b.id)
      .then(
        () =>
          withUndo(t('cancelled', { label: seat.label, day: dayName(day) }), () =>
            bookM.mutateAsync({ seatId: seat.id, day, personId: b.personId }),
          ),
        fail,
      );

  if (seat.status === 'blocked') return null;
  return (
    <div className="grid gap-3 rounded-lg border p-3" data-testid="booking-card">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {t('sharedOn', { day: dayName(day) })}
      </p>
      <p className="flex items-center gap-2 text-sm font-medium" data-testid="seat-status">
        <StatusDot status={booking ? 'taken' : 'free'} />
        {booking ? t('bookedBy') : t('free')}
      </p>
      {booking && (
        <button
          type="button"
          className="justify-self-start text-base font-medium hover:underline focus-visible:underline focus-visible:outline-none"
          onClick={() => onSelectPerson(booking.personId)}
        >
          {mine ? t('you', { name: booking.person.displayName }) : booking.person.displayName}
        </button>
      )}
      <div className="flex flex-wrap gap-2">
        {!booking && (
          <Button disabled={busy} onClick={() => book()}>
            <CalendarCheck /> {t('book', { day: dayName(day) })}
          </Button>
        )}
        {!booking && canManage && (
          <AssignPicker
            seatId={seat.id}
            label={t('bookFor')}
            disabled={busy}
            onPick={(person) => book(person)}
          />
        )}
        {booking && (mine || canManage) && (
          <Button variant="outline" disabled={busy} onClick={() => cancel(booking)}>
            <CalendarX /> {mine ? t('cancelMine') : t('cancel')}
          </Button>
        )}
      </div>
    </div>
  );
}
