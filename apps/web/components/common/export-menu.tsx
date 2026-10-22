'use client';

import { Download, Printer, QrCode } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiDownload } from '@/lib/api';
import { useMe } from '@/lib/queries';

/** Excel/CSV downloads (and printing a floor). Exports are recorded in the activity log. */
export function ExportMenu({
  floorId,
  onPrint,
  onLabels,
  compact,
}: {
  /** limit the seating list to one floor (on the map) */
  floorId?: string;
  onPrint?: () => void;
  /** QR stickers for this floor's desks */
  onLabels?: () => void;
  compact?: boolean;
}) {
  const t = useTranslations('exports');
  const lang = useLocale().slice(0, 2);
  const role = useMe().data?.role;
  const get = (path: string) =>
    apiDownload(`${path}${path.includes('?') ? '&' : '?'}lang=${lang}`).catch((e: unknown) =>
      toast.error(t('failed', { message: e instanceof Error ? e.message : String(e) })),
    );
  const seating = (format: string) =>
    get(`/exports/seating?format=${format}${floorId ? `&floorId=${floorId}` : ''}`);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={compact ? 'icon' : 'default'}
          className={compact ? 'size-8' : undefined}
          aria-label={t('menu')}
        >
          <Download /> {!compact && t('menu')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal text-muted-foreground">
          {floorId ? t('thisFloor') : t('allFloors')}
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => void seating('xlsx')}>
          {t('seatingExcel')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void seating('csv')}>{t('seatingCsv')}</DropdownMenuItem>
        {onPrint && (
          <DropdownMenuItem onSelect={onPrint}>
            <Printer /> {t('print')}
          </DropdownMenuItem>
        )}
        {onLabels && (
          <DropdownMenuItem onSelect={onLabels}>
            <QrCode /> {t('labels')}
          </DropdownMenuItem>
        )}
        {role && role !== 'viewer' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void get('/exports/history?format=xlsx')}>
              {t('historyExcel')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
