import { expect, test } from '@playwright/test';
import { resetE2eDb } from './db';
import { adminHeaders, floorMap, switchUser } from './helpers';

test.beforeEach(async ({ page }) => {
  resetE2eDb();
  await page.goto('/map');
  await expect(page.getByTestId('floor-map').locator('canvas').first()).toBeVisible();
});

test('Home shows how full each floor is and opens its map; /overview leads there', async ({
  page,
}) => {
  const map = await floorMap(page);
  await page.goto('/overview');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Overview' })).toHaveCount(0);
  const floors = page.getByRole('region', { name: 'Floors', exact: true });
  await expect(floors.getByRole('img', { name: /^2\. OG:/ })).toHaveAttribute(
    'aria-label',
    /free, .* of 8 seats/,
  );
  await floors.getByRole('link', { name: '2. OG' }).click();
  await expect(page.getByTestId('floor-select')).toHaveText('2. OG');
  expect(new URL(page.url()).searchParams.get('floor')).not.toBe(map.floor.id);
});

test('the logo in the top bar leads Home from every page', async ({ page }) => {
  await page.getByTestId('app-logo').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('dashboard')).toBeVisible();
});

test('activity lists every change in plain words, filters by person, links to the map', async ({
  page,
}) => {
  const seat = (await floorMap(page)).seats.find((s) => s.label === '1.04')!;
  const res = await page.request.post('/api/assignments/reservations', {
    headers: adminHeaders,
    data: { seatId: seat.id, reservedFor: 'New hire' },
  });
  expect(res.ok()).toBe(true);

  await page.getByRole('link', { name: 'Activity' }).click();
  const list = page.getByTestId('activity-list');
  await expect(list).toContainText('Today');
  await expect(list.getByRole('listitem').first()).toContainText('reserved seat 1.04 for New hire');

  // someone not involved: nothing matches
  await page.getByRole('combobox', { name: 'Person' }).click();
  await page.getByRole('option', { name: /Mia Schmid/ }).click();
  await expect(page.getByText('No changes match these filters.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();

  // search over everything: the reservation's note, then something that isn't there
  const searchBox = page.getByRole('searchbox', { name: 'Search activity' });
  await searchBox.fill('new HIRE');
  await expect(page).toHaveURL(/q=new\+HIRE/);
  // the person filter cleared just before typing stays cleared
  expect(page.url()).not.toContain('personId');
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await searchBox.fill('nothing like this');
  await expect(page.getByText('No changes match these filters.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(searchBox).toHaveValue('');

  await list.getByRole('link', { name: 'Show on map' }).first().click();
  await expect(page.getByTestId('seat-panel')).toContainText('Reserved for New hire');
});

test('viewers see Home but not the change history', async ({ page }) => {
  await switchUser(page, 'Luca Rossi');
  await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Activity' })).toHaveCount(0);
  await page.goto('/activity');
  await expect(page.getByText('Only editors and admins can see the change history.')).toBeVisible();
});

test('every page runs with a per-request script nonce and nothing is blocked', async ({ page }) => {
  const blocked: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && /Content Security Policy/i.test(m.text())) blocked.push(m.text());
  });
  const nonces = new Set<string>();
  for (const path of [
    '/',
    '/map',
    '/moves',
    '/people',
    '/activity',
    '/welcome',
    '/help/en',
    '/help/de/video-tour',
  ]) {
    const res = await page.goto(path);
    const csp = res?.headers()['content-security-policy'] ?? '';
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    nonces.add(/'nonce-([^']+)'/.exec(csp)![1]!);
    await page.waitForLoadState('networkidle');
  }
  expect(nonces.size).toBe(8); // a new one for every request
  // the app still works (React ran): the map draws
  await page.goto('/map');
  await expect(page.getByTestId('floor-map').locator('canvas').first()).toBeVisible();
  expect(blocked).toEqual([]);
});

test('server-action probes from bots get a plain 404 (Seatline has no server actions)', async ({
  request,
}) => {
  const res = await request.post('/', { headers: { 'next-action': 'x' }, data: '[]' });
  expect(res.status()).toBe(404);
  // ordinary pages still work
  expect((await request.get('/welcome')).status()).toBe(200);
});
