import { expect, test } from '@playwright/test';

test('the landing page links to sign-in, help and the legal pages', async ({ page }) => {
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { level: 1, name: 'Know who sits where.' })).toBeVisible();
  await expect(page.getByText('CHF 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ready in an afternoon' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Everyone in the loop' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Try it free for 30 days' }).first()).toHaveAttribute(
    'href',
    /\/signin$/,
  );
  await expect(page.getByRole('link', { name: 'Help', exact: true }).first()).toHaveAttribute(
    'href',
    '/help/en',
  );

  // the live floor: a free desk goes to the first person waiting, and back with Undo
  await page.getByRole('button', { name: 'Desk 1.02, free — give it to Chloé Martin' }).click();
  await expect(page.getByText('Chloé Martin → desk 1.02, since today')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Desk 1.02, Chloé Martin' })).toBeDisabled();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(
    page.getByRole('button', { name: 'Desk 1.02, free — give it to Chloé Martin' }),
  ).toBeEnabled();

  // the notice e-mail follows the chosen language
  await page.getByRole('radio', { name: 'DE' }).click();
  await expect(page.getByText(/Umzugsplan «Verkauf in den 2\. Stock» ausgeführt/)).toBeVisible();

  await page.getByRole('link', { name: 'Privacy policy' }).click();
  await expect(page.getByRole('heading', { name: 'Privacy policy' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '5. Where your data is stored' })).toBeVisible();
});

test('legal pages follow the chosen language', async ({ page, context }) => {
  await context.addCookies([{ name: 'seatline-language', value: 'de', url: 'http://localhost' }]);
  await page.goto('/legal/terms');
  await expect(page.getByRole('heading', { name: 'Nutzungsbedingungen' })).toBeVisible();
  await page.goto('/legal/imprint');
  await expect(page.getByRole('heading', { name: 'Impressum' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'hello@seatline.ch' }).first()).toBeVisible();
});

test('pages are sent with security headers', async ({ request }) => {
  const res = await request.get('/welcome');
  const headers = res.headers();
  expect(headers['content-security-policy']).toContain("default-src 'self'");
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['strict-transport-security']).toContain('max-age=');
  expect(headers['x-powered-by']).toBeUndefined();
});

test('health check for the uptime monitor; website visits are counted anonymously', async ({
  request,
}) => {
  const health = await request.get('/healthz');
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ ok: true });
  const visit = await request.post('/site-visit', {
    data: { event: 'view', path: '/', lang: 'de' },
  });
  expect(visit.status()).toBe(204);
  expect(visit.headers()['set-cookie']).toBeUndefined();
});

test('search engines: a page per language, structured data, llms.txt', async ({
  page,
  request,
}) => {
  await page.goto('/de');
  await expect(page.getByRole('heading', { name: 'Freie Plätze finden' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Hilfe', exact: true }).first()).toHaveAttribute(
    'href',
    '/help/de',
  );
  await expect(page.locator('html')).toHaveAttribute('lang', 'de-CH');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/de$/);
  await expect(page.locator('link[rel="alternate"][hreflang="fr"]')).toHaveAttribute(
    'href',
    /\/fr$/,
  );
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(ld['@graph'].map((x: { '@type': string }) => x['@type'])).toContain('FAQPage');
  await page.getByRole('link', { name: 'FR', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Trouver un poste libre' })).toBeVisible();

  const llms = await request.get('/llms.txt');
  expect(await llms.text()).toContain('# Seatline');
  expect((await request.get('/og-image')).headers()['content-type']).toBe('image/png');
  // the logo as the browser tab icon, also for browsers that only ask for /favicon.ico
  expect((await request.get('/favicon.ico')).ok()).toBe(true);
  expect((await request.get('/icon.svg')).ok()).toBe(true);
});
