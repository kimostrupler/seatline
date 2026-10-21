'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import type { MovePlanStatus } from '@/lib/types';

/** Draft · Scheduled for Mon, 3 Nov · Applied · Cancelled · Couldn't be applied */
export function PlanStatus({
  status,
  effectiveDate,
}: {
  status: MovePlanStatus;
  effectiveDate: string | null;
}) {
  const t = useTranslations('moves.status');
  const format = useFormatter();
  const date = effectiveDate
    ? format.dateTime(new Date(`${effectiveDate}T12:00:00Z`), {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    : '';
  return (
    <Badge
      variant={
        status === 'failed' ? 'destructive' : status === 'scheduled' ? 'default' : 'secondary'
      }
      className={status === 'cancelled' ? 'line-through' : undefined}
    >
      {status === 'scheduled' ? t('scheduled', { date }) : t(status)}
    </Badge>
  );
}
