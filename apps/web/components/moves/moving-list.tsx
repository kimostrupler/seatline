'use client';

import { ArrowLeft, Printer } from 'lucide-react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useBuildings, useMovePlan } from '@/lib/queries';
import type { MoveItem, PlanSeatRef } from '@/lib/types';

/**
 * A move plan on paper for the people who carry the boxes: who moves from which desk to which,
 * sorted by where they start, with a tick box per move. Print or "Save as PDF".
 */
export function MovingList({ id }: { id: string }) {
  const t = useTranslations('moves.list');
  const tm = useTranslations('moves');
  const format = useFormatter();
  const now = useNow();
  const plan = useMovePlan(id).data;
  const buildings = useBuildings().data ?? [];
  if (!plan) return <Skeleton className="m-6 h-96" />;

  const building = (s: PlanSeatRef) => buildings.find((b) => b.id === s.floor.buildingId)?.name;
  const place = (s: PlanSeatRef | null) =>
    s ? [building(s), s.floor.name].filter(Boolean).join(' › ') : '';
  const key = (m: MoveItem) =>
    `${place(m.fromSeat) || '~'} ${m.fromSeat?.label ?? ''} ${m.person.displayName}`;
  const moves = [...plan.items].sort((a, b) =>
    key(a).localeCompare(key(b), undefined, { numeric: true }),
  );
  const day = plan.appliedAt
    ? format.dateTime(new Date(plan.appliedAt), { dateStyle: 'long' })
    : plan.effectiveDate
      ? format.dateTime(new Date(`${plan.effectiveDate}T12:00:00Z`), { dateStyle: 'long' })
      : null;

  return (
    <main className="mx-auto grid max-w-4xl gap-5 p-6 print:max-w-none print:p-0">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" onClick={() => history.back()}>
          <ArrowLeft /> {t('back')}
        </Button>
        <Button onClick={() => window.print()}>
          <Printer /> {t('print')}
        </Button>
      </div>
      <header className="grid gap-1">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">{t('kicker')}</p>
        <h1 className="text-2xl font-semibold">{plan.name}</h1>
        <p className="text-sm text-muted-foreground">
          {[
            day ? t('day', { day }) : t('noDay'),
            tm('movesTitle', { count: moves.length }),
            t('asOf', { date: format.dateTime(now, { dateStyle: 'medium', timeStyle: 'short' }) }),
          ].join(' · ')}
        </p>
        {plan.note && <p className="text-sm">{plan.note}</p>}
      </header>
      <table className="w-full border-collapse text-sm print:text-xs" data-testid="moving-list">
        <thead className="text-left text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="w-8 py-2 pr-2 font-medium">
              <span className="sr-only">{t('done')}</span>
            </th>
            <th className="py-2 pr-4 font-medium">{t('person')}</th>
            <th className="py-2 pr-4 font-medium">{t('from')}</th>
            <th className="py-2 font-medium">{t('to')}</th>
          </tr>
        </thead>
        <tbody>
          {moves.map((m) => (
            <tr key={m.personId} className="border-b align-top break-inside-avoid">
              <td className="py-2.5 pr-2">
                <span
                  aria-hidden
                  className="inline-block size-4 rounded-sm border border-foreground/50"
                />
              </td>
              <td className="py-2.5 pr-4">
                <p className="font-medium">{m.person.displayName}</p>
                {m.person.department && (
                  <p className="text-xs text-muted-foreground">{m.person.department}</p>
                )}
              </td>
              <td className="py-2.5 pr-4">
                {m.fromSeat ? (
                  <>
                    <p className="font-medium tabular-nums">{m.fromSeat.label}</p>
                    <p className="text-xs text-muted-foreground">{place(m.fromSeat)}</p>
                  </>
                ) : (
                  <p className="text-muted-foreground">{t('newDesk')}</p>
                )}
              </td>
              <td className="py-2.5">
                {m.toSeat ? (
                  <>
                    <p className="font-medium tabular-nums">{m.toSeat.label}</p>
                    <p className="text-xs text-muted-foreground">{place(m.toSeat)}</p>
                  </>
                ) : (
                  <p className="text-muted-foreground">{t('givesUp')}</p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <footer className="mt-6 grid grid-cols-2 gap-8 text-xs text-muted-foreground">
        <p className="border-t pt-2">{t('signedMovers')}</p>
        <p className="border-t pt-2">{t('signedFacility')}</p>
      </footer>
    </main>
  );
}
