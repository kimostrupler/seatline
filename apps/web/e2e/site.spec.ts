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
  expect(headers['content-security-policy']).toContain(
    "frame-ancestors 'self' https://teams.microsoft.com",
  );
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
