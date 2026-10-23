import { Injectable } from '@nestjs/common';
import type { MailLanguage } from '@seatline/shared';
import { TenantDb } from '../db/tenant-db.service';
import { MailService } from './mail.service';
import { onboardingMail } from './texts';

/** Which onboarding e-mail is due on this day after sign-up (1, 3, 7), or null; each once. */
export function onboardingDue(day: number, sent: number): 1 | 3 | 7 | null {
  const due = ([7, 3, 1] as const).find((d) => d <= day);
  return due && due > sent ? due : null;
}

/**
 * Nightly: short tips to a new workspace's admins on day 1 (draw a floor), 3 (add people) and
 * 7 (need help?). A tip for a step already done is skipped quietly.
 */
@Injectable()
export class OnboardingService {
  constructor(
    private readonly db: TenantDb,
    private readonly mail: MailService,
  ) {}

  /** Returns the day whose e-mail went out, or null. */
  async send(tenantId: string, now = new Date()): Promise<1 | 3 | 7 | null> {
    if (!this.mail.configured) return null;
    const { tenant, admins, seats, people } = await this.db.run(tenantId, async (tx) => ({
      tenant: await tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { name: true, createdAt: true, onboardingSent: true, notifyLanguage: true },
      }),
      admins: await tx.person.findMany({
        where: { tenantId, appRole: 'admin', active: true, forgottenAt: null },
        select: { email: true },
      }),
      seats: await tx.seat.count({ where: { tenantId } }),
      people: await tx.person.count({ where: { tenantId, active: true } }),
    }));
    const day = Math.floor((now.getTime() - tenant.createdAt.getTime()) / 86_400_000);
    const due = onboardingDue(day, tenant.onboardingSent);
    if (!due) return null;
    const language = tenant.notifyLanguage as MailLanguage;
    const done = (due === 1 && seats > 0) || (due === 3 && people > 1);
    const path = { 1: '/map', 3: '/people', 7: `/help/${language}` }[due];
    if (!done)
      for (const admin of admins)
        await this.mail.send(
          onboardingMail(admin.email, tenant.name, due, this.mail.appUrl + path, language),
        );
    await this.db.run(tenantId, (tx) =>
      tx.tenant.update({ where: { id: tenantId }, data: { onboardingSent: due } }),
    );
    return done || !admins.length ? null : due;
  }
}
