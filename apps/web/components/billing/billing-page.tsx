'use client';

import { monthlyPrice } from '@seatline/shared/dist/pricing';
import { CreditCard, ExternalLink, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageFrame, PageSection } from '@/components/common/page-frame';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useBilling, useBillingRedirect, useMe } from '@/lib/queries';

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Admins: the subscription — trial, price per seat, Stripe checkout and portal. */
export function BillingPage() {
  const t = useTranslations('billing');
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const me = useMe();
  const justPaid = useSearchParams().get('checkout') === 'done';
  // after Stripe Checkout the webhook can take a few seconds: look again until it's in
  const [waiting, setWaiting] = useState(justPaid);
  const billing = useBilling({ refetchInterval: waiting ? 2000 : false });
  const go = useBillingRedirect();
  const b = billing.data;

  useEffect(() => {
    if (justPaid) toast.success(t('thanks'));
  }, [justPaid, t]);
  useEffect(() => {
    if (!waiting) return;
    if (b?.state === 'active') setWaiting(false);
    const stop = setTimeout(() => setWaiting(false), 30_000);
    return () => clearTimeout(stop);
  }, [waiting, b?.state]);

  if (me.data && me.data.role !== 'admin')
    return (
      <PageFrame title={t('title')}>
        <p className="text-sm text-muted-foreground">{t('onlyAdmins')}</p>
      </PageFrame>
    );
  if (!b)
    return (
      <PageFrame title={t('title')}>
        <Skeleton className="h-40" />
      </PageFrame>
    );
  if (!b.configured)
    return (
      <PageFrame title={t('title')}>
        <p className="text-sm text-muted-foreground">{t('notConfigured')}</p>
      </PageFrame>
    );

  const money = (amount: number) =>
    b.price
      ? format.number(amount, { style: 'currency', currency: b.price.currency.toUpperCase() })
      : '';
  const trialDays = Math.max(0, Math.ceil((+new Date(b.trialEndsAt) - +now) / 86_400_000));
  const run = (to: 'checkout' | 'portal') =>
    go.mutateAsync(to).catch((error: unknown) => toast.error(errorText(error)));

  return (
    <PageFrame title={t('title')}>
      <PageSection title={t('plan')}>
        <div className="grid gap-4 rounded-xl border p-4" data-testid="billing-status">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                b.state === 'read_only' || b.state === 'past_due' ? 'destructive' : 'secondary'
              }
            >
              {t(`state.${b.state}`)}
            </Badge>
            {waiting && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> {t('confirming')}
              </span>
            )}
          </div>
          <p className="text-sm">
            {b.state === 'trial'
              ? t('trialLeft', {
                  days: trialDays,
                  date: format.dateTime(new Date(b.trialEndsAt), { dateStyle: 'long' }),
                })
              : b.state === 'read_only'
                ? t('readOnlyBody')
                : b.state === 'past_due'
                  ? t('pastDueBody')
                  : b.periodEnd
                    ? t('nextBill', {
                        date: format.dateTime(new Date(b.periodEnd), { dateStyle: 'long' }),
                      })
                    : t('activeBody')}
          </p>
          {b.price && (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">{t('pricePerSeat')}</dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {t('perMonth', { price: money(b.price.tiers[0]?.amount ?? 0) })}
                </dd>
                {b.price.tiers.slice(1).map((tier, i) => (
                  <dd key={i} className="text-xs text-muted-foreground">
                    {t('volumeTier', {
                      price: money(tier.amount),
                      from: (b.price!.tiers[i]!.upTo ?? 0) + 1,
                    })}
                  </dd>
                ))}
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('activeSeats')}</dt>
                <dd className="text-lg font-semibold tabular-nums">{b.seats}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('estimate')}</dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {t('perMonth', { price: money(monthlyPrice(b.seats, b.price.tiers)) })}
                </dd>
              </div>
            </dl>
          )}
          <p className="text-xs text-muted-foreground">{t('seatsHint')}</p>
          <div className="flex flex-wrap gap-2">
            {!b.subscribed && (
              <Button onClick={() => run('checkout')} disabled={go.isPending}>
                <CreditCard /> {t('subscribe')}
              </Button>
            )}
            {b.subscribed && (
              <Button variant="outline" onClick={() => run('portal')} disabled={go.isPending}>
                <ExternalLink /> {t('manage')}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t('stripeHint')}</p>
        </div>
      </PageSection>
    </PageFrame>
  );
}
