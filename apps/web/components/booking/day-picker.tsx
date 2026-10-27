'use client';

import { CalendarDays } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { addDays, bookingDays } from '@/lib/bookings';

/** Which day the map shows shared desks for: today, tomorrow, … 4 weeks ahead. */
export function DayPicker({
  today,
  day,
  onChange,
}: {
  today: string;
  day: string;
  onChange: (day: string) => void;
}) {
  const t = useTranslations('booking');
  const format = useFormatter();
  const label = (d: string) =>
    d === today
      ? t('today')
      : d === addDays(today, 1)
        ? t('tomorrow')
        : format.dateTime(new Date(`${d}T12:00:00Z`), {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            timeZone: 'UTC',
          });
  return (
    <Select value={day} onValueChange={onChange}>
      <SelectTrigger
        size="sm"
        className="w-auto gap-1.5"
        aria-label={t('dayLabel')}
        data-testid="booking-day"
      >
        <CalendarDays className="size-4" aria-hidden />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {bookingDays(today).map((d) => (
          <SelectItem key={d} value={d}>
            {label(d)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** "Mon 3 Nov" / "today" / "tomorrow" for texts about a booking. */
export function useDayName(today: string) {
  const t = useTranslations('booking');
  const format = useFormatter();
  return (d: string) =>
    d === today
      ? t('todayLower')
      : d === addDays(today, 1)
        ? t('tomorrowLower')
        : format.dateTime(new Date(`${d}T12:00:00Z`), {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            timeZone: 'UTC',
          });
}
