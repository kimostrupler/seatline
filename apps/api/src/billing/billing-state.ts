/**
 * What a workspace may do, from its trial and Stripe subscription:
 * - off: billing isn't configured (self-hosted/local) — everything works
 * - trial: within the free trial
 * - active: paid (Stripe "active"/"trialing")
 * - past_due: a payment failed; Stripe retries — everything still works, admins are warned
 * - read_only: trial over without a subscription, or the subscription ended/unpaid
 */
export type BillingState = 'off' | 'trial' | 'active' | 'past_due' | 'read_only';

export function billingState(input: {
  configured: boolean;
  trialEndsAt: Date;
  status: string | null;
  now?: Date;
}): BillingState {
  if (!input.configured) return 'off';
  if (input.status === 'active' || input.status === 'trialing') return 'active';
  if (input.status === 'past_due') return 'past_due';
  return input.trialEndsAt > (input.now ?? new Date()) ? 'trial' : 'read_only';
}
