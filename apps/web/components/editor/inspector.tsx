'use client';

import { polygonArea, ROOM_TYPES, SEAT_TYPES } from '@seatline/shared';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  ArrowDown,
  ArrowRight,
  ClipboardCopy,
  Copy,
  ImageOff,
  RotateCcw,
  RotateCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  alignSeats,
  changes,
  deleteSelection,
  distributeSeats,
  duplicateSelection,
  polygonBounds,
  resizePolygon,
  rotateSeats,
  seatRow,
  type Align,
} from '@/lib/editor/ops';
import { NO_SELECTION, type LayoutEditorState } from '@/lib/editor/use-layout-editor';
import { SEAT_H, SEAT_W } from '@/lib/map-geometry';
import {
  useDeleteBuilding,
  useDeleteFloor,
  useRemovePlan,
  useUpdateBuilding,
  useUpdateFloor,
  useUploadPlan,
} from '@/lib/queries';
import type { Building, FloorMap, Room, Seat } from '@/lib/types';
import { platformKeys } from '@/lib/platform-keys';
import { usePlanOpacity } from '@/lib/use-plan-opacity';
import { CommitInput } from './commit-input';
import type { ClipboardActions } from './use-clipboard';

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function Inspector({
  map,
  building,
  editor,
  clipboard,
  onFloorDeleted,
  onBuildingDeleted,
}: {
  map: FloorMap;
  building: Building | undefined;
  editor: LayoutEditorState;
  clipboard: ClipboardActions;
  onFloorDeleted: () => void;
  onBuildingDeleted: () => void;
}) {
  const { doc, selection } = editor;
  const seats = doc.seats.filter((s) => selection.seats.includes(s.id));
  const rooms = doc.rooms.filter((r) => selection.rooms.includes(r.id));

  if (!seats.length && !rooms.length)
    return (
      <FloorSettings
        map={map}
        building={building}
        onFloorDeleted={onFloorDeleted}
        onBuildingDeleted={onBuildingDeleted}
      />
    );
  return (
    <div className="grid gap-4" data-testid="inspector">
      {seats.length === 1 && rooms.length === 0 ? (
        <SeatForm key={seats[0]!.id} seat={seats[0]!} editor={editor} level={map.floor.level} />
      ) : rooms.length === 1 && seats.length === 0 ? (
        <RoomForm key={rooms[0]!.id} room={rooms[0]!} editor={editor} scale={map.floor.scale} />
      ) : (
        <MultiForm seats={seats} rooms={rooms} editor={editor} />
      )}
      <Separator />
      <SelectionActions editor={editor} level={map.floor.level} clipboard={clipboard} />
    </div>
  );
}

/** A labelled group. The controls inside carry their own aria-label. */
function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="grid gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SeatForm({
  seat,
  editor,
  level,
}: {
  seat: Seat;
  editor: LayoutEditorState;
  level: number;
}) {
  const t = useTranslations('inspector');
  const room = editor.doc.rooms.find((r) => r.id === seat.roomId);
  const update = (data: Partial<Pick<Seat, 'label' | 'type' | 'status' | 'rotation'>>) =>
    editor.commit(changes({ seats: { update: [{ id: seat.id, ...data }] } }));
  const occupied = !!seat.currentAssignment;

  return (
    <div className="grid gap-4">
      <h2 className="text-lg font-semibold">
        {t('seat')} {seat.label}
      </h2>
      <Field label={t('label')}>
        <CommitInput
          aria-label={t('label')}
          value={seat.label}
          maxLength={50}
          onCommit={(label) => update({ label })}
        />
      </Field>
      <Field label={t('type')}>
        <Select value={seat.type} onValueChange={(v) => update({ type: v as Seat['type'] })}>
          <SelectTrigger className="w-full" aria-label={t('type')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SEAT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {t(`seatType.${type}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label={t('rotation')}>
        <RotateButtons
          editor={editor}
          seatIds={[seat.id]}
          value={`${Math.round(seat.rotation)}°`}
        />
      </Field>
      <BlockSwitch editor={editor} seats={[seat]} />
      <Field label={t('inRoom')}>
        <p className="text-sm">{room?.name ?? t('noRoom')}</p>
      </Field>
      <SeatRowField seat={seat} editor={editor} level={level} />
    </div>
  );
}

/** "Add 3 more desks to the right / below" — quick rows of desks. */
function SeatRowField({
  seat,
  editor,
  level,
}: {
  seat: Seat;
  editor: LayoutEditorState;
  level: number;
}) {
  const t = useTranslations('inspector');
  const [count, setCount] = useState('3');
  const n = Math.min(50, Math.max(1, Math.floor(Number(count)) || 1));
  const add = (direction: 'right' | 'down') => {
    const { changes: c, selection } = seatRow(
      editor.doc,
      seat,
      n,
      direction,
      level,
      { width: SEAT_W, height: SEAT_H, gap: 28 },
      () => crypto.randomUUID(),
    );
    editor.commit(c);
    editor.setSelection(selection);
  };
  return (
    <Field label={t('addRow')} hint={t('addRowHint')}>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={50}
          className="w-20"
          aria-label={t('rowCount')}
          value={count}
          onChange={(e) => setCount(e.target.value)}
        />
        <Button variant="outline" onClick={() => add('right')}>
          <ArrowRight /> {t('toTheRight')}
        </Button>
        <Button variant="outline" onClick={() => add('down')}>
          <ArrowDown /> {t('below')}
        </Button>
      </div>
    </Field>
  );
}

function RoomForm({
  room,
  editor,
  scale,
}: {
  room: Room;
  editor: LayoutEditorState;
  scale: number | null;
}) {
  const t = useTranslations('inspector');
  const update = (data: Partial<Pick<Room, 'name' | 'type'>>) =>
    editor.commit(changes({ rooms: { update: [{ id: room.id, ...data }] } }));
  return (
    <div className="grid gap-4">
      <h2 className="text-lg font-semibold">{room.name}</h2>
      <Field label={t('name')}>
        <CommitInput
          aria-label={t('name')}
          value={room.name}
          maxLength={200}
          onCommit={(name) => update({ name })}
        />
      </Field>
      <Field label={t('type')}>
        <Select value={room.type} onValueChange={(v) => update({ type: v as Room['type'] })}>
          <SelectTrigger className="w-full" aria-label={t('type')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROOM_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {t(`roomType.${type}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <RoomSize room={room} editor={editor} scale={scale} />
      {scale && (
        <Field label={t('area')}>
          <p className="text-sm tabular-nums">
            {t('areaValue', { value: (polygonArea(room.polygon) / (scale * scale)).toFixed(1) })}
          </p>
        </Field>
      )}
    </div>
  );
}

/** Width × height of the room's outline, in metres once the floor has a scale. */
function RoomSize({
  room,
  editor,
  scale,
}: {
  room: Room;
  editor: LayoutEditorState;
  scale: number | null;
}) {
  const t = useTranslations('inspector');
  const unit = scale ?? 1;
  const b = polygonBounds(room.polygon);
  const show = (v: number) => String(Math.round((v / unit) * 100) / 100);
  const set = (axis: 'width' | 'height', text: string) => {
    const v = Number(text.replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0) return;
    const size = { width: b.width, height: b.height, [axis]: v * unit };
    editor.commit(
      changes({
        rooms: {
          update: [{ id: room.id, polygon: resizePolygon(room.polygon, size.width, size.height) }],
        },
      }),
    );
  };
  return (
    <Field label={scale ? t('sizeMetres') : t('sizeUnits')} hint={t('sizeHint')}>
      <div className="flex items-center gap-2">
        <CommitInput
          aria-label={t('width')}
          inputMode="decimal"
          value={show(b.width)}
          onCommit={(v) => set('width', v)}
        />
        <span className="text-muted-foreground">×</span>
        <CommitInput
          aria-label={t('height')}
          inputMode="decimal"
          value={show(b.height)}
          onCommit={(v) => set('height', v)}
        />
      </div>
    </Field>
  );
}

const ALIGN: Array<{ how: Align; icon: typeof AlignStartVertical }> = [
  { how: 'left', icon: AlignStartVertical },
  { how: 'centerX', icon: AlignCenterVertical },
  { how: 'right', icon: AlignEndVertical },
  { how: 'top', icon: AlignStartHorizontal },
  { how: 'middle', icon: AlignCenterHorizontal },
  { how: 'bottom', icon: AlignEndHorizontal },
];

/** Line up and evenly space several seats. */
function ArrangeButtons({ editor, seatIds }: { editor: LayoutEditorState; seatIds: string[] }) {
  const t = useTranslations('inspector');
  const icon = (
    label: string,
    onClick: () => void,
    Icon: typeof AlignStartVertical,
    off = false,
  ) => (
    <Button
      key={label}
      variant="outline"
      size="icon"
      aria-label={label}
      title={label}
      disabled={off}
      onClick={onClick}
    >
      <Icon />
    </Button>
  );
  return (
    <Field label={t('arrange')}>
      <div className="flex flex-wrap gap-1.5">
        {ALIGN.map(({ how, icon: Icon }) =>
          icon(t(`align.${how}`), () => editor.commit(alignSeats(editor.doc, seatIds, how)), Icon),
        )}
        {icon(
          t('distributeX'),
          () => editor.commit(distributeSeats(editor.doc, seatIds, 'x')),
          AlignHorizontalDistributeCenter,
          seatIds.length < 3,
        )}
        {icon(
          t('distributeY'),
          () => editor.commit(distributeSeats(editor.doc, seatIds, 'y')),
          AlignVerticalDistributeCenter,
          seatIds.length < 3,
        )}
      </div>
    </Field>
  );
}

function MultiForm({
  seats,
  rooms,
  editor,
}: {
  seats: Seat[];
  rooms: Room[];
  editor: LayoutEditorState;
}) {
  const t = useTranslations('inspector');
  const title =
    rooms.length === 0
      ? t('seats', { count: seats.length })
      : seats.length === 0
        ? t('rooms', { count: rooms.length })
        : t('items', { count: seats.length + rooms.length });
  return (
    <div className="grid gap-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {seats.length > 0 && (
        <>
          {seats.length > 1 && <ArrangeButtons editor={editor} seatIds={seats.map((s) => s.id)} />}
          <Field label={t('rotation')}>
            <RotateButtons editor={editor} seatIds={seats.map((s) => s.id)} />
          </Field>
          <BlockSwitch editor={editor} seats={seats} />
        </>
      )}
    </div>
  );
}

function RotateButtons({
  editor,
  seatIds,
  value,
}: {
  editor: LayoutEditorState;
  seatIds: string[];
  value?: string;
}) {
  const t = useTranslations('inspector');
  const rotate = (deg: number) => editor.commit(rotateSeats(editor.doc, seatIds, deg));
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        aria-label={t('rotateLeft')}
        onClick={() => rotate(-90)}
      >
        <RotateCcw />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label={t('rotateRight')}
        onClick={() => rotate(90)}
      >
        <RotateCw />
      </Button>
      {value && <span className="text-sm tabular-nums text-muted-foreground">{value}</span>}
    </div>
  );
}

function BlockSwitch({ editor, seats }: { editor: LayoutEditorState; seats: Seat[] }) {
  const t = useTranslations('inspector');
  const id = useId();
  const occupied = seats.some((s) => s.currentAssignment);
  const blocked = seats.every((s) => s.status === 'blocked');
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{t('blocked')}</Label>
        <Switch
          id={id}
          checked={blocked}
          disabled={occupied}
          onCheckedChange={(on) =>
            editor.commit(
              changes({
                seats: {
                  update: seats.map((s) => ({
                    id: s.id,
                    status: on ? ('blocked' as const) : ('active' as const),
                  })),
                },
              }),
            )
          }
        />
      </div>
      <p className="text-xs text-muted-foreground">{occupied ? t('occupied') : t('blockedHint')}</p>
    </div>
  );
}

function SelectionActions({
  editor,
  level,
  clipboard,
}: {
  editor: LayoutEditorState;
  level: number;
  clipboard: ClipboardActions;
}) {
  const t = useTranslations('inspector');
  const te = useTranslations('editor');
  const occupied = editor.doc.seats.filter(
    (s) => editor.selection.seats.includes(s.id) && s.currentAssignment,
  );
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        onClick={() => {
          const { changes: c, selection } = duplicateSelection(
            editor.doc,
            editor.selection,
            level,
            SEAT_W + 16,
            0,
            () => crypto.randomUUID(),
            (name) => te('copy', { name }),
          );
          editor.commit(c);
          editor.setSelection(selection);
        }}
      >
        <Copy /> {platformKeys(t('duplicate'))}
      </Button>
      <Button variant="outline" onClick={() => clipboard.copy() && toast(te('copied'))}>
        <ClipboardCopy /> {platformKeys(t('copy'))}
      </Button>
      <Button
        variant="outline"
        className="text-destructive"
        onClick={() => {
          if (occupied.length) {
            toast.error(te('freeFirst', { labels: occupied.map((s) => s.label).join(', ') }));
            return;
          }
          editor.commit(deleteSelection(editor.selection));
          editor.setSelection(NO_SELECTION);
        }}
      >
        <Trash2 /> {platformKeys(t('deleteSelection'))}
      </Button>
    </div>
  );
}

function FloorSettings({
  map,
  building,
  onFloorDeleted,
  onBuildingDeleted,
}: {
  map: FloorMap;
  building: Building | undefined;
  onFloorDeleted: () => void;
  onBuildingDeleted: () => void;
}) {
  const t = useTranslations('inspector');
  const floor = map.floor;
  const updateFloor = useUpdateFloor();
  const deleteFloor = useDeleteFloor();
  const upload = useUploadPlan();
  const removePlan = useRemovePlan();
  const updateBuilding = useUpdateBuilding();
  const deleteBuilding = useDeleteBuilding();
  const [opacity, setOpacity] = usePlanOpacity();
  const fileInput = useRef<HTMLInputElement>(null);

  const run = (promise: Promise<unknown>, success?: string) =>
    promise.then(
      () => success && toast.success(success),
      (error: unknown) => toast.error(errorText(error)),
    );

  return (
    <div className="grid gap-4" data-testid="floor-settings">
      <h2 className="text-lg font-semibold">{t('floor')}</h2>
      <Field label={t('name')}>
        <CommitInput
          aria-label={t('name')}
          value={floor.name}
          maxLength={200}
          onCommit={(name) => run(updateFloor.mutateAsync({ id: floor.id, name }))}
        />
      </Field>
      <Field label={t('level')}>
        <CommitInput
          aria-label={t('level')}
          inputMode="numeric"
          value={String(floor.level)}
          onCommit={(v) => {
            const level = Number(v);
            if (Number.isInteger(level)) void run(updateFloor.mutateAsync({ id: floor.id, level }));
          }}
        />
      </Field>

      <Field label={t('plan')} hint={t('planHint')}>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            data-testid="plan-file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file)
                void run(upload.mutateAsync({ floorId: floor.id, file }), t('planUploaded'));
            }}
          />
          <Button
            variant="outline"
            disabled={upload.isPending}
            onClick={() => fileInput.current?.click()}
          >
            <Upload /> {floor.planFileKey ? t('replacePlan') : t('uploadPlan')}
          </Button>
          {floor.planFileKey && (
            <Button
              variant="ghost"
              disabled={removePlan.isPending}
              onClick={() => run(removePlan.mutateAsync(floor.id))}
            >
              <ImageOff /> {t('removePlan')}
            </Button>
          )}
        </div>
      </Field>
      {floor.planFileKey && (
        <Field label={t('planOpacity')}>
          <Slider
            aria-label={t('planOpacity')}
            min={0.1}
            max={1}
            step={0.05}
            value={[opacity]}
            onValueChange={([v]) => v !== undefined && setOpacity(v)}
          />
        </Field>
      )}
      <Field label={t('scale')}>
        <p className="text-sm text-muted-foreground">
          {floor.scale ? t('scaleSet', { units: Math.round(floor.scale) }) : t('scaleUnset')}
        </p>
      </Field>
      <ConfirmDelete
        label={t('deleteFloor')}
        title={t('deleteFloorTitle', { name: floor.name })}
        body={t('deleteFloorBody')}
        onConfirm={() =>
          deleteFloor.mutateAsync(floor.id).then(
            () => {
              toast.success(t('deleted', { name: floor.name }));
              onFloorDeleted();
            },
            (error: unknown) => toast.error(errorText(error)),
          )
        }
      />

      {building && (
        <>
          <Separator />
          <h2 className="text-lg font-semibold">{t('building')}</h2>
          <Field label={t('name')}>
            <CommitInput
              aria-label={t('building')}
              value={building.name}
              maxLength={200}
              onCommit={(name) => run(updateBuilding.mutateAsync({ id: building.id, name }))}
            />
          </Field>
          <Field label={t('address')}>
            <CommitInput
              aria-label={t('address')}
              value={building.address ?? ''}
              maxLength={500}
              onCommit={(address) => run(updateBuilding.mutateAsync({ id: building.id, address }))}
            />
          </Field>
          <ConfirmDelete
            label={t('deleteBuilding')}
            title={t('deleteBuildingTitle', { name: building.name })}
            body={t('deleteBuildingBody')}
            onConfirm={() =>
              deleteBuilding.mutateAsync(building.id).then(
                () => {
                  toast.success(t('deleted', { name: building.name }));
                  onBuildingDeleted();
                },
                (error: unknown) => toast.error(errorText(error)),
              )
            }
          />
        </>
      )}
    </div>
  );
}

function ConfirmDelete({
  label,
  title,
  body,
  onConfirm,
}: {
  label: string;
  title: string;
  body: string;
  onConfirm: () => void;
}) {
  const t = useTranslations('inspector');
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="justify-self-start text-destructive">
          <Trash2 /> {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{body}</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={onConfirm}
          >
            {t('delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
