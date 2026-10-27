/**
 * Seatline's price per active desk per month (CHF), graduated: the first 50 desks cost CHF 2,
 * every desk from the 51st CHF 0.99. A desk more never makes the bill smaller. Stripe holds the
 * real price (a graduated tiered price, infra/azure/stripe-setup.sh); this is what the website
 * shows and the shape the Billing page gets.
 */
export interface PriceTier {
  /** last desk at this price; null = all the rest */
  upTo: number | null;
  /** per desk per month, in francs */
  amount: number;
}

export const PRICE_TIERS: PriceTier[] = [
  { upTo: 50, amount: 2 },
  { upTo: null, amount: 0.99 },
];

/** What `seats` desks cost per month, tier by tier (rounded to the centime). */
export function monthlyPrice(seats: number, tiers: PriceTier[] = PRICE_TIERS): number {
  let total = 0;
  let from = 0;
  for (const tier of tiers) {
    const to = tier.upTo ?? Infinity;
    if (seats > from) total += (Math.min(seats, to) - from) * tier.amount;
    from = to;
  }
  return Math.round(total * 100) / 100;
}

/**
 * What typical desk / workplace tools charge for the same number of desks, for the landing
 * page's comparison (never named on the website). Public list prices checked October 2026,
 * converted roughly 1:1 from USD/EUR to CHF:
 * - most tools: about 2.50–5 per desk or user per month, often with a 25-user minimum
 *   (yarooms.com/blog/desk-booking-software-pricing, archieapp.co/blog/desk-booking-software-pricing)
 * - e.g. 2.75–3.50 per user (deskbird), 1.99–2.49 per person (getjoan.com), about 5 per user
 *   (Envoy, TrustRadius), 2.80 per desk with a 159 monthly minimum (Archie)
 * Real offers differ by product, user count and contract; the page says so.
 */
export const TYPICAL_TOOL = { low: 2.5, high: 5, minimumUsers: 25 };

/** The typical tools' monthly range for `seats` desks (CHF, minimum users counted). */
export function typicalToolPrice(seats: number): { low: number; high: number } {
  const billed = Math.max(seats, TYPICAL_TOOL.minimumUsers);
  return { low: billed * TYPICAL_TOOL.low, high: billed * TYPICAL_TOOL.high };
}
