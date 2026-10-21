'use client';

import { ArrowRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageFrame, PageSection } from '@/components/common/page-frame';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useCreateMovePlan, useMe, useMovePlans } from '@/lib/queries';
import type { MovePlanSummary } from '@/lib/types';
import { PlanStatus } from './plan-status';

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Editors and admins: move plans — prepared seat changes, applied together. */
export function MovesPage() {
  const t = useTranslations('moves');
  const me = useMe();
  const open = useMovePlans('open');
  const done = useMovePlans('done');
  const [creating, setCreating] = useState(false);

  if (me.data && me.data.role === 'viewer')
    return (
      <PageFrame title={t('title')}>
        <p className="text-sm text-muted-foreground">{t('onlyEditors')}</p>
      </PageFrame>
    );
  return (
    <PageFrame
      title={t('title')}
      actions={
        <Button onClick={() => setCreating(true)}>
          <Plus /> {t('newPlan')}
        </Button>
      }
    >
      <p className="-mt-4 text-sm text-muted-foreground">{t('intro')}</p>
      <PageSection title={t('openPlans')}>
        <PlanList plans={open.data} empty={t('noOpenPlans')} />
      </PageSection>
      <PageSection title={t('donePlans')}>
        <PlanList plans={done.data} empty={t('noDonePlans')} />
      </PageSection>
      <NewPlanDialog open={creating} onClose={() => setCreating(false)} />
    </PageFrame>
  );
}

function PlanList({ plans, empty }: { plans: MovePlanSummary[] | undefined; empty: string }) {
  const t = useTranslations('moves');
  const format = useFormatter();
  if (!plans) return <Skeleton className="h-16" />;
  if (!plans.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y rounded-lg border" data-testid="plan-list">
      {plans.map((p) => (
        <li key={p.id}>
          <Link
            href={`/moves/${p.id}`}
            className="flex items-center gap-3 px-3 py-3 hover:bg-muted/50"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{p.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {t('summary', {
                  count: p.moves,
                  name: p.createdBy.displayName,
                  date: format.dateTime(new Date(p.updatedAt), { day: 'numeric', month: 'short' }),
                })}
              </p>
            </div>
            <PlanStatus status={p.status} effectiveDate={p.effectiveDate} />
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function NewPlanDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('moves');
  const router = useRouter();
  const create = useCreateMovePlan();
  const [name, setName] = useState('');
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle>{t('newPlan')}</DialogTitle>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutateAsync({ name: name.trim() }).then(
              (plan) => router.push(`/moves/${plan.id}`),
              (error: unknown) => toast.error(errorText(error)),
            );
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="plan-name">{t('planName')}</Label>
            <Input
              id="plan-name"
              value={name}
              maxLength={200}
              placeholder={t('planNamePlaceholder')}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              {t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
