import { z } from 'zod';
import { APP_ROLES, ROOM_TYPES, SEAT_STATUSES, SEAT_TYPES } from './enums';

const id = z.uuid();
const name = z.string().trim().min(1).max(200);
const note = z.string().trim().max(1000);

// ---- Buildings -------------------------------------------------------------

export const createBuildingSchema = z.strictObject({
  name,
  address: z.string().trim().max(500).nullish(),
});
export const updateBuildingSchema = createBuildingSchema.partial();

// ---- Floors ----------------------------------------------------------------

export const createFloorSchema = z.strictObject({
  buildingId: id,
  name,
  level: z.int().min(-20).max(300),
  planFileKey: z.string().max(500).nullish(),
  planWidth: z.number().positive().nullish(),
  planHeight: z.number().positive().nullish(),
  /** Plan units per metre. */
  scale: z.number().positive().nullish(),
  /** Start with a copy of this floor's rooms, seats, plan image and scale (no people). */
  copyFromFloorId: id.nullish(),
});
export const updateFloorSchema = createFloorSchema
  .omit({ buildingId: true, copyFromFloorId: true })
  .partial();
export const listFloorsQuerySchema = z.strictObject({ buildingId: id.optional() });

// ---- Rooms -----------------------------------------------------------------

export const pointSchema = z.strictObject({ x: z.number(), y: z.number() });
export const polygonSchema = z.array(pointSchema).min(3).max(500);

export const createRoomSchema = z.strictObject({
  floorId: id,
  name,
  type: z.enum(ROOM_TYPES).default('office'),
  polygon: polygonSchema,
});
export const updateRoomSchema = createRoomSchema.omit({ floorId: true }).partial();
export const listRoomsQuerySchema = z.strictObject({ floorId: id });

// ---- Seats -----------------------------------------------------------------

export const createSeatSchema = z.strictObject({
  floorId: id,
  roomId: id.nullish(),
  label: z.string().trim().min(1).max(50),
  x: z.number(),
  y: z.number(),
  rotation: z.number().min(0).lt(360).default(0),
  type: z.enum(SEAT_TYPES).default('desk'),
  status: z.enum(SEAT_STATUSES).default('active'),
});
export const updateSeatSchema = createSeatSchema.omit({ floorId: true }).partial();
export const listSeatsQuerySchema = z.strictObject({ floorId: id });

// ---- Layout editor batch -------------------------------------------------

/**
 * One editor action (add, move, rotate, delete… possibly many items) saved atomically.
 * The client creates ids (UUIDs) so undo/redo can refer to the same objects.
 * Seats' rooms are derived from their position on the server.
 */
const layoutRoom = z.strictObject({
  id,
  name,
  type: z.enum(ROOM_TYPES),
  polygon: polygonSchema,
});
const layoutSeat = z.strictObject({
  id,
  label: z.string().trim().min(1).max(50),
  x: z.number(),
  y: z.number(),
  rotation: z.number().min(0).lt(360),
  type: z.enum(SEAT_TYPES),
  status: z.enum(SEAT_STATUSES),
});

export const layoutChangesSchema = z.strictObject({
  rooms: z
    .strictObject({
      create: z.array(layoutRoom).max(500).default([]),
      update: z
        .array(layoutRoom.partial().required({ id: true }))
        .max(500)
        .default([]),
      delete: z.array(id).max(500).default([]),
    })
    .default({ create: [], update: [], delete: [] }),
  seats: z
    .strictObject({
      create: z.array(layoutSeat).max(2000).default([]),
      update: z
        .array(layoutSeat.partial().required({ id: true }))
        .max(2000)
        .default([]),
      delete: z.array(id).max(2000).default([]),
    })
    .default({ create: [], update: [], delete: [] }),
});

// ---- Assignments -----------------------------------------------------------

/** Give a person a seat. If they already sit somewhere, that is a move. */
export const assignSeatSchema = z.strictObject({
  seatId: id,
  personId: id,
  note: note.optional(),
});

/** Hold a seat for someone who isn't in the directory yet (new hire, team…). */
export const reserveSeatSchema = z.strictObject({
  seatId: id,
  reservedFor: z.string().trim().min(1).max(200),
  note: note.optional(),
});

/** Free a seat (closes the open assignment or reservation). */
export const endAssignmentSchema = z.strictObject({
  note: note.optional(),
});

// ---- People ----------------------------------------------------------------

/** First sign-in from a new organisation: create its Seatline workspace. */
export const onboardingSchema = z.strictObject({
  companyName: z.string().trim().min(2).max(200),
});

export const updateTenantSchema = z.strictObject({
  name: z.string().trim().min(2).max(200).optional(),
  /** what people get when they sign in without a role; null = only invited people */
  defaultAppRole: z.enum(APP_ROLES).nullable().optional(),
});

export const setRoleSchema = z.strictObject({
  appRole: z.enum(APP_ROLES).nullable(),
});

export const listPeopleQuerySchema = z.strictObject({
  search: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateBuildingInput = z.infer<typeof createBuildingSchema>;
export type UpdateBuildingInput = z.infer<typeof updateBuildingSchema>;
export type CreateFloorInput = z.infer<typeof createFloorSchema>;
export type UpdateFloorInput = z.infer<typeof updateFloorSchema>;
export type Point = z.infer<typeof pointSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type CreateSeatInput = z.infer<typeof createSeatSchema>;
export type UpdateSeatInput = z.infer<typeof updateSeatSchema>;
export type LayoutChanges = z.infer<typeof layoutChangesSchema>;
export type LayoutChangesInput = z.input<typeof layoutChangesSchema>;
export type LayoutRoom = z.infer<typeof layoutRoom>;
export type LayoutSeat = z.infer<typeof layoutSeat>;
export type AssignSeatInput = z.infer<typeof assignSeatSchema>;
export type ReserveSeatInput = z.infer<typeof reserveSeatSchema>;
export type EndAssignmentInput = z.infer<typeof endAssignmentSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type SetRoleInput = z.infer<typeof setRoleSchema>;
export type ListPeopleQuery = z.infer<typeof listPeopleQuerySchema>;
