import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { appDb, asApp, createTenant, owner, resetDb, type Fixture } from './helpers';

/** The database itself enforces the history rules, whatever the API code does. */
let t: Fixture;

beforeEach(async () => {
  await resetDb();
  t = await createTenant('rules');
});
afterAll(async () => {
  await Promise.all([owner.$disconnect(), appDb.$disconnect()]);
});

const openAssignment = (seatId: string, personId: string) =>
  asApp(t.tenantId, (tx) =>
    tx.seatAssignment.create({
      data: { tenantId: t.tenantId, seatId, personId, kind: 'assigned', assignedById: t.adminId },
    }),
  );

describe('one open assignment per seat and per person', () => {
  it('blocks a second open assignment on the same seat', async () => {
    await openAssignment(t.seatIds[0], t.personIds[0]);
    await expect(openAssignment(t.seatIds[0], t.personIds[1])).rejects.toThrow(/unique/i);
  });

  it('blocks a second open seat for the same person', async () => {
    await openAssignment(t.seatIds[0], t.personIds[0]);
    await expect(openAssignment(t.seatIds[1], t.personIds[0])).rejects.toThrow(/unique/i);
  });

  it('allows any number of closed (history) rows', async () => {
    const a = await openAssignment(t.seatIds[0], t.personIds[0]);
    await asApp(t.tenantId, (tx) =>
      tx.seatAssignment.update({ where: { id: a.id }, data: { endAt: new Date() } }),
    );
    await openAssignment(t.seatIds[0], t.personIds[0]);
  });
});

describe('history is append-only', () => {
  it('a closed assignment can never change again', async () => {
    const a = await openAssignment(t.seatIds[0], t.personIds[0]);
    await asApp(t.tenantId, (tx) =>
      tx.seatAssignment.update({ where: { id: a.id }, data: { endAt: new Date() } }),
    );
    await expect(
      asApp(t.tenantId, (tx) =>
        tx.seatAssignment.update({ where: { id: a.id }, data: { endAt: new Date(0) } }),
      ),
    ).rejects.toThrow(/append-only/);
  });

  it('an open assignment can only be closed — not edited', async () => {
    const a = await openAssignment(t.seatIds[0], t.personIds[0]);
    await expect(
      asApp(t.tenantId, (tx) =>
        tx.seatAssignment.update({ where: { id: a.id }, data: { personId: t.personIds[1] } }),
      ),
    ).rejects.toThrow(/append-only/);
  });

  it('assignments cannot be deleted', async () => {
    const a = await openAssignment(t.seatIds[0], t.personIds[0]);
    await expect(
      asApp(t.tenantId, (tx) => tx.seatAssignment.delete({ where: { id: a.id } })),
    ).rejects.toThrow(/permission denied/i);
    // not even by the owner
    await expect(owner.seatAssignment.delete({ where: { id: a.id } })).rejects.toThrow(
      /append-only/,
    );
  });

  it('the audit log cannot be edited or deleted', async () => {
    const entry = await asApp(t.tenantId, (tx) =>
      tx.auditLog.create({
        data: { tenantId: t.tenantId, action: 'test', entityType: 'test', entityId: t.tenantId },
      }),
    );
    await expect(
      asApp(t.tenantId, (tx) =>
        tx.auditLog.update({ where: { id: entry.id }, data: { action: 'changed' } }),
      ),
    ).rejects.toThrow(/permission denied/i);
    await expect(owner.auditLog.delete({ where: { id: entry.id } })).rejects.toThrow(/append-only/);
  });
});

describe('assignment shape', () => {
  it('an assigned row needs a person; a reservation must not have one', async () => {
    await expect(
      asApp(t.tenantId, (tx) =>
        tx.seatAssignment.create({
          data: {
            tenantId: t.tenantId,
            seatId: t.seatIds[0],
            kind: 'assigned',
            assignedById: t.adminId,
          },
        }),
      ),
    ).rejects.toThrow(/kind_check/);
    await expect(
      asApp(t.tenantId, (tx) =>
        tx.seatAssignment.create({
          data: {
            tenantId: t.tenantId,
            seatId: t.seatIds[0],
            personId: t.personIds[0],
            kind: 'reserved',
            reservedFor: 'x',
            assignedById: t.adminId,
          },
        }),
      ),
    ).rejects.toThrow(/kind_check/);
  });
});
