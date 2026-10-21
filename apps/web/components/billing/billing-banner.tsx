'use client';

import Link from 'next/link';
import { useNow, useTranslations } from 'next-intl';
import { useMe } from '@/lib/queries';
import { cn } from '@/lib/utils';

/**
 * A line at the top of every page when billing needs attention: read-only (everyone), a failed
 * payment or a trial ending within a week (admins, who can do something about it).
 */
export function BillingBanner() {
  const t = useTranslations('billing.banner');
  const now = useNow({ updateInterval: 3_600_000 });
  const me = useMe().data;
  if (!me) return null;
  const { state, trialEndsAt } = me.billing;
  const admin = me.role === 'admin';
  const days = Math.max(0, Math.ceil((+new Date(trialEndsAt) - +now) / 86_400_000));
  const message =
    state === 'read_only'
      ? admin
        ? t('readOnlyAdmin')
        : t('readOnly')
      : state === 'past_due' && admin
        ? t('pastDue')
        : state === 'trial' && admin && days <= 7
          ? t('trialEnding', { days })
          : null;
  if (!message) return null;
  return (
    <div
      role="status"
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-2 border-b px-4 py-1.5 text-center text-sm',
        state === 'trial' ? 'bg-muted' : 'bg-destructive/10',
      )}
      data-testid="billing-banner"
    >
      <span>{message}</span>
      {admin && (
        <Link href="/billing" className="font-medium underline underline-offset-2">
          {t('open')}
        </Link>
      )}
    </div>
  );
}
