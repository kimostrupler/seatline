'use client';

import { APP_ROLES, type AppRole } from '@seatline/shared';
import {
  Download,
  EllipsisVertical,
  LogOut,
  Mail,
  Pencil,
  Undo2,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react';
import Link from 'next/link';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useDeferredValue, useId, useState } from 'react';
import { toast } from 'sonner';
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
import { Button } from '@/components/ui/button';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { apiDownload } from '@/lib/api';
import { initials } from '@/lib/map-geometry';
import {
  useDirectory,
  useForgetPerson,
  useInvitePerson,
  useSetActive,
  useSetRole,
  useSetTeam,
  useStats,
  useTenant,
} from '@/lib/queries';
import { teamSlots } from '@/lib/team-colors';
import type { DirectoryPerson } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AddPersonDialog, EditPersonDialog } from './person-dialogs';

const NONE = 'none';
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

const FILTERS = ['all', 'noDesk', 'leaving', 'left'] as const;
type Filter = (typeof FILTERS)[number];

/** Team name → its map colour (the 4 largest teams), else neutral. */
export function useTeamColor() {
  const stats = useStats().data;
  const slots = teamSlots(stats?.departments ?? []);
  return (team: string | null) => {
    const slot = team ? slots.get(team) : undefined;
    return slot ? `var(--team-${slot})` : 'var(--muted-foreground)';
  };
}

/** All teams in use, A–Z. */
export const teamNames = (people: DirectoryPerson[]) =>
  [...new Set(people.flatMap((p) => (p.department ? [p.department] : [])))].sort((a, b) =>
    a.localeCompare(b),
  );

/** Everyone: who they are, their team, desk and role — search, filter, add, change. */
export function PeopleTab() {
  const t = useTranslations('admin');
  const tp = useTranslations('admin.people');
  const tRole = useTranslations('devLogin.role');
  const format = useFormatter();
  const tenant = useTenant().data;
  const directory = useDirectory();
  const setRole = useSetRole();
  const colorOf = useTeamColor();
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const q = useDeferredValue(search.trim().toLowerCase());
  const emailWorkspace = !!tenant && !tenant.entraTenantId;
  const everyone = directory.data ?? [];
  const teams = teamNames(everyone);
  const matches = (p: DirectoryPerson) => {
    if (filter === 'noDesk' && (!p.active || p.assignments.length)) return false;
    if (filter === 'leaving' && (!p.active || !p.leavesOn)) return false;
    if (filter === 'left' && p.active) return false;
    return (
      !q ||
      [p.displayName, p.email, p.department ?? '', p.assignments[0]?.seat.label ?? ''].some((v) =>
        v.toLowerCase().includes(q),
      )
    );
  };
  const people = everyone.filter(matches);
  const roleLabel = (role: AppRole | null) => (role ? tRole(role) : t('roleNone'));
  const day = (iso: string) =>
    format.dateTime(new Date(`${iso.slice(0, 10)}T12:00:00Z`), { day: 'numeric', month: 'short' });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('search')}
          aria-label={t('search')}
          className="w-full sm:w-auto sm:max-w-80 sm:min-w-0 sm:flex-1"
        />
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={filter}
          onValueChange={(v) => v && setFilter(v as Filter)}
          aria-label={tp('filter')}
        >
          {FILTERS.map((f) => (
            <ToggleGroupItem key={f} value={f} className="px-2.5">
              {tp(`filters.${f}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button className="sm:ml-auto" onClick={() => setAdding(true)}>
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

      {directory.isPending ? (
        <Skeleton className="h-60" />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_9.5rem_2rem] gap-4 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
            <span>{tp('columns.person')}</span>
            <span>{tp('columns.team')}</span>
            <span>{tp('columns.desk')}</span>
            <span>{tp('columns.role')}</span>
            <span />
          </div>
          {people.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">{tp('nobody')}</p>
          ) : (
            <ul className="divide-y" data-testid="directory">
              {people.map((p) => {
                const seat = p.assignments[0]?.seat;
                const name = p.forgottenAt ? t('privacy.formerEmployee') : p.displayName;
                return (
                  <li
                    key={p.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_9.5rem_2rem]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden
                        className={cn(
                          'grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold',
                          !p.active && 'opacity-50',
                        )}
                      >
                        {initials(name)}
                      </span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <span className={cn('truncate', !p.active && 'text-muted-foreground')}>
                            {name}
                          </span>
                          {!p.active && <Badge variant="secondary">{t('left')}</Badge>}
                          {p.active && p.leavesOn && (
                            <Badge variant="outline">
                              {tp('leaves', { day: day(p.leavesOn) })}
                            </Badge>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                      </div>
                    </div>
                    <div className="md:hidden">
                      <PersonMenu person={p} teams={teams} emailWorkspace={emailWorkspace} />
                    </div>
                    <p className="flex min-w-0 items-center gap-2 text-sm max-md:col-span-2 max-md:pl-12">
                      {p.department ? (
                        <>
                          <span
                            aria-hidden
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ background: colorOf(p.department) }}
                          />
                          <span className="truncate">{p.department}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">{tp('noTeam')}</span>
                      )}
                      {seat && (
                        <Link
                          href={`/map?person=${p.id}`}
                          className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline md:hidden"
                        >
                          {tp('deskShort', { desk: seat.label })}
                        </Link>
                      )}
                    </p>
                    <p className="hidden text-sm md:block">
                      {seat ? (
                        <Link
                          href={`/map?person=${p.id}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {seat.label}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">
                          {p.active ? tp('noDesk') : '–'}
                        </span>
                      )}
                    </p>
                    <div className="max-md:col-span-2 max-md:pl-12">
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
                        <SelectTrigger
                          size="sm"
                          className="w-full md:w-36"
                          aria-label={`${t('columnRole')}: ${p.displayName}`}
                        >
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
                    </div>
                    <div className="hidden md:block">
                      <PersonMenu person={p} teams={teams} emailWorkspace={emailWorkspace} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {tp('count', { shown: people.length, total: everyone.length })}
      </p>
    </div>
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
          <DropdownMenuSeparator />
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
