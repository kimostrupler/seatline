import type {
  AppRole,
  AssignmentKind,
  RoomType,
  SeatOccupancy,
  SeatStatus,
  SeatType,
} from '@seatline/shared';

// Shapes of the API's JSON responses (dates arrive as ISO strings).

export interface Me {
  person: { id: string; displayName: string; email: string };
  tenant: { id: string; name: string };
  role: AppRole;
}

export interface Building {
  id: string;
  name: string;
  address: string | null;
}

export interface Floor {
  id: string;
  buildingId: string;
  name: string;
  level: number;
  planFileKey: string | null;
  planWidth: number | null;
  planHeight: number | null;
  /** plan units per metre, null until set with the scale tool */
  scale: number | null;
}

export interface Point {
  x: number;
  y: number;
}

export interface Room {
  id: string;
  floorId: string;
  name: string;
  type: RoomType;
  polygon: Point[];
}

export interface PersonRef {
  id: string;
  displayName: string;
  department?: string | null;
}

export interface Assignment {
  id: string;
  seatId: string;
  personId: string | null;
  kind: AssignmentKind;
  reservedFor: string | null;
  startAt: string;
  endAt: string | null;
  assignedById: string;
  note: string | null;
}

export interface Seat {
  id: string;
  floorId: string;
  roomId: string | null;
  label: string;
  x: number;
  y: number;
  rotation: number;
  type: SeatType;
  status: SeatStatus;
  occupancy: SeatOccupancy;
  currentAssignment: (Assignment & { person: PersonRef | null }) | null;
}

export interface FloorMap {
  floor: Floor & { building: { id: string; name: string } };
  rooms: Room[];
  seats: Seat[];
}

export interface Person {
  id: string;
  email: string;
  displayName: string;
  department: string | null;
  jobTitle: string | null;
  assignments: Array<{
    id: string;
    seat: {
      id: string;
      label: string;
      floorId: string;
      floor: { name: string; buildingId: string };
    };
  }>;
}

export interface HistoryEntry extends Assignment {
  person: PersonRef | null;
  assignedBy: { id: string; displayName: string };
  seat: { id: string; label: string; floorId: string };
}

export interface AssignResult {
  assignment: Assignment;
  closed: Assignment[];
}

export interface TenantInfo {
  id: string;
  name: string;
  defaultAppRole: AppRole | null;
  entraTenantId: string | null;
  peopleSyncedAt: string | null;
  peopleSyncStatus: {
    ok: boolean;
    at: string;
    error?: 'not_connected' | 'not_configured' | 'consent_required' | 'failed';
    message?: string;
    created?: number;
    updated?: number;
    deactivated?: number;
    seatsFreed?: number;
  } | null;
}

export interface DirectoryPerson {
  id: string;
  displayName: string;
  email: string;
  department: string | null;
  jobTitle: string | null;
  appRole: AppRole | null;
  active: boolean;
}

export type ActivityKind = 'seating' | 'layout' | 'places' | 'people';

export interface ActivityEntry {
  id: string;
  createdAt: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
}

export interface ActivityRefs {
  people: Record<string, { displayName: string }>;
  seats: Record<string, { label: string; floorId: string }>;
  rooms: Record<string, { name: string; floorId: string }>;
  floors: Record<string, { name: string; buildingId: string }>;
  buildings: Record<string, { name: string }>;
}

export interface ActivityPage {
  items: ActivityEntry[];
  nextCursor: string | null;
  refs: ActivityRefs;
}

export interface OccupancyCounts {
  seats: number;
  free: number;
  taken: number;
  reserved: number;
  blocked: number;
}

export interface Overview extends OccupancyCounts {
  buildings: Array<
    OccupancyCounts & {
      id: string;
      name: string;
      address: string | null;
      floors: Array<OccupancyCounts & { id: string; name: string; level: number }>;
    }
  >;
}
