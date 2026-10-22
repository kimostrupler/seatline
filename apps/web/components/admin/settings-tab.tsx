'use client';

import { NOTIFY_EVENTS, type NotifyEvent } from '@seatline/shared';
import { Loader2, Mail, RefreshCw, X } from 'lucide-react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageSection as Section } from '@/components/common/page-frame';
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
import { Switch } from '@/components/ui/switch';
import { useSyncNow, useTenant, useUpdateTenant } from '@/lib/queries';
import type { TenantInfo } from '@/lib/types';

const NONE = 'none';
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

export type ConsentBase = { loginUrl: string; clientId: string; redirectUri: string } | null;

/** Workspace settings: who can open Seatline, notices to IT, Microsoft 365, data protection. */
export function SettingsTab({ consentBase }: { consentBase: ConsentBase }) {
  return (
    <>
      <AccessSection />
      <NoticesSection />
      <MicrosoftSection consentBase={consentBase} />
      <PrivacySection />
    </>
  );
}

const LANGUAGES = ['de', 'fr', 'en'] as const;

/**
 * E-mail notices to IT / facility management: someone leaves (their desk is free), joins,
 * changes team, or a move plan was carried out.
 */
function NoticesSection() {
  const t = useTranslations('admin.notices');
  const tenant = useTenant().data;
  const update = useUpdateTenant();
  const [address, setAddress] = useState('');
  if (!tenant) return <Skeleton className="h-40" />;
  const save = (input: Parameters<typeof update.mutateAsync>[0], done?: string) =>
    update.mutateAsync(input).then(
      () => done && toast.success(done),
      (error: unknown) => toast.error(errorText(error)),
    );
  const add = () => {
    const email = address.trim().toLowerCase();
    if (!email) return;
    if (tenant.notifyEmails.includes(email)) return setAddress('');
    void save({ notifyEmails: [...tenant.notifyEmails, email] }, t('added', { email })).then(() =>
      setAddress(''),
    );
  };
  const toggle = (event: NotifyEvent, on: boolean) =>
    save({
      notifyEvents: on
        ? [...tenant.notifyEvents, event]
        : tenant.notifyEvents.filter((e) => e !== event),
    });
  return (
    <Section title={t('title')}>
      <p className="-mt-1 text-sm text-muted-foreground">{t('intro')}</p>
      <div className="grid gap-4 rounded-lg border p-4" data-testid="notices">
        <div className="grid gap-2">
          <p className="text-sm font-medium">{t('recipients')}</p>
          {tenant.notifyEmails.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {tenant.notifyEmails.map((email) => (
                <li
                  key={email}
                  className="flex items-center gap-1 rounded-full border bg-muted/40 py-0.5 pr-1 pl-3 text-sm"
                >
                  <Mail className="size-3.5 text-muted-foreground" aria-hidden />
                  {email}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 rounded-full"
                    aria-label={t('remove', { email })}
                    onClick={() =>
                      void save({ notifyEmails: tenant.notifyEmails.filter((e) => e !== email) })
                    }
                  >
                    <X className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t('none')}</p>
          )}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <Input
              type="email"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t('placeholder')}
              aria-label={t('addressLabel')}
              className="min-w-0 flex-1 sm:max-w-80"
              maxLength={320}
            />
            <Button type="submit" variant="outline" disabled={!address.trim()}>
              {t('add')}
            </Button>
          </form>
        </div>
        <div className="grid gap-2">
          <p className="text-sm font-medium">{t('about')}</p>
          <ul className="grid gap-2">
            {NOTIFY_EVENTS.map((event) => (
              <li key={event}>
                <label className="flex items-center gap-3 text-sm">
                  <Switch
                    checked={tenant.notifyEvents.includes(event)}
                    onCheckedChange={(on) => void toggle(event, on)}
                    aria-label={t(`events.${event}`)}
                  />
                  {t(`events.${event}`)}
                </label>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="notice-language" className="text-sm font-medium">
            {t('language')}
          </label>
          <Select
            value={tenant.notifyLanguage}
            onValueChange={(v) => void save({ notifyLanguage: v as TenantInfo['notifyLanguage'] })}
          >
            <SelectTrigger id="notice-language" className="w-full sm:w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l} value={l}>
                  {t(`languages.${l}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">{t('hint')}</p>
      </div>
    </Section>
  );
}

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

const RETENTION = ['12', '24', '60', '120', 'forever'] as const;

/** How long seat history and the activity log are kept (Swiss data protection). */
function PrivacySection() {
  const t = useTranslations('admin.privacy');
  const tenant = useTenant();
  const update = useUpdateTenant();
  if (!tenant.data) return <Skeleton className="h-20" />;
  const value = tenant.data.historyRetentionMonths
    ? String(tenant.data.historyRetentionMonths)
    : 'forever';
  return (
    <Section title={t('title')}>
      <div className="grid gap-1.5">
        <label htmlFor="retention" className="text-sm font-medium">
          {t('retention')}
        </label>
        <Select
          value={value}
          onValueChange={(v) =>
            update
              .mutateAsync({
                historyRetentionMonths: v === 'forever' ? null : (Number(v) as 12 | 24 | 60 | 120),
              })
              .then(
                () => toast.success(t('saved')),
                (error: unknown) => toast.error(errorText(error)),
              )
          }
        >
          <SelectTrigger id="retention" className="w-full sm:w-96">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RETENTION.map((r) => (
              <SelectItem key={r} value={r}>
                {t(`keep.${r}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">{t('retentionHint')}</p>
      <p className="text-xs text-muted-foreground">{t('requestsHint')}</p>
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
