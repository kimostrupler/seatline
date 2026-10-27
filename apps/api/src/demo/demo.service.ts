import { randomUUID } from 'node:crypto';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { MailLanguage, MarkerKind, RoomEquipment, SeatFeature } from '@seatline/shared';
import { addDays } from '../bookings/bookings.service';
import { zurichToday } from '../moves/moves.service';
import { audit } from '../common/audit';
import { TenantDb, type Tx } from '../db/tenant-db.service';
import { StorageService } from '../storage/storage.service';

/** At most this many demo workspaces at once (they're deleted after a day). */
export const MAX_DEMO_WORKSPACES = 300;
/** Demo workspaces older than this are deleted by the nightly job. */
export const DEMO_LIFETIME = '1 day';

const DAY = 86_400_000;

/** Texts of the sample office, in the visitor's language. */
const TEXT = {
  en: {
    company: 'Example Ltd',
    you: 'You (demo admin)',
    building: 'Head office Zurich',
    floor: (n: number) => (n === 1 ? '1st floor' : '2nd floor'),
    teams: ['Sales', 'Engineering', 'Finance', 'People & Culture'],
    open: 'Open space',
    focus: 'Focus room',
    hall: 'Reception & kitchen',
    lounge: 'Lounge',
    plan: 'Desks for our new colleagues',
    reserved: 'New hire (starts next month)',
    moved: 'Closer to the team',
  },
  de: {
    company: 'Muster AG',
    you: 'Sie (Demo-Admin)',
    building: 'Hauptsitz Zürich',
    floor: (n: number) => `${n}. OG`,
    teams: ['Verkauf', 'Entwicklung', 'Finanzen', 'Personal'],
    open: 'Grossraum',
    focus: 'Ruheraum',
    hall: 'Empfang & Küche',
    lounge: 'Lounge',
    plan: 'Plätze für neue Kolleginnen und Kollegen',
    reserved: 'Neue Mitarbeiterin (ab nächstem Monat)',
    moved: 'Näher beim Team',
  },
  fr: {
    company: 'Exemple SA',
    you: 'Vous (admin démo)',
    building: 'Siège Lausanne',
    floor: (n: number) => (n === 1 ? '1er étage' : '2e étage'),
    teams: ['Ventes', 'Développement', 'Finances', 'Ressources humaines'],
    open: 'Open space',
    focus: 'Salle calme',
    hall: 'Accueil & cuisine',
    lounge: 'Espace détente',
    plan: 'Des places pour nos nouveaux collègues',
    reserved: 'Nouvelle collaboratrice (dès le mois prochain)',
    moved: 'Plus près de l’équipe',
  },
} satisfies Record<MailLanguage, unknown>;

/** [name, team index, job title] — Swiss names, fictional people. */
const PEOPLE: Array<[string, number, string]> = [
  ['Mia Schmid', 0, 'Sales Lead'],
  ['Marc Dubois', 0, 'Account Executive'],
  ['Lea Keller', 0, 'Account Executive'],
  ['Jonas Weber', 0, 'Sales Assistant'],
  ['Chiara Bianchi', 0, 'Key Account Manager'],
  ['Luca Rossi', 1, 'Software Engineer'],
  ['Sophie Meier', 1, 'Engineering Manager'],
  ['Noah Huber', 1, 'Designer'],
  ['Elena Brunner', 1, 'Software Engineer'],
  ['David Frei', 1, 'QA Engineer'],
  ['Laura Graf', 1, 'Software Engineer'],
  ['Tim Baumann', 1, 'Data Analyst'],
  ['Anna Moser', 2, 'CFO'],
  ['Julien Favre', 2, 'Controller'],
  ['Sara Gerber', 2, 'Accountant'],
  ['Nico Steiner', 2, 'Payroll'],
  ['Lina Wyss', 3, 'HR Partner'],
  ['Simon Zürcher', 3, 'Recruiter'],
  ['Alessia Ferrari', 3, 'Office Manager'],
  ['Patrick Roth', 0, 'Sales Trainee'],
  ['Céline Bonvin', 1, 'Product Owner'],
  ['Yannick Imhof', 2, 'Accountant'],
];

interface FloorSpec {
  rooms: Array<{
    key: string;
    type: 'open_space' | 'meeting' | 'office' | 'other';
    polygon: Array<{ x: number; y: number }>;
    team?: number;
    capacity?: number;
    equipment?: RoomEquipment[];
    name?: string;
  }>;
  markers: Array<{ kind: MarkerKind; x: number; y: number }>;
}

const rect = (x1: number, y1: number, x2: number, y2: number) => [
  { x: x1, y: y1 },
  { x: x2, y: y1 },
  { x: x2, y: y2 },
  { x: x1, y: y2 },
];

const FLOORS: FloorSpec[] = [
  {
    rooms: [
      { key: 'open', type: 'open_space', polygon: rect(40, 40, 760, 500), team: 0 },
      { key: 'hall', type: 'other', polygon: rect(40, 540, 1160, 760) },
      {
        key: 'meet',
        type: 'meeting',
        polygon: rect(800, 40, 1160, 300),
        name: 'Rigi',
        capacity: 8,
        equipment: ['screen', 'video', 'whiteboard'],
      },
      {
        key: 'meet2',
        type: 'meeting',
        polygon: rect(800, 320, 1160, 500),
        name: 'Pilatus',
        capacity: 4,
        equipment: ['screen'],
      },
    ],
    // markers inside the room below the offices (they used to float on empty floor)
    markers: [
      { kind: 'reception', x: 140, y: 650 },
      { kind: 'first_aid', x: 320, y: 650 },
      { kind: 'printer', x: 680, y: 650 },
      { kind: 'kitchen', x: 960, y: 650 },
      { kind: 'exit', x: 1110, y: 720 },
    ],
  },
  {
    rooms: [
      { key: 'open', type: 'open_space', polygon: rect(40, 40, 760, 500), team: 1 },
      { key: 'focus', type: 'other', polygon: rect(800, 40, 1160, 260) },
      { key: 'lounge', type: 'other', polygon: rect(40, 540, 1160, 760) },
      {
        key: 'meet',
        type: 'meeting',
        polygon: rect(800, 280, 1160, 500),
        name: 'Säntis',
        capacity: 6,
        equipment: ['screen', 'video', 'phone'],
      },
    ],
    markers: [
      { kind: 'stairs', x: 140, y: 650 },
      { kind: 'elevator', x: 260, y: 650 },
      { kind: 'printer', x: 680, y: 650 },
      { kind: 'coffee', x: 960, y: 650 },
      { kind: 'exit', x: 1110, y: 720 },
    ],
  },
];

/** Desk features by position (some standing desks, window seats, two screens). */
function features(row: number, col: number): SeatFeature[] {
  const out: SeatFeature[] = [];
  if (row === 0) out.push('window');
  if (col === 3) out.push('standing');
  if ((row + col) % 2 === 0) out.push('two_screens');
  if (row === 2 && col === 0) out.push('accessible');
  return out;
}

/**
 * Demo workspaces: a sample office (2 floors, meeting rooms, team zones, 22 people, history,
 * a draft move plan) that a visitor can change freely. The visitor is its admin, signed in by
 * a session for an address that can't receive e-mail (.invalid), so nothing is ever sent.
 */
@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);

  constructor(
    private readonly db: TenantDb,
    private readonly storage: StorageService,
  ) {}

  async create(language: MailLanguage) {
    if ((await this.db.countDemoTenants()) >= MAX_DEMO_WORKSPACES)
      throw new ServiceUnavailableException({
        message: 'Too many people are trying the demo right now. Please try again later.',
        code: 'demo_full',
      });
    const tenantId = randomUUID();
    const email = `demo-${tenantId.slice(0, 8)}@demo.seatline.invalid`;
    const t = TEXT[language];
    await this.db.run(tenantId, (tx) => this.fill(tx, tenantId, email, t, language));
    this.logger.log(`Demo workspace ${tenantId} created`);
    return { tenantId, email };
  }

  /** Nightly: delete demo workspaces older than a day, with their files (plan images). */
  async purge() {
    for (const id of await this.db.listOldDemoTenants(DEMO_LIFETIME))
      await this.storage.deletePrefix(`${id}/`);
    return this.db.purgeDemoTenants(DEMO_LIFETIME);
  }

  private async fill(
    tx: Tx,
    tenantId: string,
    email: string,
    t: (typeof TEXT)[MailLanguage],
    language: MailLanguage,
  ) {
    const now = Date.now();
    await tx.tenant.create({
      data: {
        id: tenantId,
        name: t.company,
        slug: `demo-${tenantId.slice(0, 8)}`,
        isDemo: true,
        notifyPeople: false,
        notifyLanguage: language,
        trialEndsAt: new Date(now + 2 * DAY),
        defaultAppRole: null,
      },
    });
    const admin = await tx.person.create({
      data: { tenantId, email, displayName: t.you, appRole: 'admin' },
    });
    const domain = 'example.invalid';
    const people = PEOPLE.map(([name, team, jobTitle]) => ({
      id: randomUUID(),
      tenantId,
      displayName: name,
      email: `${name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, '.')}@${domain}`,
      department: t.teams[team]!,
      jobTitle,
    }));
    await tx.person.createMany({ data: people });

    const building = await tx.building.create({
      data: { tenantId, name: t.building, address: 'Seestrasse 1, 8002 Zürich' },
    });
    const seats: Array<{ id: string; floor: number }> = [];
    const floorIds: string[] = [];
    for (const [i, spec] of FLOORS.entries()) {
      const level = i + 1;
      const floor = await tx.floor.create({
        data: {
          tenantId,
          buildingId: building.id,
          name: t.floor(level),
          level,
          planWidth: 1200,
          planHeight: 800,
          scale: 50,
        },
      });
      floorIds.push(floor.id);
      const roomIds = new Map<string, string>();
      for (const r of spec.rooms) {
        const room = await tx.room.create({
          data: {
            tenantId,
            floorId: floor.id,
            name:
              r.name ??
              (r.key === 'hall'
                ? t.hall
                : r.key === 'lounge'
                  ? t.lounge
                  : r.key === 'focus'
                    ? t.focus
                    : `${t.open}${r.team !== undefined ? ` ${t.teams[r.team]}` : ''}`),
            type: r.type,
            polygon: r.polygon,
            capacity: r.capacity ?? null,
            equipment: r.equipment ?? [],
            team: r.team !== undefined ? t.teams[r.team]! : null,
          },
        });
        roomIds.set(r.key, room.id);
      }
      // 3 rows × 4 desks in the open space
      const rows = [];
      for (let row = 0; row < 3; row++)
        for (let col = 0; col < 4; col++) {
          const id = randomUUID();
          seats.push({ id, floor: level });
          rows.push({
            id,
            tenantId,
            floorId: floor.id,
            roomId: roomIds.get('open')!,
            label: `${level}.${String(row * 4 + col + 1).padStart(2, '0')}`,
            x: 140 + col * 160,
            y: 130 + row * 150,
            rotation: row === 1 ? 180 : 0,
            features: features(row, col),
          });
        }
      // a quiet desk in the focus room
      if (roomIds.has('focus')) {
        const id = randomUUID();
        seats.push({ id, floor: level });
        rows.push({
          id,
          tenantId,
          floorId: floor.id,
          roomId: roomIds.get('focus')!,
          label: `${level}.13`,
          x: 980,
          y: 150,
          rotation: 0,
          features: ['quiet', 'standing'] as SeatFeature[],
        });
      }
      await tx.seat.createMany({ data: rows });
      await tx.floorMarker.createMany({
        data: spec.markers.map((m) => ({ tenantId, floorId: floor.id, ...m })),
      });
    }

    // seating: Sales and HR on floor 1, Engineering and Finance on floor 2
    const free = { 1: seats.filter((s) => s.floor === 1), 2: seats.filter((s) => s.floor === 2) };
    const take = (floor: 1 | 2) => free[floor].shift() ?? free[floor === 1 ? 2 : 1].shift();
    const assignments = [];
    for (const [i, p] of people.entries()) {
      if (i >= 19) continue; // a few people without a desk yet
      const team = PEOPLE[i]![1];
      const seat = take(team === 1 || team === 2 ? 2 : 1);
      if (!seat) break;
      assignments.push({
        id: randomUUID(),
        tenantId,
        seatId: seat.id,
        personId: p.id,
        kind: 'assigned' as const,
        startAt: new Date(now - (300 - i * 9) * DAY),
        assignedById: admin.id,
      });
    }
    // two people moved earlier, so there's history to look at
    const history = assignments.slice(0, 2).map((a, i) => {
      const old = (free[1].length ? free[1] : free[2]).pop()!;
      const movedAt = new Date(now - (20 + i * 15) * DAY);
      const before = {
        id: randomUUID(),
        tenantId,
        seatId: old.id,
        personId: a.personId,
        kind: 'assigned' as const,
        startAt: new Date(now - 400 * DAY),
        endAt: movedAt,
        assignedById: admin.id,
      };
      a.startAt = movedAt;
      free[old.floor as 1 | 2].push(old);
      return { before, after: a };
    });
    await tx.seatAssignment.createMany({ data: history.map((h) => h.before) });
    await tx.seatAssignment.createMany({
      data: assignments.map((a, i) => (i < 2 ? { ...a, note: t.moved } : a)),
    });
    const reserved = free[1].shift() ?? free[2].shift();
    if (reserved)
      await tx.seatAssignment.create({
        data: {
          tenantId,
          seatId: reserved.id,
          kind: 'reserved',
          reservedFor: t.reserved,
          startAt: new Date(now - 3 * DAY),
          assignedById: admin.id,
        },
      });
    const blocked = free[2].pop() ?? free[1].pop();
    if (blocked) await tx.seat.update({ where: { id: blocked.id }, data: { status: 'blocked' } });

    // the moves in the activity log
    for (const h of history)
      await audit(
        tx,
        { tenantId, actorId: admin.id },
        {
          action: 'assignment.move',
          entityType: 'seat_assignment',
          entityId: h.after.id,
          before: [{ ...h.before }],
          after: { ...h.after },
        },
      );

    // a draft move plan: the people without a desk get one
    const plan = await tx.movePlan.create({
      data: { tenantId, name: t.plan, createdById: admin.id },
    });
    const targets = [...free[1], ...free[2]];
    const items = people
      .slice(19)
      .slice(0, Math.min(2, targets.length))
      .map((p, i) => ({ tenantId, planId: plan.id, personId: p.id, toSeatId: targets[i]!.id }));
    if (items.length) await tx.movePlanItem.createMany({ data: items });

    // a few shared desks, booked by the day: two people without a desk have one today/tomorrow
    const shared = targets.slice(items.length, items.length + 4);
    if (shared.length) {
      await tx.seat.updateMany({
        where: { id: { in: shared.map((s) => s.id) } },
        data: { shared: true },
      });
      const today = zurichToday();
      const bookings = people.slice(19, 21).flatMap((p, i) =>
        shared[i]
          ? [
              {
                tenantId,
                seatId: shared[i].id,
                personId: p.id,
                day: new Date(`${i === 0 ? today : addDays(today, 1)}T00:00:00Z`),
                bookedById: p.id,
              },
            ]
          : [],
      );
      if (bookings.length) await tx.deskBooking.createMany({ data: bookings });
    }

    await audit(
      tx,
      { tenantId, actorId: admin.id },
      {
        action: 'tenant.create',
        entityType: 'tenant',
        entityId: tenantId,
        after: { name: t.company, demo: true, floors: floorIds.length },
      },
    );
  }
}
