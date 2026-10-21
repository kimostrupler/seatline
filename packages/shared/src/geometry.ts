export interface XY {
  x: number;
  y: number;
}

/** Ray casting: is the point inside the polygon? (edges count as outside, which is fine here) */
export function pointInPolygon(p: XY, polygon: readonly XY[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

export function polygonArea(polygon: readonly XY[]): number {
  let sum = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    sum += (polygon[j]!.x + polygon[i]!.x) * (polygon[j]!.y - polygon[i]!.y);
  }
  return Math.abs(sum / 2);
}

/** The room a seat belongs to: the smallest room containing it (rooms may be nested). */
export function roomForPoint<R extends { id: string; polygon: readonly XY[] }>(
  p: XY,
  rooms: readonly R[],
): R | undefined {
  return rooms
    .filter((r) => r.polygon.length >= 3 && pointInPolygon(p, r.polygon))
    .sort((a, b) => polygonArea(a.polygon) - polygonArea(b.polygon))[0];
}

/** Seat label for a copied floor: "1.04" copied from level 1 to level 2 becomes "2.04". */
export function relabel(label: string, fromLevel: number, toLevel: number): string {
  const prefix = `${fromLevel}.`;
  return fromLevel !== toLevel && label.startsWith(prefix)
    ? `${toLevel}.${label.slice(prefix.length)}`
    : label;
}
