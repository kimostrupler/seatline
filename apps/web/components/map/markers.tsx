'use client';

import type { MarkerKind, RoomEquipment, SeatFeature } from '@seatline/shared';
import {
  Accessibility,
  ArrowUpDown,
  ArrowUpFromLine,
  BriefcaseMedical,
  ConciergeBell,
  Coffee,
  CookingPot,
  DoorOpen,
  Footprints,
  Headphones,
  Lock,
  Monitor,
  Phone,
  Plug,
  Presentation,
  Printer,
  Sun,
  Toilet,
  Tv,
  Video,
  type LucideIcon,
} from 'lucide-react';
import type { View } from '@/lib/map-geometry';
import type { Marker } from '@/lib/types';
import { cn } from '@/lib/utils';

export const MARKER_ICONS: Record<MarkerKind, LucideIcon> = {
  kitchen: CookingPot,
  coffee: Coffee,
  printer: Printer,
  toilet: Toilet,
  exit: DoorOpen,
  stairs: Footprints,
  elevator: ArrowUpDown,
  lockers: Lock,
  first_aid: BriefcaseMedical,
  reception: ConciergeBell,
};

export const FEATURE_ICONS: Record<SeatFeature, LucideIcon> = {
  standing: ArrowUpFromLine,
  two_screens: Monitor,
  docking: Plug,
  window: Sun,
  quiet: Headphones,
  accessible: Accessibility,
};

export const EQUIPMENT_ICONS: Record<RoomEquipment, LucideIcon> = {
  screen: Tv,
  video: Video,
  whiteboard: Presentation,
  phone: Phone,
};

/**
 * Markers drawn over the canvas as real icons (always the same size on screen, crisp at any
 * zoom). Purely visual: clicks go through to the canvas; the accessible list names them.
 */
export function MarkerOverlay({
  markers,
  view,
  selectedId,
  moving,
}: {
  markers: Marker[];
  view: View;
  selectedId?: string | null;
  /** a marker being dragged: drawn where the pointer is */
  moving?: { id: string; x: number; y: number } | null;
}) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {markers.map((m) => {
        const Icon = MARKER_ICONS[m.kind] ?? DoorOpen;
        const at = moving?.id === m.id ? moving : m;
        return (
          <div
            key={m.id}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
            style={{ left: view.x + at.x * view.scale, top: view.y + at.y * view.scale }}
            data-marker={m.kind}
          >
            <span
              className={cn(
                'grid size-7 place-items-center rounded-full border bg-background text-foreground shadow-sm',
                selectedId === m.id && 'ring-2 ring-primary',
              )}
            >
              <Icon className="size-4" />
            </span>
            {m.label && view.scale >= 0.45 && (
              <span className="rounded bg-background/90 px-1 text-[10px] leading-tight font-medium whitespace-nowrap">
                {m.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
