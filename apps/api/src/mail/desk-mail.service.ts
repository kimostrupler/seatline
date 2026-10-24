import { Injectable, Logger } from '@nestjs/common';
import type { MailLanguage } from '@seatline/shared';
import { TenantDb } from '../db/tenant-db.service';
import { MailService } from './mail.service';
import { deskMail } from './texts';

const UNDO_WINDOW_MS = 15 * 60_000;

/**
 * "Your new desk" e-mails to the people who got one (if the workspace has it on). Sent a
 * little after the change by the job queue: an assignment that has meanwhile ended (undo,
 * moved again) gets no e-mail, nor does someone who is back on the desk they just had.
 */
@Injectable()
export class DeskMailService {
  private readonly logger = new Logger(DeskMailService.name);

  constructor(
    private readonly db: TenantDb,
    private readonly mail: MailService,
  ) {}

  async send(tenantId: string, assignmentIds: string[]): Promise<number> {
    if (!assignmentIds.length || !this.mail.configured) return 0;
    const { tenant, rows } = await this.db.run(tenantId, async (tx) => ({
      tenant: await tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { notifyPeople: true, notifyLanguage: true },
      }),
      rows: await tx.seatAssignment.findMany({
        where: { tenantId, id: { in: assignmentIds }, endAt: null, kind: 'assigned' },
        select: {
          personId: true,
          startAt: true,
          person: {
            select: {
              displayName: true,
              email: true,
              active: true,
              forgottenAt: true,
              appRole: true,
            },
          },
          seat: {
            select: {
              id: true,
              label: true,
              room: { select: { name: true } },
              floor: {
                select: { id: true, name: true, building: { select: { id: true, name: true } } },
              },
            },
          },
        },
      }),
    }));
    if (!tenant.notifyPeople) return 0;
    let sent = 0;
    for (const { personId, startAt, person, seat } of rows) {
      if (!person?.active || person.forgottenAt || !person.email) continue;
      // a link only for people who can open Seatline
      const link = person.appRole
        ? `${this.mail.appUrl}/map?building=${seat.floor.building.id}&floor=${seat.floor.id}&seat=${seat.id}`
        : null;
      try {
        // back on the desk they had a few minutes ago (an undo): nothing changed for them
        const back = await this.db.run(tenantId, (tx) =>
          tx.seatAssignment.findFirst({
            where: {
              tenantId,
              personId,
              seatId: seat.id,
              endAt: { gte: new Date(startAt.getTime() - UNDO_WINDOW_MS), lte: startAt },
            },
            select: { id: true },
          }),
        );
        if (back) continue;
        await this.mail.send(
          deskMail(
            person.email,
            person.displayName,
            {
              label: seat.label,
              place: `${seat.floor.building.name} › ${seat.floor.name}`,
              room: seat.room?.name ?? null,
            },
            link,
            tenant.notifyLanguage as MailLanguage,
          ),
        );
        sent++;
      } catch (error) {
        this.logger.error(`A desk e-mail could not be sent: ${(error as Error).message}`);
      }
    }
    return sent;
  }
}
