/**
 * Demo data for local development: two fictional companies, so tenant isolation is
 * visible from day one. Safe to re-run — tenants that already exist are skipped.
 *
 * Runs as the owner connection (DATABASE_URL) but still sets app.tenant_id per tenant,
 * so it also works where the owner is subject to RLS (Azure).
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import { DEMO_TENANTS, type DemoTenant as DemoIds } from '@seatline/shared';

type Tx = Prisma.TransactionClient;

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;

interface DemoTenant {
  id: string;
  adminId: string;
  /** fixed ids for the first two people: the demo editor and viewer */
  editorId: string;
  viewerId: string;
  name: string;
  slug: string;
  domain: string;
  building: { name: string; address: string };
  people: Array<[name: string, department: string, jobTitle: string]>;
}

/** Fixed ids (shared with the web dev login) so headers stay valid after every reset. */
const [alpenblick, seeblick] = DEMO_TENANTS as [DemoIds, DemoIds];
const ids = (t: DemoIds) => ({
  id: t.id,
  adminId: t.users[0].id,
  editorId: t.users[1].id,
  viewerId: t.users[2].id,
  name: t.name,
});

const TENANTS: DemoTenant[] = [
  {
    ...ids(alpenblick),
    slug: 'alpenblick',
    domain: 'alpenblick.example',
    building: { name: 'Hauptsitz Zürich', address: 'Seestrasse 1, 8000 Zürich' },
    people: [
      ['Anna Meier', 'Finance', 'CFO'],
      ['Luca Rossi', 'Engineering', 'Software Engineer'],
      ['Sophie Keller', 'Engineering', 'Engineering Manager'],
      ['Marc Dubois', 'Sales', 'Account Executive'],
      ['Elena Brunner', 'HR', 'HR Partner'],
      ['Noah Huber', 'Engineering', 'Designer'],
      ['Mia Schmid', 'Sales', 'Sales Lead'],
      ['Jonas Weber', 'Finance', 'Controller'],
    ],
  },
  {
    ...ids(seeblick),
    slug: 'seeblick',
    domain: 'seeblick.example',
    building: { name: 'Büro Bern', address: 'Bundesgasse 2, 3000 Bern' },
    people: [
      ['Laura Graf', 'Operations', 'COO'],
      ['David Frei', 'Support', 'Support Specialist'],
      ['Chiara Bianchi', 'Support', 'Team Lead'],
      ['Tim Baumann', 'Operations', 'Facility Manager'],
    ],
  },
];

async function withTenant<T>(tenantId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx);
  });
}

function emailFor(name: string, domain: string) {
  return `${name.toLowerCase().replace(/\s+/g, '.')}@${domain}`;
}

async function seedTenant(t: DemoTenant) {
  await withTenant(t.id, async (tx) => {
    if (await tx.tenant.findUnique({ where: { id: t.id } })) {
      console.log(`- ${t.name}: already there, skipped`);
      return;
    }
    await tx.tenant.create({ data: { id: t.id, name: t.name, slug: t.slug } });

    const admin = await tx.person.create({
      data: {
        id: t.adminId,
        tenantId: t.id,
        email: `admin@${t.domain}`,
        displayName: `${t.name} Admin`,
        appRole: 'admin',
      },
    });
    const people = [];
    for (const [i, [displayName, department, jobTitle]] of t.people.entries()) {
      people.push(
        await tx.person.create({
          data: {
            id: i === 0 ? t.editorId : i === 1 ? t.viewerId : undefined,
            tenantId: t.id,
            email: emailFor(displayName, t.domain),
            displayName,
            department,
            jobTitle,
            // a couple of app users per tenant, everyone else just has a seat
            appRole: i === 0 ? 'editor' : i === 1 ? 'viewer' : null,
          },
        }),
      );
    }

    const building = await tx.building.create({ data: { tenantId: t.id, ...t.building } });
    const seats = [];
    for (const level of [1, 2]) {
      const floor = await tx.floor.create({
        data: {
          tenantId: t.id,
          buildingId: building.id,
          name: `${level}. OG`,
          level,
          planWidth: 1200,
          planHeight: 800,
          scale: 50,
        },
      });
      const openSpace = await tx.room.create({
        data: {
          tenantId: t.id,
          floorId: floor.id,
          name: 'Open Space',
          type: 'open_space',
          polygon: [
            { x: 50, y: 50 },
            { x: 750, y: 50 },
            { x: 750, y: 450 },
            { x: 50, y: 450 },
          ],
        },
      });
      await tx.room.create({
        data: {
          tenantId: t.id,
          floorId: floor.id,
          name: 'Meeting Rigi',
          type: 'meeting',
          polygon: [
            { x: 800, y: 50 },
            { x: 1150, y: 50 },
            { x: 1150, y: 300 },
            { x: 800, y: 300 },
          ],
        },
      });
      // 2 rows x 4 desks in the open space
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 4; col++) {
          seats.push(
            await tx.seat.create({
              data: {
                tenantId: t.id,
                floorId: floor.id,
                roomId: openSpace.id,
                label: `${level}.${String(row * 4 + col + 1).padStart(2, '0')}`,
                x: 150 + col * 160,
                y: 150 + row * 200,
                rotation: row === 0 ? 0 : 180,
              },
            }),
          );
        }
      }
    }

    // Seat most people; the first person moved once, so there is history to look at.
    const now = Date.now();
    const [first, ...rest] = people;
    if (first && seats[7] && seats[0]) {
      const movedAt = new Date(now - 30 * DAY);
      await tx.seatAssignment.create({
        data: {
          tenantId: t.id,
          seatId: seats[7].id,
          personId: first.id,
          kind: 'assigned',
          startAt: new Date(now - 400 * DAY),
          endAt: movedAt,
          assignedById: admin.id,
          note: 'Initial seating',
        },
      });
      await tx.seatAssignment.create({
        data: {
          tenantId: t.id,
          seatId: seats[0].id,
          personId: first.id,
          kind: 'assigned',
          startAt: movedAt,
          assignedById: admin.id,
          note: 'Moved closer to the team',
        },
      });
    }
    for (const [i, person] of rest.entries()) {
      const seat = seats[i + 1];
      if (!seat || i % 3 === 2) continue; // leave some people without a seat
      await tx.seatAssignment.create({
        data: {
          tenantId: t.id,
          seatId: seat.id,
          personId: person.id,
          kind: 'assigned',
          startAt: new Date(now - (200 - i * 10) * DAY),
          assignedById: admin.id,
        },
      });
    }
    const reserved = seats[seats.length - 1];
    if (reserved) {
      await tx.seatAssignment.create({
        data: {
          tenantId: t.id,
          seatId: reserved.id,
          kind: 'reserved',
          reservedFor: 'New hire (starts next month)',
          assignedById: admin.id,
        },
      });
    }
    await tx.seat.update({
      where: { id: seats[seats.length - 2]!.id },
      data: { status: 'blocked' },
    });

    await tx.auditLog.create({
      data: { tenantId: t.id, action: 'tenant.seed', entityType: 'tenant', entityId: t.id },
    });
    console.log(`- ${t.name}: ${people.length + 1} people, ${seats.length} seats`);
  });
}

async function main() {
  console.log('Seeding demo data…');
  for (const t of TENANTS) await seedTenant(t);
  console.log('\nTry the API as an admin, e.g.:');
  const t = TENANTS[0]!;
  console.log(
    `  curl localhost:3001/buildings -H "x-tenant-id: ${t.id}" -H "x-user-id: ${t.adminId}"`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
