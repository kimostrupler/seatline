/**
 * Team colours on the map. Seats of different teams sit side by side, so every pair of colours
 * must stay apart — only 4 pass that check (also for colour-blind people, light and dark;
 * validated with the dataviz palette checker). The 4 largest departments get one each, in a
 * fixed order (colour follows the team, not the floor); other teams stay neutral and are found
 * with the legend's highlight.
 */
export const TEAM_SLOTS = 4;

/** Department → colour slot (1–4), or nothing for smaller teams and people without one. */
export function teamSlots(
  departments: Array<{ name: string | null; people: number }>,
): Map<string, number> {
  const named = departments
    .filter((d): d is { name: string; people: number } => !!d.name)
    .sort((a, b) => b.people - a.people || a.name.localeCompare(b.name))
    .slice(0, TEAM_SLOTS);
  return new Map(named.map((d, i) => [d.name, i + 1]));
}

/** "#rrggbb" → "rgba(r, g, b, a)" (Konva fills). Anything else is returned unchanged. */
export function withAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color.trim());
  if (!m) return color;
  const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
