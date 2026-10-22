import type { OccupancyCounts } from './types';

export const SETUP_STEPS = ['building', 'desks', 'people', 'seated'] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

/** Where each step's button goes. */
export const SETUP_LINKS: Record<SetupStep, string> = {
  building: '/map',
  desks: '/map?mode=edit',
  people: '/people',
  seated: '/map',
};

/**
 * A new workspace's first steps, ticked off from what's already there: a building, desks on a
 * floor, colleagues besides the admin, and someone seated.
 */
export function setupProgress(
  overview: (OccupancyCounts & { buildings: unknown[] }) | undefined,
  activePeople: number | undefined,
): Record<SetupStep, boolean> | null {
  if (!overview || activePeople === undefined) return null;
  return {
    building: overview.buildings.length > 0,
    desks: overview.seats > 0,
    people: activePeople > 1,
    seated: overview.taken > 0,
  };
}
