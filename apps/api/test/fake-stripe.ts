import http from 'node:http';
import type { AddressInfo } from 'node:net';

export interface StripeCall {
  method: string;
  path: string;
  /** form fields as Stripe's SDK sends them, e.g. "line_items[0][quantity]" */
  body: Record<string, string>;
}

/** Just enough of Stripe's API for the billing tests (no network, no account). */
export async function startFakeStripe() {
  const calls: StripeCall[] = [];
  const quantities = new Map<string, number>();
  /** which price each subscription is on (tests may set an old one) */
  const prices = new Map<string, string>();
  /** what GET /v1/subscriptions/:id answers (tests set status, customer, metadata) */
  const subscriptions = new Map<string, Record<string, unknown>>();
  /** subscriptions Stripe answers "No such subscription" for */
  const missing = new Set<string>();
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c: Buffer) => (raw += c.toString()));
    req.on('end', () => {
      const body = Object.fromEntries(new URLSearchParams(raw));
      const path = (req.url ?? '').split('?')[0]!;
      calls.push({ method: req.method ?? '', path, body });
      const json = (data: object) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(data));
      };
      if (path === '/v1/customers') return json({ id: 'cus_test', object: 'customer' });
      if (path === '/v1/checkout/sessions')
        return json({
          id: 'cs_test',
          object: 'checkout.session',
          url: 'https://checkout.stripe.test/cs_test',
        });
      if (path === '/v1/billing_portal/sessions')
        return json({ id: 'bps_test', url: 'https://billing.stripe.test/session' });
      if (path.startsWith('/v1/prices/'))
        // the volume price: CHF 2 for desks 1–50, CHF 0.99 from the 51st
        return json({
          id: path.split('/').pop(),
          billing_scheme: 'tiered',
          tiers_mode: 'graduated',
          tiers: [
            { up_to: 50, unit_amount: 200 },
            { up_to: null, unit_amount: 99 },
          ],
          unit_amount: null,
          currency: 'chf',
          recurring: { interval: 'month' },
        });
      if (path.startsWith('/v1/subscriptions/')) {
        const id = path.split('/').pop()!;
        if (missing.has(id)) {
          res.writeHead(404, { 'content-type': 'application/json' });
          return res.end(
            JSON.stringify({
              error: {
                type: 'invalid_request_error',
                code: 'resource_missing',
                message: `No such subscription: '${id}'`,
              },
            }),
          );
        }
        if (req.method === 'POST') {
          quantities.set(id, Number(body['items[0][quantity]']));
          if (body['items[0][price]']) prices.set(id, body['items[0][price]']);
        }
        return json({
          id,
          object: 'subscription',
          status: 'active',
          customer: 'cus_test',
          ...subscriptions.get(id),
          items: {
            data: [
              {
                id: 'si_test',
                quantity: quantities.get(id) ?? 3,
                price: { id: prices.get(id) ?? 'price_test' },
              },
            ],
          },
        });
      }
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: `fake stripe: no ${path}` } }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://localhost:${port}`,
    calls,
    subscriptions,
    missing,
    prices,
    close: () => server.close(),
  };
}
