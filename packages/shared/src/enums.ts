export const APP_ROLES = ['admin', 'editor', 'viewer'] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const ROOM_TYPES = ['office', 'open_space', 'meeting', 'other'] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const SEAT_TYPES = ['desk', 'office'] as const;
export type SeatType = (typeof SEAT_TYPES)[number];

export const SEAT_STATUSES = ['active', 'blocked'] as const;
export type SeatStatus = (typeof SEAT_STATUSES)[number];

export const ASSIGNMENT_KINDS = ['assigned', 'reserved'] as const;
export type AssignmentKind = (typeof ASSIGNMENT_KINDS)[number];

/** What the floor map shows for a seat. */
export const SEAT_OCCUPANCY = ['free', 'taken', 'reserved', 'blocked'] as const;
export type SeatOccupancy = (typeof SEAT_OCCUPANCY)[number];

/** How desks on a floor are numbered: 1.01, 1.02… or by room: 1.04-A, 1.04-B… */
export const SEAT_NUMBERINGS = ['floor', 'room'] as const;
export type SeatNumbering = (typeof SEAT_NUMBERINGS)[number];

/** What a (meeting) room has. */
export const ROOM_EQUIPMENT = ['screen', 'video', 'whiteboard', 'phone'] as const;
export type RoomEquipment = (typeof ROOM_EQUIPMENT)[number];

/** What a desk has — searchable on the map ("find a free standing desk"). */
export const SEAT_FEATURES = [
  'standing',
  'two_screens',
  'docking',
  'window',
  'quiet',
  'accessible',
] as const;
export type SeatFeature = (typeof SEAT_FEATURES)[number];

/** Things to find one's way on a floor. */
export const MARKER_KINDS = [
  'kitchen',
  'coffee',
  'printer',
  'toilet',
  'exit',
  'stairs',
  'elevator',
  'lockers',
  'first_aid',
  'reception',
] as const;
export type MarkerKind = (typeof MARKER_KINDS)[number];
