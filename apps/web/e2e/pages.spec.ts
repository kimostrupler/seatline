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
