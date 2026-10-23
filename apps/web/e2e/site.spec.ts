import { expect, test } from '@playwright/test';

test('the landing page links to sign-in and the legal pages', async ({ page }) => {
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: 'Know who sits where.' })).toBeVisible();
  await expect(page.getByText('CHF 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ready in an afternoon' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'E-mails to IT' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Try it free for 30 days' }).first()).toHaveAttribute(
    'href',
    /\/signin$/,
  );
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
  await expect(page.getByRole('heading', { name: 'Wissen, wer wo sitzt.' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de-CH');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/de$/);
  await expect(page.locator('link[rel="alternate"][hreflang="fr"]')).toHaveAttribute(
    'href',
    /\/fr$/,
  );
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(ld['@graph'].map((x: { '@type': string }) => x['@type'])).toContain('FAQPage');
  await page.getByRole('link', { name: 'FR', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Savoir qui est assis où.' })).toBeVisible();

  const llms = await request.get('/llms.txt');
  expect(await llms.text()).toContain('# Seatline');
  expect((await request.get('/og-image')).headers()['content-type']).toBe('image/png');
  // the logo as the browser tab icon, also for browsers that only ask for /favicon.ico
  expect((await request.get('/favicon.ico')).ok()).toBe(true);
  expect((await request.get('/icon.svg')).ok()).toBe(true);
});
