/**
 * Where a new workspace stopped setting up (owner page): desks → people → seating them → done.
 * One person is the admin who signed up, so "people" means more than that.
 */
export function setupStep(w: { seats: number; people: number; seated: number }) {
  if (w.seats === 0) return 'desks' as const;
  if (w.people <= 1) return 'people' as const;
  if (w.seated === 0) return 'seated' as const;
  return 'done' as const;
}
