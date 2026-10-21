'use client';

import type Konva from 'konva';
import { useEffect, useState, type ComponentProps } from 'react';
import { Group, Image as KonvaImage, Line, Rect, Text } from 'react-konva';
import { apiBlob } from '@/lib/api';
import { initials, roomLabelPoint, SEAT_H, SEAT_W } from '@/lib/map-geometry';
import type { Floor, Room, Seat } from '@/lib/types';
import { useCssVars } from '@/lib/use-css-vars';

// Drawing shared by the floor map (view mode) and the layout editor.

export const FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const COLOR_VARS = [
  'canvas',
  'primary',
  'room-fill',
  'room-stroke',
  'room-meeting-fill',
  'room-label',
  'seat-free-fill',
  'seat-free-stroke',
  'seat-free-text',
  'seat-taken-fill',
  'seat-taken-stroke',
  'seat-taken-text',
  'seat-reserved-fill',
  'seat-reserved-stroke',
  'seat-reserved-text',
  'seat-blocked-fill',
  'seat-blocked-stroke',
  'seat-blocked-text',
] as const;

export type Colors = Record<(typeof COLOR_VARS)[number], string>;

export const useMapColors = () => useCssVars(COLOR_VARS);

export function setCursor(e: Konva.KonvaEventObject<MouseEvent>, cursor: string) {
  const container = e.target.getStage()?.container();
  if (container) container.style.cursor = cursor;
}

export function RoomShape({
  room,
  colors,
  textScale,
  selected = false,
  translucent = false,
  ...groupProps
}: {
  room: Room;
  colors: Colors;
  textScale: number;
  selected?: boolean;
  /** let the plan image show through */
  translucent?: boolean;
} & Omit<ComponentProps<typeof Group>, 'children'>) {
  const label = roomLabelPoint(room.polygon);
  return (
    <Group {...groupProps}>
      <Line
        points={room.polygon.flatMap((p) => [p.x, p.y])}
        closed
        fill={room.type === 'meeting' ? colors['room-meeting-fill'] : colors['room-fill']}
        opacity={translucent ? 0.55 : 1}
        stroke={selected ? colors.primary : colors['room-stroke']}
        strokeWidth={selected ? 2.5 : 1.5}
        strokeScaleEnabled={false}
        lineJoin="round"
      />
      <Text
        x={label.x}
        y={label.y}
        text={room.name}
        fontFamily={FONT}
        fontSize={13 * textScale}
        fill={colors['room-label']}
        listening={false}
      />
    </Group>
  );
}

export type SeatRing = 'selected' | 'highlight' | 'drop' | null;

/** The desk itself (rotates with the seat): ring, chair on the facing side, desk, blocked cross. */
export function SeatDesk({
  seat,
  colors,
  ring,
  ...groupProps
}: { seat: Seat; colors: Colors; ring: SeatRing } & Omit<
  ComponentProps<typeof Group>,
  'children'
>) {
  const state = seat.occupancy;
  const stroke = colors[`seat-${state}-stroke`];
  return (
    <Group x={seat.x} y={seat.y} rotation={seat.rotation} {...groupProps}>
      {ring && (
        <Rect
          x={-SEAT_W / 2 - 6}
          y={-SEAT_H / 2 - 6}
          width={SEAT_W + 12}
          height={SEAT_H + 12}
          cornerRadius={12}
          stroke={colors.primary}
          strokeWidth={ring === 'selected' ? 3 : 2}
          dash={ring === 'selected' ? undefined : [6, 4]}
          strokeScaleEnabled={false}
        />
      )}
      <Rect
        x={-14}
        y={SEAT_H / 2 + 3}
        width={28}
        height={9}
        cornerRadius={4}
        fill={stroke}
        opacity={0.55}
      />
      <Rect
        x={-SEAT_W / 2}
        y={-SEAT_H / 2}
        width={SEAT_W}
        height={SEAT_H}
        cornerRadius={8}
        fill={colors[`seat-${state}-fill`]}
        stroke={stroke}
        strokeWidth={1.5}
        dash={state === 'blocked' ? [5, 4] : undefined}
        strokeScaleEnabled={false}
      />
      {state === 'blocked' && (
        <Line
          points={[-10, -10, 10, 10, 0, 0, 10, -10, -10, 10]}
          stroke={stroke}
          strokeWidth={1.5}
          strokeScaleEnabled={false}
          listening={false}
        />
      )}
    </Group>
  );
}

/** Upright seat number under the desk (readable whatever way the desk faces). */
export function SeatLabel({
  seat,
  colors,
  textScale,
}: {
  seat: Seat;
  colors: Colors;
  textScale: number;
}) {
  return (
    <Text
      x={seat.x - SEAT_W}
      y={seat.y + SEAT_H / 2 + 16}
      width={SEAT_W * 2}
      align="center"
      text={seat.label}
      fontFamily={FONT}
      fontSize={11 * textScale}
      fill={colors['room-label']}
      listening={false}
    />
  );
}

/** What's written on the desk: initials when taken, R when reserved. */
export function seatContent(seat: Seat): string {
  const person = seat.currentAssignment?.person;
  if (seat.occupancy === 'taken' && person) return initials(person.displayName);
  return seat.occupancy === 'reserved' ? 'R' : '';
}

export function SeatText({
  seat,
  colors,
  textScale,
  color,
}: {
  seat: Seat;
  colors: Colors;
  textScale: number;
  color?: string;
}) {
  return (
    <Text
      x={-SEAT_W / 2}
      y={-SEAT_H / 2}
      width={SEAT_W}
      height={SEAT_H}
      align="center"
      verticalAlign="middle"
      text={seatContent(seat)}
      fontFamily={FONT}
      fontSize={Math.min(15 * textScale, 22)}
      fontStyle="600"
      fill={color ?? colors[`seat-${seat.occupancy}-text`]}
    />
  );
}

/** Loads the floor's plan image (through the API, with the caller's identity). */
export function usePlanImage(floor: Pick<Floor, 'id' | 'planFileKey'>): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!floor.planFileKey) {
      setImage(null);
      return;
    }
    let url: string | null = null;
    let cancelled = false;
    apiBlob(`/floors/${floor.id}/plan?v=${encodeURIComponent(floor.planFileKey)}`)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        const img = new window.Image();
        img.onload = () => !cancelled && setImage(img);
        img.src = url;
      })
      .catch(() => !cancelled && setImage(null));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [floor.id, floor.planFileKey]);
  return image;
}

export function PlanBackground({
  image,
  floor,
  opacity,
}: {
  image: HTMLImageElement | null;
  floor: Floor;
  opacity: number;
}) {
  if (!image || !floor.planWidth || !floor.planHeight) return null;
  return (
    <KonvaImage
      image={image}
      x={0}
      y={0}
      width={floor.planWidth}
      height={floor.planHeight}
      opacity={opacity}
      listening={false}
    />
  );
}
