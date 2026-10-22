import { Injectable, Logger } from '@nestjs/common';
import type { MailLanguage, NotifyEvent } from '@seatline/shared';
import type { Tx } from '../db/tenant-db.service';
import { TenantDb } from '../db/tenant-db.service';
import { MailService } from './mail.service';
import { noticeEvent, noticeMail, type Notice, type SeatRef } from './notices';

/**
 * E-mail notices about changes (someone leaves and their desk is free, joins, changes team,
 * a move plan was carried out) to the addresses a workspace chose — IT, facility management.
 * Sent after the change is saved; a failed e-mail never undoes the change.
 */
@Injectable()
export class NotifyService {
  private readonly logger = new Logger(NotifyService.name);

  constructor(
    private readonly db: TenantDb,
    private readonly mail: MailService,
  ) {}

  async send(tenantId: string, notices: Notice[]): Promise<void> {
    if (!notices.length || !this.mail.configured) return;
    try {
      const tenant = await this.db.run(tenantId, (tx) =>
        tx.tenant.findUniqueOrThrow({
          where: { id: tenantId },
          select: { name: true, notifyEmails: true, notifyEvents: true, notifyLanguage: true },
        }),
      );
      const wanted = notices.filter((n) =>
        tenant.notifyEvents.includes(noticeEvent(n) satisfies NotifyEvent),
      );
      if (!wanted.length || !tenant.notifyEmails.length) return;
      const mail = noticeMail(
        tenant.name,
        wanted,
        tenant.notifyLanguage as MailLanguage,
        this.mail.appUrl,
      );
      await this.mail.send({ to: tenant.notifyEmails.join(', '), ...mail });
    } catch (error) {
      this.logger.error(`A notice e-mail could not be sent: ${(error as Error).message}`);
    }
  }
}

/** The open seats of these people, written out for a notice (before they are freed). */
export async function openSeats(
  tx: Tx,
  tenantId: string,
  personIds: string[],
): Promise<Map<string, SeatRef[]>> {
  const rows = await tx.seatAssignment.findMany({
    where: { tenantId, personId: { in: personIds }, endAt: null },
    select: {
      personId: true,
      seat: {
        select: {
          label: true,
          floor: { select: { name: true, building: { select: { name: true } } } },
        },
      },
    },
  });
  const out = new Map<string, SeatRef[]>();
  for (const r of rows) {
    const list = out.get(r.personId!) ?? [];
    list.push({
      label: r.seat.label,
      place: `${r.seat.floor.building.name} › ${r.seat.floor.name}`,
    });
    out.set(r.personId!, list);
  }
  return out;
}
