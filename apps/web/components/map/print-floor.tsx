'use client';

import dynamic from 'next/dynamic';
import { ArrowLeft, Printer } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFloorMap } from '@/lib/queries';

const FloorMap = dynamic(() => import('./floor-map').then((m) => m.FloorMap), { ssr: false });

/** One floor on paper: the map plus who sits where. Print or "Save as PDF" in the browser. */
export function PrintFloor() {
  const t = useTranslations('exports');
  const ts = useTranslations('status');
  const format = useFormatter();
  const now = useNow();
  const floorId = useSearchParams().get('floor') ?? undefined;
  const map = useFloorMap(floorId).data;
  if (!map) return <Skeleton className="m-6 h-96" />;
  const seats = [...map.seats].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true }),
  );
  return (
    <main className="mx-auto grid max-w-5xl gap-4 p-6 print:max-w-none print:p-0">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" onClick={() => history.back()}>
          <ArrowLeft /> {t('back')}
        </Button>
        <Button onClick={() => window.print()}>
          <Printer /> {t('printNow')}
        </Button>
      </div>
      <header>
        <h1 className="text-xl font-semibold">
          {map.floor.building.name} › {map.floor.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('asOf', { date: format.dateTime(now, { dateStyle: 'long' }) })}
        </p>
      </header>
      <div className="relative h-[60vh] min-h-96 overflow-hidden rounded-lg border print:h-[14cm] print:rounded-none [&_[data-print=hide]]:print:hidden">
        <FloorMap
          map={map}
          selectedSeatId={null}
          highlightSeatId={null}
          canEdit={false}
          planOpacity={0.6}
          onSelectSeat={() => {}}
          onDropPerson={() => {}}
          onMoveSeat={() => {}}
        />
      </div>
      <table className="w-full text-sm print:text-xs">
        <thead className="text-left text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="py-1 pr-4 font-medium">{t('seat')}</th>
            <th className="py-1 pr-4 font-medium">{t('person')}</th>
            <th className="py-1 font-medium">{t('department')}</th>
          </tr>
        </thead>
        <tbody>
          {seats.map((s) => {
            const a = s.currentAssignment;
            return (
              <tr key={s.id} className="border-b break-inside-avoid">
                <td className="py-1 pr-4 tabular-nums">{s.label}</td>
                <td className="py-1 pr-4">
                  {a?.person?.displayName ??
                    (a?.kind === 'reserved'
                      ? `${ts('reserved')}: ${a.reservedFor ?? ''}`
                      : ts(s.occupancy))}
                </td>
                <td className="py-1">{a?.person?.department ?? ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
