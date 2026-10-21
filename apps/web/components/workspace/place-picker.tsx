'use client';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
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
  onNewBuilding,
  onNewFloor,
}: {
  buildings: Building[];
  floors: Floor[];
  buildingId: string | undefined;
  floorId: string | undefined;
  onBuilding: (id: string) => void;
  onFloor: (id: string) => void;
  /** only for editors */
  onNewBuilding?: () => void;
  onNewFloor?: () => void;
}) {
  const t = useTranslations('place');
  if (buildings.length === 0)
    return <p className="px-1 text-sm text-muted-foreground">{t('noBuildings')}</p>;
  return (
    <div className="grid gap-2">
      <div className="grid gap-1">
        <AddLabel text={t('building')} addLabel={t('newBuilding')} onAdd={onNewBuilding} />
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
      </div>
      <div className="grid gap-1">
        <AddLabel
          text={t('floor')}
          addLabel={t('newFloor')}
          onAdd={buildingId ? onNewFloor : undefined}
        />
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
      </div>
    </div>
  );
}

function AddLabel({
  text,
  addLabel,
  onAdd,
}: {
  text: string;
  addLabel: string;
  onAdd?: () => void;
}) {
  return (
    <span className="flex h-6 items-center justify-between">
      <span className="text-xs font-medium text-muted-foreground">{text}</span>
      {onAdd && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground"
          aria-label={addLabel}
          title={addLabel}
          onClick={(e) => {
            e.preventDefault(); // don't let the surrounding label open the select
            onAdd();
          }}
        >
          <Plus />
        </Button>
      )}
    </span>
  );
}
