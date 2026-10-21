'use client';

import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Building, Floor } from '@/lib/types';

export function PlacePicker({
  buildings,
  floors,
  buildingId,
  floorId,
  onBuilding,
  onFloor,
}: {
  buildings: Building[];
  floors: Floor[];
  buildingId: string | undefined;
  floorId: string | undefined;
  onBuilding: (id: string) => void;
  onFloor: (id: string) => void;
}) {
  const t = useTranslations('place');
  if (buildings.length === 0)
    return <p className="px-1 text-sm text-muted-foreground">{t('noBuildings')}</p>;
  return (
    <div className="grid gap-2">
      <label className="grid gap-1">
        <span className="text-xs font-medium text-muted-foreground">{t('building')}</span>
        <Select value={buildingId} onValueChange={onBuilding}>
          <SelectTrigger className="w-full" aria-label={t('building')}>
            <SelectValue placeholder={t('chooseBuilding')} />
          </SelectTrigger>
          <SelectContent>
            {buildings.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <label className="grid gap-1">
        <span className="text-xs font-medium text-muted-foreground">{t('floor')}</span>
        {floors.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noFloors')}</p>
        ) : (
          <Select value={floorId} onValueChange={onFloor}>
            <SelectTrigger className="w-full" aria-label={t('floor')} data-testid="floor-select">
              <SelectValue placeholder={t('chooseFloor')} />
            </SelectTrigger>
            <SelectContent>
              {floors.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </label>
    </div>
  );
}
