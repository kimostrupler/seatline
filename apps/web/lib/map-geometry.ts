import type { Point, Room, Seat } from './types';

/** Desk size in plan units. */
export const SEAT_W = 64;
export const SEAT_H = 44;

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : '';
  return (first + last).toUpperCase();
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Everything drawn on the floor, so "fit to screen" frames the real content. */
export function contentBounds(
  rooms: Room[],
  seats: Seat[],
  plan?: { width: number; height: number } | null,
): Bounds | null {
  const points: Point[] = [
    ...(plan
      ? [
          { x: 0, y: 0 },
          { x: plan.width, y: plan.height },
        ]
      : []),
    ...rooms.flatMap((r) => r.polygon),
    ...seats.flatMap((s) => [
      { x: s.x - SEAT_W / 2, y: s.y - SEAT_H / 2 },
      { x: s.x + SEAT_W / 2, y: s.y + SEAT_H / 2 + 16 },
    ]),
  ];
  if (points.length === 0) return null;
  return {
    minX: Math.min(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxX: Math.max(...points.map((p) => p.x)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}

export interface View {
  scale: number;
  x: number;
  y: number;
}

export const MIN_SCALE = 0.2;
export const MAX_SCALE = 4;

export const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

/** Scale + offset that centres `bounds` in a viewport, with padding. */
export function fitView(bounds: Bounds, width: number, height: number, padding = 48): View {
  const w = Math.max(1, bounds.maxX - bounds.minX);
  const h = Math.max(1, bounds.maxY - bounds.minY);
  const scale = clampScale(Math.min((width - padding * 2) / w, (height - padding * 2) / h));
  return {
    scale,
    x: (width - w * scale) / 2 - bounds.minX * scale,
    y: (height - h * scale) / 2 - bounds.minY * scale,
  };
}

/** Zoom around a screen point (cursor or viewport centre), keeping it fixed. */
export function zoomAt(view: View, factor: number, at: Point): View {
  const scale = clampScale(view.scale * factor);
  const k = scale / view.scale;
  return { scale, x: at.x - (at.x - view.x) * k, y: at.y - (at.y - view.y) * k };
}

/** Screen point → plan coordinates. */
export function toPlan(view: View, p: Point): Point {
  return { x: (p.x - view.x) / view.scale, y: (p.y - view.y) / view.scale };
}

/** The seat under a plan point (desks are small rectangles; rotation ignored for hit testing). */
export function seatAt(seats: Seat[], p: Point): Seat | undefined {
  return seats.find(
    (s) => Math.abs(p.x - s.x) <= SEAT_W / 2 + 4 && Math.abs(p.y - s.y) <= SEAT_H / 2 + 4,
  );
}

export function roomLabelPoint(polygon: Point[]): Point {
  // top-left corner of the room's bounding box, so labels never sit on desks
  return {
    x: Math.min(...polygon.map((p) => p.x)) + 12,
    y: Math.min(...polygon.map((p) => p.y)) + 10,
  };
}
