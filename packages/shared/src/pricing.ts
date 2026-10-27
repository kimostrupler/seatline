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
