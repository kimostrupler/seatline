'use client';

import { ArrowLeft, Printer } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFloorMap } from '@/lib/queries';

/** The address a desk's QR code opens: the map with that desk selected. */
export const deskUrl = (origin: string, buildingId: string, floorId: string, seatId: string) =>
  `${origin}/map?building=${buildingId}&floor=${floorId}&seat=${seatId}`;

/**
 * Stickers for the desks of one floor (or one desk with ?seat=): a QR code that opens the desk
 * on the map — who sits there, since when — plus its number. Print on A4 and cut.
 */
export function DeskLabels() {
  const t = useTranslations('qr');
  const params = useSearchParams();
  const floorId = params.get('floor') ?? undefined;
  const only = params.get('seat');
  const map = useFloorMap(floorId).data;
  const [codes, setCodes] = useState<Record<string, string>>({});

  const seats = (map?.seats ?? [])
    .filter((s) => !only || s.id === only)
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

  useEffect(() => {
    if (!map) return;
    let live = true;
    void Promise.all(
      map.seats.map(async (s) => {
        const svg = await QRCode.toString(
          deskUrl(location.origin, map.floor.buildingId, map.floor.id, s.id),
          { type: 'svg', margin: 0, errorCorrectionLevel: 'M' },
        );
        return [s.id, svg] as const;
      }),
    ).then((pairs) => live && setCodes(Object.fromEntries(pairs)));
    return () => {
      live = false;
    };
  }, [map]);

  if (!map) return <Skeleton className="m-6 h-96" />;
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
      <header className="grid gap-1 print:hidden">
        <h1 className="text-xl font-semibold">
          {t('title', { place: `${map.floor.building.name} › ${map.floor.name}` })}
        </h1>
        <p className="text-sm text-muted-foreground">{t('body', { count: seats.length })}</p>
      </header>
      <ul
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-3 print:gap-0"
        data-testid="desk-labels"
      >
        {seats.map((s) => (
          <li
            key={s.id}
            className="grid break-inside-avoid justify-items-center gap-2 rounded-lg border p-4 text-center print:rounded-none print:border-dashed"
          >
            <div
              className="size-28 text-foreground [&_svg]:size-full print:size-32"
              aria-label={t('codeFor', { label: s.label })}
              role="img"
              // generated locally by the qrcode library from our own URL
              dangerouslySetInnerHTML={{ __html: codes[s.id] ?? '' }}
            />
            <p className="text-2xl font-semibold tabular-nums">{s.label}</p>
            <p className="text-xs text-muted-foreground">
              {map.floor.building.name} › {map.floor.name}
            </p>
            <p className="text-[11px] text-muted-foreground">{t('scan')}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
