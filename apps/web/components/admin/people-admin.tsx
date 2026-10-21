'use client';

import { APP_ROLES, type AppRole } from '@seatline/shared';
import { Loader2, RefreshCw } from 'lucide-react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useDeferredValue, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageFrame, PageSection } from '@/components/common/page-frame';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useDirectory,
  useMe,
  useSetRole,
  useSyncNow,
  useTenant,
  useUpdateTenant,
} from '@/lib/queries';
import type { TenantInfo } from '@/lib/types';
import { cn } from '@/lib/utils';

const NONE = 'none';
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Admins: who can open Seatline, Microsoft 365 sync, and everyone's role. */
export function PeopleAdmin({
  consentBase,
}: {
  consentBase: { loginUrl: string; clientId: string; redirectUri: string } | null;
}) {
  const t = useTranslations('admin');
  const me = useMe();

  if (me.data && me.data.role !== 'admin')
    return (
      <Page>
        <p className="text-sm text-muted-foreground">{t('onlyAdmins')}</p>
      </Page>
    );
  return (
    <Page>
      <AccessSection />
      <MicrosoftSection consentBase={consentBase} />
      <PeopleSection />
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  const t = useTranslations('admin');
  return <PageFrame title={t('title')}>{children}</PageFrame>;
}

const Section = PageSection;

function AccessSection() {
  const t = useTranslations('admin');
  const tenant = useTenant();
  const update = useUpdateTenant();
  if (!tenant.data) return <Skeleton className="h-20" />;
  return (
    <Section title={t('accessTitle')}>
      <Select
        value={tenant.data.defaultAppRole === 'viewer' ? 'viewer' : NONE}
        onValueChange={(v) =>
          update
            .mutateAsync({ defaultAppRole: v === 'viewer' ? 'viewer' : null })
            .catch((error: unknown) => toast.error(errorText(error)))
        }
      >
        <SelectTrigger className="w-full sm:w-96" aria-label={t('accessTitle')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="viewer">{t('accessViewer')}</SelectItem>
          <SelectItem value={NONE}>{t('accessInvited')}</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{t('accessHint')}</p>
    </Section>
  );
}

function consentUrl(
  base: { loginUrl: string; clientId: string; redirectUri: string },
  tenant: TenantInfo,
) {
  const url = new URL(`${base.loginUrl}/${tenant.entraTenantId}/adminconsent`);
  url.search = new URLSearchParams({
    client_id: base.clientId,
    redirect_uri: base.redirectUri,
  }).toString();
  return url.toString();
}

function MicrosoftSection({
  consentBase,
}: {
  consentBase: { loginUrl: string; clientId: string; redirectUri: string } | null;
}) {
  const t = useTranslations('admin');
  const format = useFormatter();
  const now = useNow({ updateInterval: 30_000 });
  const [waitingSince, setWaitingSince] = useState<string | null>(null);
  const tenant = useTenant({ refetchInterval: waitingSince ? 2000 : false });
  const syncNow = useSyncNow();
  const status = tenant.data?.peopleSyncStatus;

  // stop polling once a sync newer than the click has finished (or after a minute)
  useEffect(() => {
    if (!waitingSince) return;
    if (status && status.at > waitingSince) setWaitingSince(null);
    const timer = setTimeout(() => setWaitingSince(null), 60_000);
    return () => clearTimeout(timer);
  }, [status, waitingSince]);

  if (!tenant.data) return <Skeleton className="h-24" />;
  if (!tenant.data.entraTenantId)
    return (
      <Section title={t('microsoftTitle')}>
        <p className="text-sm text-muted-foreground">{t('notConnected')}</p>
      </Section>
    );
  return (
    <Section title={t('microsoftTitle')}>
      <div className="grid gap-3 rounded-lg border p-4" data-testid="sync-status">
        {status?.ok ? (
          <div className="grid gap-0.5">
            <p className="text-sm font-medium">
              {t('lastSync', { when: format.relativeTime(new Date(status.at), now) })}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {t('syncCounts', {
                created: status.created ?? 0,
                updated: status.updated ?? 0,
                deactivated: status.deactivated ?? 0,
                seatsFreed: status.seatsFreed ?? 0,
              })}
            </p>
          </div>
        ) : status?.error === 'consent_required' ? (
          <div className="grid gap-2">
            <p className="text-sm">{t('consentNeeded')}</p>
            {consentBase && (
              <Button asChild variant="outline" className="justify-self-start">
                <a href={consentUrl(consentBase, tenant.data)}>{t('consentButton')}</a>
              </Button>
            )}
          </div>
        ) : status ? (
          <p className="text-sm">
            {t('syncFailed', { message: status.message ?? status.error ?? '' })}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{t('neverSynced')}</p>
        )}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            disabled={!!waitingSince || syncNow.isPending}
            onClick={() =>
              syncNow.mutateAsync().then(
                () => {
                  setWaitingSince(new Date().toISOString());
                  toast(t('syncQueued'));
                },
                (error: unknown) => toast.error(errorText(error)),
              )
            }
          >
            {waitingSince ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {waitingSince ? t('syncing') : t('syncNow')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t('syncHint')}</p>
      </div>
    </Section>
  );
}

function PeopleSection() {
  const t = useTranslations('admin');
  const tRole = useTranslations('devLogin.role');
  const directory = useDirectory();
  const setRole = useSetRole();
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim().toLowerCase());
  const people = (directory.data ?? []).filter(
    (p) =>
      !q || [p.displayName, p.email, p.department ?? ''].some((v) => v.toLowerCase().includes(q)),
  );
  const roleLabel = (role: AppRole | null) => (role ? tRole(role) : t('roleNone'));

  return (
    <Section title={t('peopleTitle')}>
      <Input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('search')}
        aria-label={t('search')}
        className="sm:w-96"
      />
      {directory.isPending && <Skeleton className="h-40" />}
      <ul className="divide-y rounded-lg border" data-testid="directory">
        {people.map((p) => (
          <li
            key={p.id}
            className={cn(
              'flex flex-wrap items-center gap-3 px-4 py-2.5',
              !p.active && 'opacity-60',
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate text-sm font-medium">
                {p.displayName}
                {!p.active && <Badge variant="secondary">{t('left')}</Badge>}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {[p.email, p.department].filter(Boolean).join(' · ')}
              </p>
            </div>
            <Select
              value={p.appRole ?? NONE}
              disabled={!p.active}
              onValueChange={(v) => {
                const appRole = v === NONE ? null : (v as AppRole);
                setRole.mutateAsync({ id: p.id, appRole }).then(
                  () =>
                    toast.success(
                      t('roleChanged', { name: p.displayName, role: roleLabel(appRole) }),
                    ),
                  (error: unknown) => toast.error(errorText(error)),
                );
              }}
            >
              <SelectTrigger className="w-36" aria-label={`${t('columnRole')}: ${p.displayName}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APP_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {tRole(role)}
                  </SelectItem>
                ))}
                <SelectItem value={NONE}>{t('roleNone')}</SelectItem>
              </SelectContent>
            </Select>
          </li>
        ))}
      </ul>
    </Section>
  );
}
