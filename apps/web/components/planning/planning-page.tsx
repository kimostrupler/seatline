'use client';

import { Armchair, CircleAlert, CircleCheck, Plus, TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageFrame } from '@/components/common/page-frame';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe, usePlanning, useSetTeamPlan } from '@/lib/queries';
import type { SpacePlan } from '@/lib/types';
import { cn } from '@/lib/utils';

type Team = SpacePlan['teams'][number];
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Space planning (editors, admins): each team's people now and expected (after hiring), against
 * the free desks — "we run out of desks in March" before it happens.
 */
export function PlanningPage() {
  const t = useTranslations('planning');
  const me = useMe().data;
  const plan = usePlanning();
  if (me && me.role === 'viewer')
    return (
      <PageFrame title={t('title')}>
        <p className="text-sm text-muted-foreground">{t('onlyEditors')}</p>
      </PageFrame>
    );
  return (
    <PageFrame title={t('title')} wide="medium">
      <p className="-mt-3 text-sm text-muted-foreground">{t('intro')}</p>
      {!plan.data ? <Skeleton className="h-80" /> : <Planning plan={plan.data} />}
    </PageFrame>
  );
}

function Planning({ plan }: { plan: SpacePlan }) {
  const t = useTranslations('planning');
  return (
    <div className="grid gap-8">
      <div className="grid gap-3 sm:grid-cols-3" data-testid="planning-summary">
        <Card icon={Armchair} label={t('freeNow')}>
          {t('freeOf', { free: plan.desks.free, total: plan.desks.total })}
        </Card>
        <Card icon={TrendingUp} label={t('growth')}>
          {plan.growth ? `+${plan.growth}` : '0'}
        </Card>
        <Card
          icon={plan.short ? CircleAlert : CircleCheck}
          label={t('outlook')}
          tone={plan.short ? 'bad' : 'good'}
        >
          {plan.short ? t('short', { count: plan.short }) : t('enough')}
        </Card>
      </div>
      <p className="-mt-4 text-xs text-muted-foreground">
        {t('explain', { needed: plan.needed, free: plan.desks.free })}
      </p>

      <section className="grid gap-3">
        <h2 className="font-semibold">{t('teams')}</h2>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[40rem] text-sm" data-testid="planning-teams">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">{t('columns.team')}</th>
                <th className="px-2 py-2 text-right font-medium">{t('columns.people')}</th>
                <th className="px-2 py-2 text-right font-medium">{t('columns.seated')}</th>
                <th className="px-2 py-2 font-medium">{t('columns.expected')}</th>
                <th className="px-2 py-2 font-medium">{t('columns.by')}</th>
                <th className="px-2 py-2 text-right font-medium">{t('columns.needs')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('columns.zone')}</th>
              </tr>
            </thead>
            <tbody>
              {plan.teams.map((team) => (
                <TeamRow key={team.name ?? ''} team={team} />
              ))}
            </tbody>
          </table>
        </div>
        <AddTeam known={plan.teams.map((x) => x.name ?? '')} />
      </section>

      <section className="grid gap-3">
        <h2 className="font-semibold">{t('floors')}</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {plan.floors.map((f) => (
            <li key={f.id} className="grid gap-1.5 rounded-lg border p-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="truncate">
                  <span className="text-muted-foreground">{f.building} › </span>
                  {f.name}
                </span>
                <span className="shrink-0 tabular-nums">
                  {t('freeOf', { free: f.free, total: f.desks })}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-[var(--seat-free-stroke)]"
                  style={{ width: `${f.desks ? (f.free / f.desks) * 100 : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Card({
  icon: Icon,
  label,
  tone,
  children,
}: {
  icon: typeof Armchair;
  label: string;
  tone?: 'good' | 'bad';
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'grid gap-1 rounded-xl border bg-card p-4',
        tone === 'bad' && 'border-destructive/40 bg-destructive/5',
      )}
    >
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon
          className={cn(
            'size-3.5',
            tone === 'bad' && 'text-destructive',
            tone === 'good' && 'text-[var(--seat-free-stroke)]',
          )}
          aria-hidden
        />
        {label}
      </p>
      <p className="text-2xl font-semibold tabular-nums">{children}</p>
    </div>
  );
}

function TeamRow({ team }: { team: Team }) {
  const t = useTranslations('planning');
  const save = useSetTeamPlan();
  const [count, setCount] = useState(team.target?.toString() ?? '');
  const [by, setBy] = useState(team.byDate ?? '');
  const name = team.name ?? t('noTeam');
  const commit = (nextCount = count, nextBy = by) => {
    if (team.name === null) return;
    const headcount = nextCount.trim() === '' ? null : Math.max(0, Math.round(Number(nextCount)));
    if (headcount !== null && Number.isNaN(headcount)) return;
    if (headcount === team.target && (nextBy || null) === team.byDate) return;
    save
      .mutateAsync({
        team: team.name,
        headcount,
        byDate: headcount === null ? null : nextBy || null,
      })
      .then(
        () => toast.success(t('saved', { team: name })),
        (error: unknown) => toast.error(errorText(error)),
      );
  };
  return (
    <tr className="border-t">
      <td className="px-4 py-2 font-medium">{name}</td>
      <td className="px-2 py-2 text-right tabular-nums">{team.people}</td>
      <td className="px-2 py-2 text-right tabular-nums">{team.seated}</td>
      <td className="px-2 py-1.5">
        {team.name !== null && (
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={count}
            placeholder={String(team.people)}
            onChange={(e) => setCount(e.target.value)}
            onBlur={() => commit()}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
            aria-label={t('expectedOf', { team: name })}
            className="h-8 w-20"
          />
        )}
      </td>
      <td className="px-2 py-1.5">
        {team.name !== null && (
          <Input
            type="date"
            value={by}
            disabled={count.trim() === ''}
            onChange={(e) => {
              setBy(e.target.value);
              commit(count, e.target.value);
            }}
            aria-label={t('byOf', { team: name })}
            className="h-8 w-36"
          />
        )}
      </td>
      <td
        className={cn(
          'px-2 py-2 text-right font-medium tabular-nums',
          team.needed ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {team.needed}
      </td>
      <td className="px-4 py-2 text-right text-muted-foreground tabular-nums">
        {team.zoneDesks ? t('zoneFree', { free: team.zoneFree, total: team.zoneDesks }) : '—'}
      </td>
    </tr>
  );
}

/** A plan for a team that has nobody yet (a new team). */
function AddTeam({ known }: { known: string[] }) {
  const t = useTranslations('planning');
  const save = useSetTeamPlan();
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState('');
  const [count, setCount] = useState('');
  if (!open)
    return (
      <Button variant="outline" className="justify-self-start" onClick={() => setOpen(true)}>
        <Plus /> {t('addTeam')}
      </Button>
    );
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const name = team.trim();
        if (!name || known.includes(name) || count === '') return;
        save.mutateAsync({ team: name, headcount: Math.max(0, Number(count)) }).then(
          () => {
            setOpen(false);
            setTeam('');
            setCount('');
          },
          (error: unknown) => toast.error(errorText(error)),
        );
      }}
    >
      <Input
        value={team}
        onChange={(e) => setTeam(e.target.value)}
        placeholder={t('newTeam')}
        aria-label={t('newTeam')}
        maxLength={100}
        className="w-48"
      />
      <Input
        type="number"
        min={0}
        value={count}
        onChange={(e) => setCount(e.target.value)}
        placeholder={t('columns.expected')}
        aria-label={t('columns.expected')}
        className="w-28"
      />
      <Button type="submit" disabled={!team.trim() || count === '' || save.isPending}>
        {t('add')}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
        {t('cancel')}
      </Button>
    </form>
  );
}
