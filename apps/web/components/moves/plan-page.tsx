'use client';

import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronDown,
  Map as MapIcon,
  Pencil,
  Printer,
  TriangleAlert,
  Undo2,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { CommitInput } from '@/components/editor/commit-input';
import { PageFrame } from '@/components/common/page-frame';
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
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { zurichTomorrow } from '@/lib/moves';
import { useMovePlan, useMovePlanActions, useOverview, useStats } from '@/lib/queries';
import type { MoveItem, MovePlanDetail, PlanSeatRef } from '@/lib/types';
import { PlanStatus } from './plan-status';

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
const NONE = '__none__';

/** One move plan: its moves, what would go wrong, and schedule / apply. */
export function PlanPage({ id }: { id: string }) {
  const t = useTranslations('moves');
  const plan = useMovePlan(id);
  const actions = useMovePlanActions(id);
  const [dialog, setDialog] = useState<'team' | 'schedule' | 'apply' | null>(null);
  const [renaming, setRenaming] = useState(false);
  const run = (p: Promise<unknown>, success?: string) =>
    p.then(
      () => success && toast.success(success),
      (error: unknown) => toast.error(errorText(error)),
    );

  if (plan.isError)
    return (
      <PageFrame title={t('title')}>
        <p className="text-sm text-muted-foreground">{t('notFound')}</p>
      </PageFrame>
    );
  const p = plan.data;
  if (!p)
    return (
      <PageFrame title={t('title')}>
        <Skeleton className="h-60" />
      </PageFrame>
    );
  const draft = p.status === 'draft';
  const open = draft || p.status === 'scheduled' || p.status === 'failed';
  const blocked = p.problems.length > 0;
  const canRun = !blocked && p.items.length > 0;

  return (
    <PageFrame
      title={
        <span className="grid gap-1">
          <Link href="/moves" className="text-sm font-normal text-muted-foreground hover:underline">
            {t('title')}
          </Link>
          <span className="flex flex-wrap items-center gap-2">
            {p.name} <PlanStatus status={p.status} effectiveDate={p.effectiveDate} />
          </span>
        </span>
      }
      actions={
        // everything rarely needed sits in one menu; the page itself is two steps
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" aria-label={t('more')}>
              {t('more')} <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {draft && (
              <DropdownMenuItem onSelect={() => setRenaming(true)}>
                <Pencil /> {t('rename')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href={`/moves/${p.id}/print`}>
                <Printer /> {t('list.button')}
              </Link>
            </DropdownMenuItem>
            {open && !draft && (
              <DropdownMenuItem
                onSelect={() => run(actions.unschedule.mutateAsync(), t('backToDraftDone'))}
              >
                <Undo2 /> {t('backToDraft')}
              </DropdownMenuItem>
            )}
            {open && (
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => run(actions.cancel.mutateAsync(), t('cancelled'))}
              >
                <X /> {t('cancelPlan')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      {draft && renaming && (
        <div className="-mt-4 grid max-w-md gap-1.5">
          <Label htmlFor="plan-name-edit" className="text-xs text-muted-foreground">
            {t('planName')}
          </Label>
          <CommitInput
            id="plan-name-edit"
            value={p.name}
            maxLength={200}
            onCommit={(name) =>
              run(actions.update.mutateAsync({ name })).then(() => setRenaming(false))
            }
          />
        </div>
      )}
      {p.status === 'scheduled' && (
        <p className="-mt-4 text-sm text-muted-foreground">{t('scheduledHint')}</p>
      )}
      {p.status === 'failed' && <p className="-mt-4 text-sm text-destructive">{t('failedHint')}</p>}

      {/* step 1: who moves where */}
      <section className="grid gap-3 rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">
            {open ? t('stepWho') : t('movesTitle', { count: p.items.length })}
          </h2>
          {open && (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/map?plan=${p.id}`}>
                  <MapIcon /> {draft ? t('editOnMap') : t('viewOnMap')}
                </Link>
              </Button>
              {draft && (
                <Button variant="outline" size="sm" onClick={() => setDialog('team')}>
                  <Users /> {t('moveTeam')}
                </Button>
              )}
            </div>
          )}
        </div>
        {p.items.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {t('noMoves')}
          </p>
        ) : (
          <ul className="divide-y rounded-lg border" data-testid="plan-moves">
            {p.items.map((item) => (
              <MoveRow
                key={item.personId}
                item={item}
                canRemove={draft}
                onRemove={() => run(actions.removeItem.mutateAsync(item.personId))}
              />
            ))}
          </ul>
        )}
      </section>

      <Problems plan={p} />

      {/* step 2: when */}
      {open && (
        <section className="grid gap-3 rounded-xl border bg-card p-4 sm:p-5">
          <div className="grid gap-1">
            <h2 className="font-semibold">{t('stepWhen')}</h2>
            <p className="text-sm text-muted-foreground">{t('stepWhenHint')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!canRun} onClick={() => setDialog('apply')}>
              <Check /> {t('applyNow')}
            </Button>
            <Button variant="outline" disabled={!canRun} onClick={() => setDialog('schedule')}>
              <CalendarClock /> {p.status === 'scheduled' ? t('reschedule') : t('schedule')}
            </Button>
          </div>
        </section>
      )}

      <TeamDialog
        open={dialog === 'team'}
        onClose={() => setDialog(null)}
        onPlace={(input) =>
          actions.placeTeam.mutateAsync(input).then(
            (r) => {
              setDialog(null);
              if (r.unplaced)
                toast.warning(t('teamPartly', { placed: r.placed ?? 0, unplaced: r.unplaced }));
              else toast.success(t('teamPlaced', { placed: r.placed ?? 0 }));
            },
            (error: unknown) => toast.error(errorText(error)),
          )
        }
      />
      <ScheduleDialog
        open={dialog === 'schedule'}
        current={p.effectiveDate}
        onClose={() => setDialog(null)}
        onSchedule={(date) =>
          actions.schedule.mutateAsync(date).then(
            () => {
              setDialog(null);
              toast.success(t('scheduledDone'));
            },
            (error: unknown) => toast.error(errorText(error)),
          )
        }
      />
      <AlertDialog open={dialog === 'apply'} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>{t('applyTitle', { count: p.items.length })}</AlertDialogTitle>
          <AlertDialogDescription>{t('applyBody')}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => run(actions.apply.mutateAsync(), t('appliedDone'))}>
              {t('applyNow')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageFrame>
  );
}

const seatText = (seat: PlanSeatRef | null, none: string) =>
  seat ? `${seat.label} · ${seat.floor.name}` : none;

function MoveRow({
  item,
  canRemove,
  onRemove,
}: {
  item: MoveItem;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const t = useTranslations('moves');
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
      <span className="min-w-40 flex-1">
        <span className="font-medium">{item.person.displayName}</span>
        {item.person.department && (
          <span className="text-muted-foreground"> · {item.person.department}</span>
        )}
      </span>
      <span className="flex items-center gap-2 tabular-nums">
        <span className="text-muted-foreground">{seatText(item.fromSeat, t('noSeat'))}</span>
        <ArrowRight className="size-3.5 text-muted-foreground" aria-label={t('to')} />
        <span className="font-medium">{seatText(item.toSeat, t('noSeat'))}</span>
      </span>
      {canRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={t('removeMove', { name: item.person.displayName })}
          onClick={onRemove}
        >
          <X />
        </Button>
      )}
    </li>
  );
}

function Problems({ plan }: { plan: MovePlanDetail }) {
  const t = useTranslations('moves');
  if (!plan.problems.length && !plan.notes.length) return null;
  return (
    <div className="grid gap-2" data-testid="plan-problems">
      {plan.problems.length > 0 && (
        <div className="grid gap-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <TriangleAlert className="size-4 text-destructive" /> {t('problemsTitle')}
          </p>
          <ul className="grid list-disc gap-0.5 pl-6">
            {plan.problems.map((x, i) => (
              <li key={i}>
                {t(`problems.${x.code}`, {
                  person: x.personName ?? '?',
                  seat: x.seatLabel ?? '?',
                  by: x.byName ?? '?',
                })}
              </li>
            ))}
          </ul>
        </div>
      )}
      {plan.notes.length > 0 && (
        <ul className="grid list-disc gap-0.5 pl-6 text-sm text-muted-foreground">
          {plan.notes.map((x, i) => (
            <li key={i}>
              {t(`notes.${x.code}`, {
                person: x.personName ?? '?',
                seat: x.seatLabel ?? '?',
                name: x.reservedFor ?? '?',
              })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TeamDialog({
  open,
  onClose,
  onPlace,
}: {
  open: boolean;
  onClose: () => void;
  onPlace: (input: { department: string | null; floorId: string }) => Promise<unknown>;
}) {
  const t = useTranslations('moves');
  const stats = useStats();
  const overview = useOverview();
  const [department, setDepartment] = useState<string | null>(null);
  const [floorId, setFloorId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const floors = (overview.data?.buildings ?? []).flatMap((b) =>
    b.floors.map((f) => ({ ...f, label: `${b.name} › ${f.name}` })),
  );
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>{t('moveTeam')}</DialogTitle>
        <DialogDescription>{t('moveTeamHint')}</DialogDescription>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="team-department">{t('team')}</Label>
            <Select value={department ?? undefined} onValueChange={setDepartment}>
              <SelectTrigger id="team-department" className="w-full">
                <SelectValue placeholder={t('chooseTeam')} />
              </SelectTrigger>
              <SelectContent>
                {(stats.data?.departments ?? []).map((d) => (
                  <SelectItem key={d.name ?? NONE} value={d.name ?? NONE}>
                    {t('teamOption', { name: d.name ?? t('noDepartment'), count: d.people })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="team-floor">{t('toFloor')}</Label>
            <Select value={floorId ?? undefined} onValueChange={setFloorId}>
              <SelectTrigger id="team-floor" className="w-full">
                <SelectValue placeholder={t('chooseFloor')} />
              </SelectTrigger>
              <SelectContent>
                {floors.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {t('floorOption', { name: f.label, free: f.free })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            disabled={!department || !floorId || busy}
            onClick={() => {
              setBusy(true);
              void onPlace({
                department: department === NONE ? null : department,
                floorId: floorId!,
              }).finally(() => setBusy(false));
            }}
          >
            {t('placeTeam')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleDialog({
  open,
  current,
  onClose,
  onSchedule,
}: {
  open: boolean;
  current: string | null;
  onClose: () => void;
  onSchedule: (date: string) => Promise<unknown>;
}) {
  const t = useTranslations('moves');
  const tomorrow = zurichTomorrow();
  const [date, setDate] = useState<string | null>(null);
  const value = date ?? current ?? tomorrow;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle>{t('schedule')}</DialogTitle>
        <DialogDescription>{t('scheduleHint')}</DialogDescription>
        <div className="grid gap-1.5">
          <Label htmlFor="plan-date">{t('moveDay')}</Label>
          <Input
            id="plan-date"
            type="date"
            min={tomorrow}
            value={value}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button disabled={!value || value < tomorrow} onClick={() => void onSchedule(value)}>
            {t('schedule')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
