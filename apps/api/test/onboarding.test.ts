import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TenantDb } from '../src/db/tenant-db.service';
import { OnboardingService, onboardingDue } from '../src/mail/onboarding.service';
import { clearMails, sentMails } from './mail';
import { appDb, createApp, createTenant, owner, resetDb, type Fixture } from './helpers';

let app: INestApplication;
let a: Fixture;
let b: Fixture;

beforeAll(async () => {
  app = await createApp();
});
afterAll(async () => {
  await app.close();
  await Promise.all([owner.$disconnect(), appDb.$disconnect()]);
});
beforeEach(async () => {
  await resetDb();
  await clearMails();
  a = await createTenant('alpha');
  b = await createTenant('beta');
});

const signedUp = (f: Fixture, daysAgo: number) =>
  owner.tenant.update({
    where: { id: f.tenantId },
    data: { createdAt: new Date(Date.now() - daysAgo * 86_400_000 - 60_000) },
  });

describe('onboarding e-mails', () => {
  it('picks the e-mail of the day, each once', () => {
    expect(onboardingDue(0, 0)).toBeNull();
    expect(onboardingDue(1, 0)).toBe(1);
    expect(onboardingDue(2, 1)).toBeNull();
    expect(onboardingDue(3, 1)).toBe(3);
    expect(onboardingDue(5, 0)).toBe(3); // missed nights: only the latest
    expect(onboardingDue(9, 3)).toBe(7);
    expect(onboardingDue(9, 7)).toBeNull();
  });

  it('sends day 1, 3 and 7 to the admins, skipping steps already done', async () => {
    const onboarding = app.get(OnboardingService);
    await owner.seat.deleteMany({ where: { tenantId: b.tenantId } });
    await owner.person.deleteMany({
      where: { tenantId: b.tenantId, OR: [{ appRole: null }, { appRole: { not: 'admin' } }] },
    });
    await signedUp(b, 1);
    expect(await app.get(TenantDb).listOnboardingTenants()).toContain(b.tenantId);
    expect(await onboarding.send(b.tenantId)).toBe(1);
    expect(await onboarding.send(b.tenantId)).toBeNull(); // only once
    await signedUp(b, 3);
    expect(await onboarding.send(b.tenantId)).toBe(3);
    await signedUp(b, 7);
    expect(await onboarding.send(b.tenantId)).toBe(7);
    const mails = await sentMails();
    expect(mails.map((m) => m.to)).toEqual(Array(3).fill('admin@beta.example'));
    expect(mails[0]!.text).toContain('https://app.seatline.test/map');
    expect(mails[1]!.text).toContain('https://app.seatline.test/people');
    expect(mails[2]!.text).toMatch(/https:\/\/app\.seatline\.test\/help\/(en|de|fr)/);
    // done with all three: no longer listed
    expect(await app.get(TenantDb).listOnboardingTenants()).not.toContain(b.tenantId);

    // alpha already has desks and people: the tips for days 1 and 3 are skipped
    await signedUp(a, 3);
    expect(await onboarding.send(a.tenantId)).toBeNull();
    expect(
      (await owner.tenant.findUniqueOrThrow({ where: { id: a.tenantId } })).onboardingSent,
    ).toBe(3);
    expect(await sentMails()).toHaveLength(3);
  });

  it('leaves older workspaces alone', async () => {
    await signedUp(a, 30);
    expect(await app.get(TenantDb).listOnboardingTenants()).not.toContain(a.tenantId);
  });
});
