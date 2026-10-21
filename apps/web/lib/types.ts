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
  billing: { state: BillingState; trialEndsAt: string };
}

/** off = billing not set up (local/self-hosted) */
export type BillingState = 'off' | 'trial' | 'active' | 'past_due' | 'read_only';

export interface BillingOverview {
  configured: boolean;
  state: BillingState;
  trialEndsAt: string;
  status: string | null;
  periodEnd: string | null;
  subscribed: boolean;
  /** active seats now (what the next bill counts) */
  seats: number;
  billedSeats: number | null;
  price: { amount: number; currency: string; interval: string } | null;
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
  /** keep history this many months (null = forever) */
  historyRetentionMonths: 12 | 24 | 60 | 120 | null;
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
  leftAt: string | null;
  forgottenAt: string | null;
}

export type ActivityKind = 'seating' | 'moves' | 'layout' | 'places' | 'people';

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

export interface DashboardData {
  widgets: import('@seatline/shared').Widget[];
  source: 'personal' | 'company' | 'builtin';
  hasCompanyDefault: boolean;
}

interface FloorRef {
  floorId: string;
  floorName: string;
  buildingId: string;
  buildingName: string;
}

export interface Stats {
  weeks: Array<{ start: string; assigned: number; moved: number; reserved: number; freed: number }>;
  unseated: {
    total: number;
    people: Array<{ id: string; displayName: string; department: string | null }>;
  };
  reservations: {
    total: number;
    items: Array<
      FloorRef & {
        id: string;
        seatId: string;
        seatLabel: string;
        reservedFor: string;
        startAt: string;
      }
    >;
  };
  blocked: {
    total: number;
    items: Array<FloorRef & { seatId: string; label: string; since: string }>;
  };
  freeSeats: Array<FloorRef & { free: number; labels: string[] }>;
  departments: Array<{
    name: string | null;
    people: number;
    seated: number;
    floors: Array<FloorRef & { count: number }>;
  }>;
}

export type MovePlanStatus = 'draft' | 'scheduled' | 'applied' | 'cancelled' | 'failed';

export interface MovePlanSummary {
  id: string;
  name: string;
  note: string | null;
  status: MovePlanStatus;
  /** YYYY-MM-DD (Swiss calendar day) */
  effectiveDate: string | null;
  createdAt: string;
  updatedAt: string;
  appliedAt: string | null;
  createdBy: { id: string; displayName: string };
  moves: number;
}

export interface PlanSeatRef {
  id: string;
  label: string;
  floorId: string;
  floor: { id: string; name: string; level: number; buildingId: string };
}

export interface MoveItem {
  personId: string;
  person: { id: string; displayName: string; department: string | null; active: boolean };
  /** where they sit now */
  fromSeat: PlanSeatRef | null;
  /** where they'll sit; null = they give up their seat */
  toSeat: PlanSeatRef | null;
}

export interface PlanProblem {
  code: 'seat_taken' | 'seat_blocked' | 'seat_double' | 'seat_missing' | 'no_moves';
  personId?: string;
  seatId?: string;
  byPersonId?: string;
  personName?: string;
  byName?: string;
  seatLabel?: string;
}

export interface PlanNote {
  code: 'person_left' | 'no_change' | 'reservation_replaced';
  personId: string;
  seatId?: string;
  reservedFor?: string;
  personName?: string;
  seatLabel?: string;
}

export interface MovePlanDetail extends Omit<MovePlanSummary, 'moves'> {
  scheduledBy: { id: string; displayName: string } | null;
  items: MoveItem[];
  problems: PlanProblem[];
  notes: PlanNote[];
  /** only after "move a team" */
  placed?: number;
  unplaced?: number;
}

/** A plan the plan engine read: suggestions in the pixels of its new background image. */
export type PlanImport = import('@seatline/shared').PlanDraft & { importId: string };
