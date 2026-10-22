import { describe, expect, it } from 'vitest';
import { trialReminderDue } from './billing.service';

describe('trial reminders', () => {
  it('7 days before, then the day before, each once', () => {
    expect(trialReminderDue(9, null)).toBeNull();
    expect(trialReminderDue(7, null)).toBe(7);
    expect(trialReminderDue(5, 7)).toBeNull();
    expect(trialReminderDue(1, 7)).toBe(1);
    expect(trialReminderDue(1, 1)).toBeNull();
    // a workspace that starts its last week late still gets the last reminder
    expect(trialReminderDue(1, null)).toBe(1);
    expect(trialReminderDue(0, null)).toBeNull();
  });
});
