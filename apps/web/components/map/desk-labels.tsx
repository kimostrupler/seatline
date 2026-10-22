'use client';

import { ArrowLeft, Printer } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFloorMap } from '@/lib/queries';

/** The address a desk's QR code opens: the desk's own page (who sits there, since when). */
export const deskUrl = (origin: string, seatId: string) => `${origin}/desk/${seatId}`;

/** Stickers per A4 sheet: 3 across, 4 down. */
const PER_PAGE = 12;

/**
 * Stickers for the desks of one floor (or one desk with ?seat=): a QR code that opens the desk's
 * page — who sits there, since when — plus its number. Printed 12 per A4 sheet, never split.
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
        const svg = await QRCode.toString(deskUrl(location.origin, s.id), {
          type: 'svg',
          margin: 0,
          errorCorrectionLevel: 'M',
        });
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
      {/* A4 without the browser's margins (and its header/footer lines): each sheet is a
          fixed 3 × 4 grid, so a sticker is never cut between two pages */}
      <style>{'@media print { @page { size: A4; margin: 0 } }'}</style>
      <div className="grid gap-3 print:block" data-testid="desk-labels">
        {pages(seats).map((page, i) => (
          <ul
            key={i}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 print:h-[296mm] print:grid-cols-3 print:grid-rows-[repeat(4,69mm)] print:gap-0 print:overflow-hidden print:p-[10mm] print:break-after-page print:last:break-after-auto"
          >
            {page.map((s) => (
              <li
                key={s.id}
                className="grid break-inside-avoid content-center justify-items-center gap-2 rounded-lg border p-4 text-center print:gap-1 print:rounded-none print:border-dashed print:p-2"
              >
                <div
                  className="size-28 text-foreground [&_svg]:size-full print:size-[38mm]"
                  aria-label={t('codeFor', { label: s.label })}
                  role="img"
                  // generated locally by the qrcode library from our own URL
                  dangerouslySetInnerHTML={{ __html: codes[s.id] ?? '' }}
                />
                <p className="text-2xl font-semibold tabular-nums print:text-[18pt]">{s.label}</p>
                <p className="text-xs text-muted-foreground print:text-[7pt]">
                  {map.floor.building.name} › {map.floor.name}
                </p>
                <p className="text-[11px] text-muted-foreground print:text-[7pt]">{t('scan')}</p>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </main>
  );
}

/** The stickers in sheets of PER_PAGE. */
function pages<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += PER_PAGE) out.push(items.slice(i, i + PER_PAGE));
  return out;
}
