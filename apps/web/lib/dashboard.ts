import type { AppRole, Widget, WidgetSize, WidgetType } from '@seatline/shared';

/** Every widget: its normal size, and who may see it (others never get it, even if saved). */
export const WIDGETS: Record<WidgetType, { size: WidgetSize; roles?: AppRole[] }> = {
  summary: { size: 'wide' },
  occupancy: { size: 'wide' },
  activity: { size: 'wide', roles: ['admin', 'editor'] },
  trend: { size: 'wide' },
  unseated: { size: 'small' },
  reservations: { size: 'small' },
  departments: { size: 'full' },
  freeSeats: { size: 'small' },
  blocked: { size: 'small' },
  sync: { size: 'small', roles: ['admin'] },
  mySeat: { size: 'small' },
  quickActions: { size: 'small' },
  moves: { size: 'small', roles: ['admin', 'editor'] },
};

export const canSee = (type: WidgetType, role: AppRole | undefined) => {
  const roles = WIDGETS[type].roles;
  return !roles || (!!role && roles.includes(role));
};

/** Move the widget at `from` so it ends up at `to`. */
export function moveWidget(list: Widget[], from: number, to: number): Widget[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = [...list];
  const [w] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, w!);
  return next;
}

export const resizeWidget = (list: Widget[], id: string, size: WidgetSize) =>
  list.map((w) => (w.id === id ? { ...w, size } : w));

export const removeWidget = (list: Widget[], id: string) => list.filter((w) => w.id !== id);

/** Add a widget at the top (that's where people look for what they just added). */
export function addWidget(list: Widget[], type: WidgetType, newId: () => string): Widget[] {
  return [{ id: newId(), type, size: WIDGETS[type].size }, ...list];
}

/** Grid columns a widget spans (4-column grid on wide screens, 2 on tablets, 1 on phones). */
export const SPAN: Record<WidgetSize, string> = {
  small: 'md:col-span-1',
  wide: 'md:col-span-2',
  full: 'md:col-span-2 xl:col-span-4',
};
