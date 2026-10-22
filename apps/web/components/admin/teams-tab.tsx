'use client';

import { EllipsisVertical, Pencil, Plus, Trash2, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
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
import { Skeleton } from '@/components/ui/skeleton';
import { initials } from '@/lib/map-geometry';
import { useApplyChanges, useDirectory, useRenameTeam, useStats } from '@/lib/queries';
import type { DirectoryPerson } from '@/lib/types';
import { teamNames, useTeamColor } from './people-tab';

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

type Dialogs =
  | { kind: 'new' }
  | { kind: 'add'; team: string }
  | { kind: 'rename'; team: string }
  | { kind: 'remove'; team: string }
  | null;

/**
 * Teams = what people's department says. Each team: how many have a desk, on which floors —
 * and the same colour as on the map. Create, rename, remove a team, or add people to it.
 */
export function TeamsTab() {
  const t = useTranslations('admin.teamsTab');
  const directory = useDirectory();
  const stats = useStats().data;
  const colorOf = useTeamColor();
  const [dialog, setDialog] = useState<Dialogs>(null);
  if (!directory.data) return <Skeleton className="h-60" />;
  const active = directory.data.filter((p) => p.active && !p.forgottenAt);
  const teams = teamNames(active);
  const withoutTeam = active.filter((p) => !p.department);
  const close = () => setDialog(null);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t('intro')}</p>
        <Button onClick={() => setDialog({ kind: 'new' })}>
          <Plus /> {t('newTeam')}
        </Button>
      </div>
      {teams.length === 0 && (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t('none')}
        </p>
      )}
      <ul className="grid gap-3 md:grid-cols-2" data-testid="teams">
        {teams.map((team) => {
          const members = active.filter((p) => p.department === team);
          const seated = members.filter((p) => p.assignments.length).length;
          const floors = stats?.departments.find((d) => d.name === team)?.floors ?? [];
          const color = colorOf(team);
          return (
            <li key={team} className="grid gap-3 rounded-xl border bg-card p-4" aria-label={team}>
              <div className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-1.5 size-3 shrink-0 rounded-full"
                  style={{ background: color }}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">{team}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('counts', { people: members.length, seated })}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={t('menu', { team })}
                    >
                      <EllipsisVertical />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onSelect={() => setDialog({ kind: 'add', team })}>
                      <UserPlus /> {t('addPeople')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setDialog({ kind: 'rename', team })}>
                      <Pencil /> {t('rename')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setDialog({ kind: 'remove', team })}
                    >
                      <Trash2 /> {t('remove')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div
                role="img"
                aria-label={t('counts', { people: members.length, seated })}
                className="h-2 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${members.length ? (seated / members.length) * 100 : 0}%`,
                    background: color,
                  }}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <Faces people={members} />
                <span className="flex flex-wrap justify-end gap-1">
                  {floors.map((f) => (
                    <Link
                      key={f.floorId}
                      href={`/map?building=${f.buildingId}&floor=${f.floorId}`}
                      className="rounded-md border px-1.5 py-0.5 text-xs hover:bg-muted"
                    >
                      {f.floorName} · {f.count}
                    </Link>
                  ))}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      {withoutTeam.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed px-4 py-3">
          <div className="flex items-center gap-3">
            <Faces people={withoutTeam} />
            <p className="text-sm text-muted-foreground">
              {t('withoutTeam', { count: withoutTeam.length })}
            </p>
          </div>
          {teams.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setDialog({ kind: 'new' })}>
              {t('placeThem')}
            </Button>
          )}
        </div>
      )}

      {(dialog?.kind === 'new' || dialog?.kind === 'add') && (
        <PickPeopleDialog
          people={active}
          team={dialog.kind === 'add' ? dialog.team : null}
          existing={teams}
          onClose={close}
        />
      )}
      {dialog?.kind === 'rename' && (
        <RenameDialog team={dialog.team} existing={teams} onClose={close} />
      )}
      <RemoveTeam team={dialog?.kind === 'remove' ? dialog.team : null} onClose={close} />
    </div>
  );
}

/** Up to five initials, then "+n". */
function Faces({ people }: { people: DirectoryPerson[] }) {
  const shown = people.slice(0, 5);
  return (
    <span className="flex items-center" aria-hidden>
      {shown.map((p) => (
        <span
          key={p.id}
          title={p.displayName}
          className="-ml-1.5 grid size-7 place-items-center rounded-full border-2 border-card bg-muted text-[10px] font-semibold first:ml-0"
        >
          {initials(p.displayName)}
        </span>
      ))}
      {people.length > shown.length && (
        <span className="ml-1.5 text-xs text-muted-foreground">
          +{people.length - shown.length}
        </span>
      )}
    </span>
  );
}

/** A new team (name + people), or more people for a team. */
function PickPeopleDialog({
  people,
  team,
  existing,
  onClose,
}: {
  people: DirectoryPerson[];
  /** null = a new team */
  team: string | null;
  existing: string[];
  onClose: () => void;
}) {
  const t = useTranslations('admin.teamsTab');
  const apply = useApplyChanges();
  const id = useId();
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const q = useDeferredValue(search.trim().toLowerCase());
  const candidates = people.filter(
    (p) =>
      (team === null || p.department !== team) &&
      (!q || `${p.displayName} ${p.department ?? ''}`.toLowerCase().includes(q)),
  );
  const target = team ?? name.trim();
  const clash = team === null && existing.includes(target);
  const toggle = (personId: string) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{team ? t('addTitle', { team }) : t('newTitle')}</DialogTitle>
          <DialogDescription>{t('pickHint')}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            apply
              .mutateAsync([...picked].map((personId) => ({ personId, department: target })))
              .then(
                () => {
                  toast.success(t('saved', { team: target, count: picked.size }));
                  onClose();
                },
                (error: unknown) => toast.error(errorText(error)),
              );
          }}
        >
          {team === null && (
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-name`}>{t('name')}</Label>
              <Input
                id={`${id}-name`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                required
                placeholder={t('namePlaceholder')}
              />
              {clash && <p className="text-xs text-muted-foreground">{t('exists')}</p>}
            </div>
          )}
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPeople')}
            aria-label={t('searchPeople')}
          />
          <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
            {candidates.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={picked.has(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                  <span className="min-w-0 flex-1 truncate">{p.displayName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {p.department ?? t('noTeam')}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <DialogFooter className="mt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={!target || picked.size === 0 || apply.isPending}>
              {t('putIn', { count: picked.size })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({
  team,
  existing,
  onClose,
}: {
  team: string;
  existing: string[];
  onClose: () => void;
}) {
  const t = useTranslations('admin.teamsTab');
  const rename = useRenameTeam();
  const id = useId();
  const [name, setName] = useState(team);
  const clash = name.trim() !== team && existing.includes(name.trim());
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('renameTitle', { team })}</DialogTitle>
          <DialogDescription>{t('renameHint')}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            rename.mutateAsync({ from: team, to: name.trim() }).then(
              () => {
                toast.success(t('renamed', { team: name.trim() }));
                onClose();
              },
              (error: unknown) => toast.error(errorText(error)),
            );
          }}
        >
          <Label htmlFor={`${id}-name`} className="sr-only">
            {t('name')}
          </Label>
          <Input
            id={`${id}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            required
          />
          {clash && <p className="text-xs text-muted-foreground">{t('exists')}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={!name.trim() || clash || rename.isPending}>
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RemoveTeam({ team, onClose }: { team: string | null; onClose: () => void }) {
  const t = useTranslations('admin.teamsTab');
  const rename = useRenameTeam();
  return (
    <AlertDialog open={!!team} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogTitle>{t('removeTitle', { team: team ?? '' })}</AlertDialogTitle>
        <AlertDialogDescription>{t('removeBody')}</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              team &&
              rename.mutateAsync({ from: team, to: null }).then(
                () => toast.success(t('removed', { team })),
                (error: unknown) => toast.error(errorText(error)),
              )
            }
          >
            {t('remove')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
