'use client';

import { APP_ROLES, type AppRole } from '@seatline/shared';
import {
  Download,
  EllipsisVertical,
  Loader2,
  LogOut,
  Mail,
  Pencil,
  RefreshCw,
  Undo2,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react';
import { useFormatter, useLocale, useNow, useTranslations } from 'next-intl';
import { useDeferredValue, useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { PageFrame, PageSection } from '@/components/common/page-frame';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiDownload } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  useForgetPerson,
  useMe,
  useSetRole,
  useInvitePerson,
  useSetActive,
  useSetTeam,
  useSyncNow,
  useTenant,
  useUpdateTenant,
} from '@/lib/queries';
import type { DirectoryPerson, TenantInfo } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AddPersonDialog, EditPersonDialog } from './person-dialogs';

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
      <PrivacySection />
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

function PeopleSection() {
  const t = useTranslations('admin');
  const tenant = useTenant().data;
  const [adding, setAdding] = useState(false);
  const emailWorkspace = !!tenant && !tenant.entraTenantId;
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
  const teams = [
    ...new Set((directory.data ?? []).flatMap((p) => (p.department ? [p.department] : []))),
  ].sort((a, b) => a.localeCompare(b));

  return (
    <Section title={t('peopleTitle')}>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('search')}
          aria-label={t('search')}
          className="min-w-0 flex-1 sm:max-w-96"
        />
        <Button onClick={() => setAdding(true)}>
          <UserPlus /> {t('add.button')}
        </Button>
      </div>
      {adding && (
        <AddPersonDialog
          teams={teams}
          canInvite={emailWorkspace}
          onClose={() => setAdding(false)}
        />
      )}
      <p className="text-xs text-muted-foreground">{t('teams.hint')}</p>
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
                {p.forgottenAt ? t('privacy.formerEmployee') : p.displayName}
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
            <PersonMenu person={p} teams={teams} emailWorkspace={emailWorkspace} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Per person: their data as a file (access request), and forgetting people who left. */
function PersonMenu({
  person,
  teams,
  emailWorkspace,
}: {
  person: DirectoryPerson;
  teams: string[];
  emailWorkspace: boolean;
}) {
  const t = useTranslations('admin.privacy');
  const tt = useTranslations('admin.teams');
  const ta = useTranslations('admin.add');
  const locale = useLocale().slice(0, 2); // 'de-CH' → 'de' (e-mail language)
  const setActive = useSetActive();
  const invite = useInvitePerson();
  const [editing, setEditing] = useState(false);
  // people from Microsoft 365 are changed there (and leave through the sync)
  const byHand = !person.entraObjectId && !person.forgottenAt;
  const forget = useForgetPerson();
  const [confirm, setConfirm] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const name = person.forgottenAt ? t('formerEmployee') : person.displayName;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label={t('menu', { name })}>
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem disabled={!!person.forgottenAt} onSelect={() => setTeamOpen(true)}>
            <Users /> {tt('setTeam')}
          </DropdownMenuItem>
          {byHand && (
            <DropdownMenuItem onSelect={() => setEditing(true)}>
              <Pencil /> {ta('edit')}
            </DropdownMenuItem>
          )}
          {byHand && emailWorkspace && person.active && person.appRole && (
            <DropdownMenuItem
              onSelect={() =>
                invite.mutateAsync({ id: person.id, language: locale }).then(
                  (r) =>
                    r.invited
                      ? toast.success(ta('invited', { name: person.displayName }))
                      : toast.error(ta('notInvited')),
                  (error: unknown) => toast.error(errorText(error)),
                )
              }
            >
              <Mail /> {ta('sendInvite')}
            </DropdownMenuItem>
          )}
          {byHand && (
            <DropdownMenuItem
              onSelect={() =>
                setActive.mutateAsync({ id: person.id, active: !person.active }).then(
                  () =>
                    toast.success(
                      ta(person.active ? 'leftDone' : 'backDone', { name: person.displayName }),
                    ),
                  (error: unknown) => toast.error(errorText(error)),
                )
              }
            >
              {person.active ? <LogOut /> : <Undo2 />} {ta(person.active ? 'leave' : 'back')}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() =>
              void apiDownload(`/privacy/people/${person.id}/export`).catch((e: unknown) =>
                toast.error(errorText(e)),
              )
            }
          >
            <Download /> {t('download')}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={person.active || !!person.forgottenAt}
            onSelect={() => setConfirm(true)}
          >
            <UserX /> {person.forgottenAt ? t('alreadyForgotten') : t('forget')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {editing && <EditPersonDialog person={person} onClose={() => setEditing(false)} />}
      {teamOpen && <TeamDialog person={person} teams={teams} onClose={() => setTeamOpen(false)} />}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogTitle>{t('forgetTitle', { name })}</AlertDialogTitle>
          <AlertDialogDescription>{t('forgetBody')}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                forget.mutateAsync(person.id).then(
                  () => toast.success(t('forgotten')),
                  (error: unknown) => toast.error(errorText(error)),
                )
              }
            >
              {t('forget')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Set someone's team by hand (or hand it back to Microsoft 365). */
function TeamDialog({
  person,
  teams,
  onClose,
}: {
  person: DirectoryPerson;
  teams: string[];
  onClose: () => void;
}) {
  const t = useTranslations('admin.teams');
  const setTeam = useSetTeam();
  const [team, setTeamText] = useState(person.department ?? '');
  const listId = useId();
  const save = (body: { team: string | null } | { fromDirectory: true }) =>
    setTeam.mutateAsync({ id: person.id, ...body }).then(
      () => {
        toast.success(t('saved', { name: person.displayName }));
        onClose();
      },
      (error: unknown) => toast.error(errorText(error)),
    );
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title', { name: person.displayName })}</DialogTitle>
          <DialogDescription>
            {person.entraObjectId ? t('microsoftHint') : t('manualHint')}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save({ team: team.trim() || null });
          }}
        >
          <Label htmlFor={`${listId}-team`}>{t('label')}</Label>
          <Input
            id={`${listId}-team`}
            list={listId}
            value={team}
            maxLength={100}
            onChange={(e) => setTeamText(e.target.value)}
            placeholder={t('placeholder')}
          />
          <datalist id={listId}>
            {teams.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <DialogFooter className="mt-2">
            {person.entraObjectId && person.teamManual && (
              <Button
                type="button"
                variant="ghost"
                className="sm:mr-auto"
                onClick={() => void save({ fromDirectory: true })}
              >
                {t('fromMicrosoft')}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={setTeam.isPending}>
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
