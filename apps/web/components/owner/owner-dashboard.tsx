'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ellipsis, RefreshCw, Trash2 } from 'lucide-react';
import { notFound } from 'next/navigation';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageFrame } from '@/components/common/page-frame';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { api, ApiError } from '@/lib/api';
import type { OwnerOverview } from '@/lib/types';
import { cn } from '@/lib/utils';

type Workspace = OwnerOverview['workspaces'][number];

const STRIPE_STATUSES = [
  'active',
  'trialing',
  'past_due',
  'canceled',
  'unpaid',
  'incomplete',
  'incomplete_expired',
  'paused',
] as const;
type StripeStatus = (typeof STRIPE_STATUSES)[number];
const isStripeStatus = (s: string): s is StripeStatus =>
  (STRIPE_STATUSES as readonly string[]).includes(s);
type Stripe = Exclude<OwnerOverview['stripe'], null | { error: 'unavailable' }>;
type Azure = Exclude<OwnerOverview['azure'], null | { error: 'unavailable'; detail?: string }>;

/** The operator's dashboard: sign-ups, workspaces, Stripe and Azure, refreshed every 30 s. */
export function OwnerDashboard({ initial }: { initial: OwnerOverview | null }) {
  const t = useTranslations('owner');
  const format = useFormatter();
  const query = useQuery({
    queryKey: ['owner'],
    queryFn: () => api<OwnerOverview>('/owner/overview'),
    initialData: initial ?? undefined,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  });
  if (query.error instanceof ApiError && query.error.status === 404) notFound();
  const data = query.data;
  return (
    <PageFrame
      title={t('title')}
      wide
      actions={
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {data &&
            t('updated', { time: format.dateTime(new Date(data.at), { timeStyle: 'medium' }) })}
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label={t('refresh')}
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw className={cn(query.isFetching && 'animate-spin')} />
          </Button>
        </div>
      }
    >
      {!data ? <Skeleton className="h-96" /> : <Overview data={data} />}
    </PageFrame>
  );
}

function money(amount: number, currency: string, format: ReturnType<typeof useFormatter>) {
  return format.number(amount, { style: 'currency', currency, maximumFractionDigits: 2 });
}

function Overview({ data }: { data: OwnerOverview }) {
  const t = useTranslations('owner');
  const format = useFormatter();
  const stripe = data.stripe && !('error' in data.stripe) ? data.stripe : null;
  const azure = data.azure && !('error' in data.azure) ? data.azure : null;
  return (
    <div className="grid gap-8" data-testid="owner-dashboard">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label={t('kpi.mrr')}>{stripe ? money(stripe.mrr, stripe.currency, format) : '—'}</Kpi>
        <Kpi label={t('kpi.paying')}>{data.totals.paying}</Kpi>
        <Kpi label={t('kpi.inTrial')}>{data.totals.inTrial}</Kpi>
        <Kpi label={t('kpi.signups30')} hint={t('kpi.signups7', { count: data.totals.last7Days })}>
          {data.totals.last30Days}
        </Kpi>
        <Kpi label={t('kpi.azureMonth')}>
          {azure ? money(azure.total, azure.currency, format) : '—'}
        </Kpi>
        <Kpi
          label={t('kpi.result')}
          hint={t('kpi.resultHint')}
          tone={stripe && azure ? (stripe.mrr - azure.total >= 0 ? 'good' : 'bad') : undefined}
        >
          {stripe && azure ? money(stripe.mrr - azure.total, stripe.currency, format) : '—'}
        </Kpi>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t('signups.title')}>
          <Bars
            values={data.signupsPerDay.map((d) => ({ label: d.day, value: d.count }))}
            format={(v) => String(v)}
          />
          <p className="text-xs text-muted-foreground">
            {t('signups.summary', {
              total: data.totals.workspaces,
              active: data.totals.activeLast7Days,
              people: data.totals.people,
              seats: data.totals.seats,
              demos: data.totals.demosOpen,
              ended: data.totals.trialEnded,
            })}
          </p>
        </Panel>
        <StripePanel stripe={data.stripe} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <AzurePanel azure={data.azure} />
        <UsagePanel usage={data.usage} />
      </div>
      <Workspaces list={data.workspaces} />
    </div>
  );
}

function Kpi({
  label,
  hint,
  tone,
  children,
}: {
  label: string;
  hint?: string;
  tone?: 'good' | 'bad';
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          'text-2xl font-semibold tabular-nums',
          tone === 'good' && 'text-[var(--seat-free-stroke)]',
          tone === 'bad' && 'text-destructive',
        )}
      >
        {children}
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid content-start gap-3 rounded-xl border bg-card p-4">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** A small bar chart (days left to right); the label shows on hover. */
function Bars({
  values,
  format,
}: {
  values: Array<{ label: string; value: number }>;
  format: (v: number) => string;
}) {
  const max = Math.max(1, ...values.map((v) => v.value));
  return (
    <div
      className="flex h-28 items-end gap-0.5"
      role="img"
      aria-label={values.map((v) => `${v.label}: ${format(v.value)}`).join(', ')}
    >
      {values.map((v) => (
        <div
          key={v.label}
          title={`${v.label}: ${format(v.value)}`}
          className="min-w-1 flex-1 rounded-t-sm bg-primary/80"
          style={{ height: `${Math.max(v.value ? 4 : 1, (v.value / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

function StripePanel({ stripe }: { stripe: OwnerOverview['stripe'] }) {
  const t = useTranslations('owner');
  const format = useFormatter();
  if (!stripe)
    return (
      <Panel title="Stripe">
        <p className="text-sm text-muted-foreground">{t('stripe.off')}</p>
      </Panel>
    );
  if ('error' in stripe)
    return (
      <Panel title="Stripe">
        <p className="text-sm text-destructive">{t('stripe.error')}</p>
      </Panel>
    );
  const s: Stripe = stripe;
  return (
    <Panel title="Stripe">
      {!s.live && <Badge variant="outline">{t('stripe.testMode')}</Badge>}
      <dl className="grid grid-cols-3 gap-3 text-sm">
        <Stat label={t('stripe.paid30')}>{money(s.paidLast30Days, s.currency, format)}</Stat>
        <Stat label={t('stripe.available')}>{money(s.balance.available, s.currency, format)}</Stat>
        <Stat label={t('stripe.pending')}>{money(s.balance.pending, s.currency, format)}</Stat>
      </dl>
      <p className="text-xs text-muted-foreground">
        {Object.entries(s.subscriptions)
          .map(
            ([status, n]) =>
              `${isStripeStatus(status) ? t(`stripe.status.${status}`) : status}: ${n}`,
          )
          .join(' · ') || t('stripe.noSubscriptions')}
      </p>
      <ul className="grid gap-1 text-sm">
        {s.payments.length === 0 && (
          <li className="text-muted-foreground">{t('stripe.noPayments')}</li>
        )}
        {s.payments.map((p) => (
          <li key={p.id} className="flex justify-between gap-2">
            <span className="truncate">{p.customer ?? '—'}</span>
            <span className="shrink-0 text-muted-foreground tabular-nums">
              {format.dateTime(new Date(p.at), { dateStyle: 'medium' })} ·{' '}
              {money(p.amount, p.currency, format)}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function AzurePanel({ azure }: { azure: OwnerOverview['azure'] }) {
  const t = useTranslations('owner');
  const format = useFormatter();
  if (!azure || 'error' in azure)
    return (
      <Panel title="Azure">
        <p className={cn('text-sm', azure ? 'text-destructive' : 'text-muted-foreground')}>
          {azure ? t('azure.error') : t('azure.off')}
        </p>
        {azure?.detail && (
          <>
            <p className="mt-2 font-mono text-xs break-words text-muted-foreground">
              {azure.detail}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{t('azure.fix')}</p>
          </>
        )}
      </Panel>
    );
  const a: Azure = azure;
  return (
    <Panel title="Azure">
      <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
        <div className="grid content-start gap-3">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Stat label={t('azure.month')}>{money(a.total, a.currency, format)}</Stat>
            <Stat label={t('azure.forecast')}>{money(a.forecast, a.currency, format)}</Stat>
            <Stat label={t('azure.lastMonth')}>
              {a.lastMonth == null ? '—' : money(a.lastMonth, a.currency, format)}
            </Stat>
          </dl>
          <ul className="grid gap-1 text-sm">
            {a.byService.map((s) => (
              <li key={s.name} className="flex justify-between gap-2">
                <span className="truncate">{s.name}</span>
                <span className="shrink-0 tabular-nums">{money(s.amount, a.currency, format)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid content-start gap-2">
          <Bars
            values={a.daily.map((d) => ({ label: d.day, value: d.amount }))}
            format={(v) => money(v, a.currency, format)}
          />
          <p className="text-xs text-muted-foreground">
            {t('azure.note', { time: format.dateTime(new Date(a.at), { timeStyle: 'short' }) })}
          </p>
        </div>
      </div>
    </Panel>
  );
}

/** Storage right now: the database (against its disk) and the stored files. */
function UsagePanel({ usage }: { usage: OwnerOverview['usage'] }) {
  const t = useTranslations('owner');
  const format = useFormatter();
  const size = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024)));
    return `${format.number(bytes / 1024 ** i, { maximumFractionDigits: i ? 1 : 0 })} ${units[i]}`;
  };
  const { database: db, files } = usage;
  const share = db.bytes / db.diskBytes;
  return (
    <Panel title={t('usage.title')}>
      <div className="grid gap-1.5">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="text-muted-foreground">{t('usage.database')}</span>
          <span className="font-medium tabular-nums">
            {t('usage.of', { used: size(db.bytes), total: size(db.diskBytes) })}
          </span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="meter"
          aria-label={t('usage.database')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(share * 100)}
        >
          <div
            className={cn('h-full rounded-full', share > 0.8 ? 'bg-destructive' : 'bg-primary')}
            style={{ width: `${Math.max(share * 100, 1)}%` }}
          />
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Stat label={t('usage.files')}>
          {files ? t('usage.filesValue', { size: size(files.bytes), count: files.files }) : '—'}
        </Stat>
        <Stat label={t('usage.imports')}>
          {files
            ? t('usage.filesValue', { size: size(files.imports.bytes), count: files.imports.files })
            : '—'}
        </Stat>
      </dl>
      <div className="grid gap-1 text-sm">
        <p className="text-xs text-muted-foreground">{t('usage.tables')}</p>
        <ul className="grid gap-1">
          {db.tables.map((table) => (
            <li key={table.name} className="flex justify-between gap-2">
              <span className="truncate font-mono text-xs">{table.name}</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {table.rows == null
                  ? size(table.bytes)
                  : t('usage.tableValue', { size: size(table.bytes), rows: table.rows })}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{children}</dd>
    </div>
  );
}

function Workspaces({ list }: { list: Workspace[] }) {
  const t = useTranslations('owner');
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const [demos, setDemos] = useState(false);
  const [deleting, setDeleting] = useState<Workspace | null>(null);
  const shown = list.filter((w) => demos || !w.demo);
  const status = (w: Workspace) => {
    if (w.demo) return { label: t('status.demo'), variant: 'outline' as const };
    if (w.owner) return { label: t('status.owner'), variant: 'default' as const };
    if (w.subscribed && w.billingStatus)
      return {
        label: isStripeStatus(w.billingStatus)
          ? t(`stripe.status.${w.billingStatus}`)
          : w.billingStatus,
        variant: w.billingStatus === 'active' ? ('default' as const) : ('destructive' as const),
      };
    const ends = new Date(w.trialEndsAt);
    return ends > now
      ? {
          label: t('status.trialUntil', { date: format.dateTime(ends, { dateStyle: 'medium' }) }),
          variant: 'secondary' as const,
        }
      : { label: t('status.trialEnded'), variant: 'destructive' as const };
  };
  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{t('workspaces.title', { count: shown.length })}</h2>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={demos} onCheckedChange={setDemos} />
          {t('workspaces.showDemos')}
        </label>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[56rem] text-sm" data-testid="owner-workspaces">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">{t('workspaces.name')}</th>
              <th className="px-2 py-2 font-medium">{t('workspaces.created')}</th>
              <th className="px-2 py-2 font-medium">{t('workspaces.signIn')}</th>
              <th className="px-2 py-2 text-right font-medium">{t('workspaces.people')}</th>
              <th className="px-2 py-2 text-right font-medium">{t('workspaces.desks')}</th>
              <th className="px-2 py-2 font-medium">{t('workspaces.status')}</th>
              <th className="px-2 py-2 font-medium">{t('workspaces.lastActivity')}</th>
              <th className="px-4 py-2 font-medium">{t('workspaces.admins')}</th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {shown.map((w) => {
              const s = status(w);
              return (
                <tr key={w.id} className="border-t align-top">
                  <td className="px-4 py-2 font-medium">{w.name}</td>
                  <td className="px-2 py-2 whitespace-nowrap text-muted-foreground">
                    {format.dateTime(new Date(w.createdAt), { dateStyle: 'medium' })}
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">
                    {w.signIn === 'microsoft' ? 'Microsoft 365' : t('workspaces.email')}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{w.people}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {w.seated}/{w.seats}
                  </td>
                  <td className="px-2 py-2">
                    <Badge variant={s.variant}>{s.label}</Badge>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-muted-foreground">
                    {w.lastActivity ? format.relativeTime(new Date(w.lastActivity), now) : '—'}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {w.admins.map((email) => (
                      <a key={email} href={`mailto:${email}`} className="block hover:underline">
                        {email}
                      </a>
                    ))}
                  </td>
                  <td className="px-2 py-1">
                    {!w.owner && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={t('delete.options', { name: w.name })}
                          >
                            <Ellipsis />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(w)}>
                            <Trash2 /> {t('delete.action')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <DeleteWorkspace workspace={deleting} onClose={() => setDeleting(null)} />
    </section>
  );
}

/** Support: delete a whole workspace after typing its name (the API checks it again). */
function DeleteWorkspace({
  workspace,
  onClose,
}: {
  workspace: Workspace | null;
  onClose: () => void;
}) {
  const t = useTranslations('owner.delete');
  const queryClient = useQueryClient();
  const [typed, setTyped] = useState('');
  const remove = useMutation({
    mutationFn: (w: Workspace) =>
      api<void>(`/owner/workspaces/${w.id}`, { method: 'DELETE', body: { name: typed } }),
    onSuccess: (_, w) => {
      toast.success(t('done', { name: w.name }));
      void queryClient.invalidateQueries({ queryKey: ['owner'] });
      close();
    },
    onError: (error) => {
      const code = error instanceof ApiError ? error.code : undefined;
      toast.error(
        code === 'subscribed'
          ? t('subscribed')
          : code === 'own_workspace'
            ? t('own')
            : code === 'name_mismatch'
              ? t('mismatch')
              : t('failed'),
      );
    },
  });
  const close = () => {
    setTyped('');
    onClose();
  };
  return (
    <AlertDialog open={!!workspace} onOpenChange={(o) => !o && close()}>
      <AlertDialogContent>
        <AlertDialogTitle>{t('title', { name: workspace?.name ?? '' })}</AlertDialogTitle>
        <AlertDialogDescription>{t('body')}</AlertDialogDescription>
        <div className="grid gap-2">
          <Label htmlFor="delete-workspace-name">{t('label')}</Label>
          <Input
            id="delete-workspace-name"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={workspace?.name}
            autoComplete="off"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!workspace || typed.trim() !== workspace.name.trim() || remove.isPending}
            onClick={() => workspace && remove.mutate(workspace)}
          >
            {t('confirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
