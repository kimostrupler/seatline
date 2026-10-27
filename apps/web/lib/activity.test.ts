import { describe as group, expect, it } from 'vitest';
import { describe, linkHref } from './activity';
import type { ActivityEntry, ActivityRefs } from './types';

const refs: ActivityRefs = {
  people: { p1: { displayName: 'Anna Meier' }, admin: { displayName: 'Admin' } },
  seats: { s1: { label: '1.01', floorId: 'f1' }, s2: { label: '1.02', floorId: 'f1' } },
  rooms: { r1: { name: 'Focus', floorId: 'f1' } },
  floors: { f1: { name: '1. OG', buildingId: 'b1' } },
  buildings: { b1: { name: 'HQ' } },
};
const entry = (e: Partial<ActivityEntry>): ActivityEntry => ({
  id: 'e',
  createdAt: '2026-10-21T10:00:00Z',
  actorId: 'admin',
  action: 'x',
  entityType: 'seat',
  entityId: 's1',
  before: null,
  after: null,
  ...e,
});

group('activity sentences', () => {
  it('assignments name the person and seat and link to the seat', () => {
    const d = describe(
      entry({ action: 'assignment.create', after: { seatId: 's1', personId: 'p1' } }),
      refs,
      '?',
    );
    expect(d).toEqual({
      key: 'assigned',
      values: { person: 'Anna Meier', seat: '1.01' },
      link: { building: 'b1', floor: 'f1', seat: 's1' },
    });
    expect(linkHref(d.link!)).toBe('/map?building=b1&floor=f1&seat=s1');
  });

  it('a move names where the person came from', () => {
    const d = describe(
      entry({
        action: 'assignment.move',
        before: [{ seatId: 's1', personId: 'p1' }],
        after: { seatId: 's2', personId: 'p1' },
      }),
      refs,
      '?',
    );
    expect(d.values).toEqual({ person: 'Anna Meier', from: '1.01', to: '1.02' });
  });

  it('ending: freed, reservation cancelled, or left the organisation (sync)', () => {
    const end = (before: object, actorId: string | null) =>
      describe(entry({ action: 'assignment.end', actorId, before, after: before }), refs, '?').key;
    expect(end({ seatId: 's1', personId: 'p1', kind: 'assigned' }, 'admin')).toBe('freed');
    expect(end({ seatId: 's1', kind: 'reserved', reservedFor: 'X' }, 'admin')).toBe(
      'reservationCancelled',
    );
    expect(end({ seatId: 's1', personId: 'p1', kind: 'assigned' }, null)).toBe('leftOrganisation');
  });

  it('layout changes say what changed; removed things use their snapshot', () => {
    const upd = (before: object, after: object) =>
      describe(entry({ action: 'layout.seat.update', before, after }), refs, '?');
    expect(upd({ label: '1.00' }, { label: '1.01' })).toMatchObject({
      key: 'seatRenamed',
      values: { seat: '1.01', old: '1.00' },
    });
    expect(upd({ status: 'active', x: 1 }, { status: 'blocked', x: 1 }).key).toBe('seatBlocked');
    expect(upd({ x: 1, y: 2 }, { x: 5, y: 2 }).key).toBe('seatMoved');

    const removed = describe(
      entry({
        action: 'layout.room.delete',
        entityId: 'gone',
        before: { name: 'Old', floorId: 'f1' },
      }),
      refs,
      '?',
    );
    expect(removed).toMatchObject({ key: 'roomRemoved', values: { room: 'Old' } });
  });

  it('bookings name the desk, the person and the day', () => {
    const booked = describe(
      entry({
        action: 'booking.create',
        after: { personId: 'p1', day: '2026-11-03', label: '1.01' },
      }),
      refs,
      '?',
    );
    expect(booked).toMatchObject({
      key: 'deskBooked',
      values: { seat: '1.01', person: 'Anna Meier', day: '2026-11-03' },
      link: { seat: 's1' },
    });
    expect(
      describe(
        entry({
          action: 'booking.cancel',
          actorId: null,
          before: { personId: 'p1', day: '2026-11-03' },
          after: { reason: 'left' },
        }),
        refs,
        '?',
      ).key,
    ).toBe('bookingCancelledLeft');
    expect(
      describe(
        entry({ action: 'seat.update', before: { shared: false }, after: { shared: true } }),
        refs,
        '?',
      ).key,
    ).toBe('seatShared');
  });

  it('unknown names and actions still read sensibly', () => {
    expect(
      describe(
        entry({ action: 'assignment.create', after: { seatId: 'x', personId: 'y' } }),
        refs,
        '?',
      ).values,
    ).toEqual({ person: '?', seat: '?' });
    expect(describe(entry({ action: 'something.new' }), refs, '?')).toMatchObject({ key: 'other' });
  });

  it('team changes name the person and the team', () => {
    const set = describe(
      entry({
        action: 'person.team',
        entityType: 'person',
        entityId: 'p1',
        after: { department: 'Finance' },
      }),
      refs,
      '?',
    );
    expect(set).toMatchObject({
      key: 'teamChanged',
      values: { person: 'Anna Meier', team: 'Finance' },
    });
    const removed = describe(
      entry({
        action: 'person.team',
        entityType: 'person',
        entityId: 'p1',
        after: { department: null },
      }),
      refs,
      '?',
    );
    expect(removed.key).toBe('teamRemoved');
  });
  it('outreach steps name the company (the operator’s leads)', () => {
    const lead = (action: string) =>
      describe(entry({ action, entityType: 'lead', after: { company: 'Livingdocs' } }), refs, '?');
    expect(lead('owner.lead.schedule')).toEqual({
      key: 'leadScheduled',
      values: { name: 'Livingdocs' },
    });
    expect(lead('owner.lead.replied').key).toBe('leadReplied');
    expect(
      describe(
        entry({ action: 'owner.lead.delete', entityType: 'lead', before: { company: 'X' } }),
        refs,
        '?',
      ).values,
    ).toEqual({ name: 'X' });
  });
});
