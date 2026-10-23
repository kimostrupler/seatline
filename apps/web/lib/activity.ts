import type { ActivityEntry, ActivityRefs } from './types';

/** One readable line for the activity list: a message id + its values, and where to look. */
export interface Described {
  key: string;
  values: Record<string, string | number>;
  /** opens the map here (query string for "/") */
  link?: { building: string; floor: string; seat?: string } | { person: string } | { plan: string };
}

type Snap = Record<string, unknown>;
const snaps = (v: unknown): Snap[] =>
  Array.isArray(v)
    ? (v.filter((x) => x && typeof x === 'object') as Snap[])
    : v && typeof v === 'object'
      ? [v as Snap]
      : [];
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

/**
 * Turn an audit log entry into a sentence. Names come from what exists now (refs); removed
 * things are named from the entry's own snapshot.
 */
export function describe(e: ActivityEntry, refs: ActivityRefs, unknownName: string): Described {
  const before = snaps(e.before);
  const after = snaps(e.after);
  const b = before[0] ?? {};
  const a = after[0] ?? {};
  const pick = (k: string) => str(a[k]) ?? str(b[k]);

  const person = (id?: string) => (id && refs.people[id]?.displayName) || unknownName;
  const seat = (id?: string, snap: Snap = {}) =>
    (id && refs.seats[id]?.label) || str(snap.label) || unknownName;
  const room = (id?: string, snap: Snap = {}) =>
    (id && refs.rooms[id]?.name) || str(snap.name) || unknownName;
  const floor = (id?: string, snap: Snap = {}) =>
    (id && refs.floors[id]?.name) || str(snap.name) || unknownName;
  const building = (id?: string, snap: Snap = {}) =>
    (id && refs.buildings[id]?.name) || str(snap.name) || unknownName;

  const floorLink = (floorId?: string, seatId?: string) => {
    const f = floorId && refs.floors[floorId];
    return f
      ? { building: f.buildingId, floor: floorId, ...(seatId && { seat: seatId }) }
      : undefined;
  };
  const seatLink = (seatId?: string) =>
    seatId && refs.seats[seatId] ? floorLink(refs.seats[seatId].floorId, seatId) : undefined;
  const changed = (k: string) => k in a && JSON.stringify(a[k]) !== JSON.stringify(b[k]);

  const action = e.action.replace(/^layout\./, '');
  switch (action) {
    case 'assignment.create':
      return {
        key: 'assigned',
        values: { person: person(pick('personId')), seat: seat(pick('seatId')) },
        link: seatLink(pick('seatId')),
      };
    case 'assignment.move': {
      const who = str(a.personId);
      const from = before.find((x) => x.personId === who) ?? b;
      return {
        key: 'moved',
        values: {
          person: person(who),
          from: seat(str(from.seatId)),
          to: seat(str(a.seatId)),
        },
        link: seatLink(str(a.seatId)),
      };
    }
    case 'assignment.reserve':
      return {
        key: 'reserved',
        values: { seat: seat(pick('seatId')), name: str(a.reservedFor) ?? unknownName },
        link: seatLink(pick('seatId')),
      };
    case 'assignment.end':
      return b.kind === 'reserved'
        ? {
            key: 'reservationCancelled',
            values: { seat: seat(pick('seatId')), name: str(b.reservedFor) ?? unknownName },
            link: seatLink(pick('seatId')),
          }
        : {
            key: e.actorId ? 'freed' : 'leftOrganisation',
            values: { seat: seat(pick('seatId')), person: person(pick('personId')) },
            link: seatLink(pick('seatId')),
          };

    case 'seat.create':
      return {
        key: 'seatAdded',
        values: { seat: seat(e.entityId, a) },
        link: seatLink(e.entityId),
      };
    case 'seat.delete':
      return {
        key: 'seatRemoved',
        values: { seat: str(b.label) ?? unknownName },
        link: floorLink(str(b.floorId)),
      };
    case 'seat.update': {
      const values = {
        seat: seat(e.entityId, a),
        old: str(b.label) ?? '',
        type: str(a.type) ?? '',
      };
      const key = changed('label')
        ? 'seatRenamed'
        : changed('status')
          ? a.status === 'blocked'
            ? 'seatBlocked'
            : 'seatUnblocked'
          : changed('x') || changed('y')
            ? 'seatMoved'
            : changed('rotation')
              ? 'seatTurned'
              : changed('type')
                ? 'seatTypeChanged'
                : 'seatChanged';
      return { key, values, link: seatLink(e.entityId) };
    }
    case 'seat.room':
      return {
        key: 'seatRoom',
        values: { seat: seat(e.entityId) },
        link: seatLink(e.entityId),
      };

    case 'room.create':
      return {
        key: 'roomAdded',
        values: { room: room(e.entityId, a) },
        link: floorLink(pick('floorId') ?? refs.rooms[e.entityId]?.floorId),
      };
    case 'room.delete':
      return {
        key: 'roomRemoved',
        values: { room: str(b.name) ?? unknownName },
        link: floorLink(str(b.floorId)),
      };
    case 'room.update':
      return {
        key: changed('name') ? 'roomRenamed' : changed('polygon') ? 'roomReshaped' : 'roomChanged',
        values: { room: room(e.entityId, a), old: str(b.name) ?? '' },
        link: floorLink(pick('floorId') ?? refs.rooms[e.entityId]?.floorId),
      };

    case 'floor.create':
      return a.copiedFromFloorId
        ? {
            key: 'floorCopied',
            values: { floor: floor(e.entityId, a), source: floor(str(a.copiedFromFloorId)) },
            link: floorLink(e.entityId),
          }
        : {
            key: 'floorAdded',
            values: { floor: floor(e.entityId, a) },
            link: floorLink(e.entityId),
          };
    case 'floor.update':
      return {
        key: changed('name') ? 'floorRenamed' : changed('scale') ? 'floorScale' : 'floorChanged',
        values: { floor: floor(e.entityId, a), old: str(b.name) ?? '' },
        link: floorLink(e.entityId),
      };
    case 'floor.delete':
      return { key: 'floorRemoved', values: { floor: str(b.name) ?? unknownName } };
    case 'floor.plan.upload':
      return {
        key: 'planUploaded',
        values: { floor: floor(e.entityId) },
        link: floorLink(e.entityId),
      };
    case 'floor.plan.import':
      return {
        key: 'planImported',
        values: { floor: floor(e.entityId) },
        link: floorLink(e.entityId),
      };
    case 'floor.plan.remove':
      return {
        key: 'planRemoved',
        values: { floor: floor(e.entityId) },
        link: floorLink(e.entityId),
      };

    case 'building.create':
      return { key: 'buildingAdded', values: { building: building(e.entityId, a) } };
    case 'building.update':
      return {
        key: changed('name') ? 'buildingRenamed' : 'buildingChanged',
        values: { building: building(e.entityId, a), old: str(b.name) ?? '' },
      };
    case 'building.delete':
      return { key: 'buildingRemoved', values: { building: str(b.name) ?? unknownName } };

    case 'person.role':
      return {
        key: a.appRole ? 'roleChanged' : 'accessRemoved',
        values: { person: person(e.entityId), role: str(a.appRole) ?? '' },
        link: { person: e.entityId },
      };
    case 'person.create':
      return {
        key: 'personAdded',
        values: {
          person: refs.people[e.entityId]?.displayName || str(a.displayName) || unknownName,
        },
        link: { person: e.entityId },
      };
    case 'person.update':
      return {
        key: 'personChanged',
        values: { person: person(e.entityId) },
        link: { person: e.entityId },
      };
    case 'person.leave':
      return {
        key: 'personLeft',
        values: { person: person(e.entityId) },
        link: { person: e.entityId },
      };
    case 'person.return':
      return {
        key: 'personBack',
        values: { person: person(e.entityId) },
        link: { person: e.entityId },
      };
    case 'person.invite':
      return {
        key: 'personInvited',
        values: { person: person(e.entityId) },
        link: { person: e.entityId },
      };
    case 'person.leaves_on':
      return {
        key: a.leavesOn ? 'leavingSet' : 'leavingCleared',
        values: { person: person(e.entityId), day: str(a.leavesOn) ?? '' },
        link: { person: e.entityId },
      };
    case 'team.rename':
      return { key: 'teamRenamed', values: { old: str(b.team) ?? '', team: str(a.team) ?? '' } };
    case 'team.remove':
      return { key: 'teamDeleted', values: { team: str(b.team) ?? '' } };
    case 'person.team':
      return {
        key: a.department ? 'teamChanged' : 'teamRemoved',
        values: { person: person(e.entityId), team: str(a.department) ?? '' },
        link: { person: e.entityId },
      };
    case 'person.first_sign_in':
      return {
        key: 'firstSignIn',
        values: { person: person(e.entityId) },
        link: { person: e.entityId },
      };
    case 'person.link_microsoft':
      return {
        key: 'linkedMicrosoft',
        values: { person: person(e.entityId) },
        link: { person: e.entityId },
      };
    case 'people.sync':
      return {
        key: 'peopleSynced',
        values: {
          created: Number(a.created ?? 0),
          updated: Number(a.updated ?? 0),
          deactivated: Number(a.deactivated ?? 0),
        },
      };
    case 'tenant.create':
      return { key: 'workspaceCreated', values: { name: str(a.name) ?? '' } };
    case 'team_plan.set':
      return a.headcount === undefined
        ? { key: 'teamPlanRemoved', values: { team: str(b.team) ?? '' } }
        : {
            key: 'teamPlanSet',
            values: { team: str(a.team) ?? '', count: Number(a.headcount ?? 0) },
          };
    case 'dashboard.update':
      return { key: 'dashboardUpdated', values: {} };
    case 'dashboard.reset':
      return { key: 'dashboardReset', values: {} };
    case 'dashboard.default':
      return { key: 'dashboardDefault', values: {} };
    case 'move_plan.create':
      return {
        key: 'planCreated',
        values: { name: str(a.name) ?? '' },
        link: { plan: e.entityId },
      };
    case 'move_plan.schedule':
      return {
        key: 'planScheduled',
        values: { name: str(a.name) ?? '', date: str(a.effectiveDate) ?? '' },
        link: { plan: e.entityId },
      };
    case 'move_plan.apply':
      return {
        key: 'planApplied',
        values: { name: str(a.name) ?? '', count: Number(a.moves ?? 0) },
        link: { plan: e.entityId },
      };
    case 'move_plan.failed':
      return { key: 'planFailed', values: { name: str(a.name) ?? '' }, link: { plan: e.entityId } };
    case 'move_plan.cancel':
      return {
        key: 'planCancelled',
        values: { name: str(a.name) ?? '' },
        link: { plan: e.entityId },
      };
    case 'move_plan.update':
    case 'move_plan.items':
    case 'move_plan.unschedule':
      return {
        key: 'planChanged',
        values: { name: str(a.name) ?? str(b.name) ?? '' },
        link: { plan: e.entityId },
      };
    case 'export.seating':
      return { key: 'exportedSeating', values: {} };
    case 'export.history':
      return { key: 'exportedHistory', values: {} };
    case 'privacy.export':
      return {
        key: 'privacyExport',
        values: { person: person(e.entityId) },
        link: { person: e.entityId },
      };
    case 'privacy.dpa':
      return { key: 'privacyDpa', values: {} };
    case 'owner.workspace.delete':
      return { key: 'workspaceDeleted', values: { name: pick('name') ?? '' } };
    case 'owner.workspace.stop_tips':
      return { key: 'workspaceTipsStopped', values: { name: pick('name') ?? '' } };
    case 'privacy.forget':
      return { key: 'privacyForget', values: {} };
    case 'privacy.purge':
      return { key: 'privacyPurge', values: { months: Number(a.months ?? 0) } };
    case 'billing.checkout':
      return { key: 'billingCheckout', values: {} };
    case 'billing.subscription':
      return { key: 'billingSubscription', values: { status: str(a.status) ?? '' } };
    case 'billing.seats':
      return { key: 'billingSeats', values: { seats: Number(a.seats ?? 0) } };
    case 'tenant.seed':
      return { key: 'demoData', values: {} };
    case 'tenant.update':
      return { key: 'workspaceChanged', values: {} };
    default:
      return { key: 'other', values: { action: e.action } };
  }
}

/** "/map?building=…&floor=…&seat=…" or "/map?person=…" */
export function linkHref(link: NonNullable<Described['link']>): string {
  if ('plan' in link) return `/moves/${link.plan}`;
  return `/map?${new URLSearchParams(link as Record<string, string>).toString()}`;
}
