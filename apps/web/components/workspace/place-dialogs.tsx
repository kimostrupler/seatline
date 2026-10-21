'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateBuilding, useCreateFloor, useUpdateFloor } from '@/lib/queries';
import type { Building, Floor } from '@/lib/types';

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

function FormDialog({
  open,
  onOpenChange,
  title,
  submitLabel,
  busy,
  onSubmit,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  submitLabel: string;
  busy: boolean;
  onSubmit: () => void;
  children: ReactNode;
}) {
  const t = useTranslations('place');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle>{title}</DialogTitle>
        <form
          className="grid gap-4"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          {children}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={busy}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TextField({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & React.ComponentProps<typeof Input>) {
  const id = props.id ?? label;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function CreateBuildingDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (building: Building) => void;
}) {
  const t = useTranslations('place');
  const create = useCreateBuilding();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('newBuilding')}
      submitLabel={t('create')}
      busy={create.isPending || !name.trim()}
      onSubmit={() =>
        create
          .mutateAsync({
            name: name.trim(),
            ...(address.trim() ? { address: address.trim() } : {}),
          })
          .then(
            (building) => {
              toast.success(t('created', { name: building.name }));
              setName('');
              setAddress('');
              onOpenChange(false);
              onCreated(building);
            },
            (error: unknown) => toast.error(errorText(error)),
          )
      }
    >
      <TextField
        label={t('buildingName')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={200}
        required
      />
      <TextField
        label={t('buildingAddress')}
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        maxLength={500}
      />
    </FormDialog>
  );
}

export function CreateFloorDialog({
  open,
  onOpenChange,
  buildingId,
  floors,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buildingId: string;
  floors: Floor[];
  onCreated: (floor: Floor) => void;
}) {
  const t = useTranslations('place');
  const create = useCreateFloor();
  const nextLevel = floors.length ? Math.max(...floors.map((f) => f.level)) + 1 : 0;
  const [name, setName] = useState('');
  const [level, setLevel] = useState<string | null>(null);
  const levelValue = level ?? String(nextLevel);
  const valid = name.trim() && Number.isInteger(Number(levelValue));
  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setLevel(null);
        onOpenChange(o);
      }}
      title={t('newFloor')}
      submitLabel={t('create')}
      busy={create.isPending || !valid}
      onSubmit={() =>
        create.mutateAsync({ buildingId, name: name.trim(), level: Number(levelValue) }).then(
          (floor) => {
            toast.success(t('created', { name: floor.name }));
            setName('');
            setLevel(null);
            onOpenChange(false);
            onCreated(floor);
          },
          (error: unknown) => toast.error(errorText(error)),
        )
      }
    >
      <TextField
        label={t('floorName')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={200}
        required
      />
      <TextField
        label={t('floorLevel')}
        hint={t('floorLevelHint')}
        inputMode="numeric"
        value={levelValue}
        onChange={(e) => setLevel(e.target.value)}
      />
    </FormDialog>
  );
}

/** After measuring a line with the ruler: how long is it really? Sets the floor's scale. */
export function ScaleDialog({
  floorId,
  units,
  onClose,
}: {
  floorId: string;
  units: number | null;
  onClose: () => void;
}) {
  const t = useTranslations('inspector');
  const update = useUpdateFloor();
  const [meters, setMeters] = useState('');
  const value = Number(meters.replace(',', '.'));
  return (
    <FormDialog
      open={units !== null}
      onOpenChange={(o) => !o && onClose()}
      title={t('scaleDialogTitle')}
      submitLabel={t('setScale')}
      busy={update.isPending || !(value > 0)}
      onSubmit={() =>
        update.mutateAsync({ id: floorId, scale: units! / value }).then(
          () => {
            setMeters('');
            onClose();
          },
          (error: unknown) => toast.error(errorText(error)),
        )
      }
    >
      <p className="text-sm text-muted-foreground">
        {t('scaleDialogBody', { units: Math.round(units ?? 0) })}
      </p>
      <TextField
        label={t('meters')}
        inputMode="decimal"
        value={meters}
        onChange={(e) => setMeters(e.target.value)}
      />
    </FormDialog>
  );
}
