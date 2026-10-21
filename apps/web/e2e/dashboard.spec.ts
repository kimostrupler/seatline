import { expect, test, type Page } from '@playwright/test';
import { resetE2eDb } from './db';
import { adminHeaders, switchUser } from './helpers';

test.beforeEach(async ({ page }) => {
  resetE2eDb();
  await page.goto('/');
  await expect(page.getByTestId('dashboard')).toBeVisible();
});

const widget = (page: Page, title: string) =>
  page.getByTestId('dashboard').getByRole('region', { name: title, exact: true });
const titles = (page: Page) =>
  page.getByTestId('dashboard').locator('section h2').allTextContents();

test('home shows the company at a glance', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Alpenblick AG');
  await expect(widget(page, 'Seats at a glance')).toContainText('Free');
  await expect(widget(page, 'Floors')).toContainText('1. OG');
  await expect(widget(page, 'People without a seat')).toContainText('Mia Schmid');
  await expect(widget(page, 'Seat changes per week')).toContainText('in the last 12 weeks');
  await widget(page, 'Floors').getByRole('link', { name: '2. OG' }).click();
  await expect(page.getByTestId('floor-select')).toHaveText('2. OG');
});

test('customize: remove, move and add widgets; the layout is kept; reset', async ({ page }) => {
  const before = await titles(page);
  await page.getByRole('button', { name: 'Customize' }).click();
  await page.getByRole('button', { name: 'Remove Departments' }).click();
  await page.getByRole('button', { name: 'Move My seat earlier' }).click();
  await page.getByRole('button', { name: 'Add widget' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Blocked seats/ })
    .click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('Dashboard saved')).toBeVisible();

  await page.reload();
  await expect(widget(page, 'Blocked seats')).toBeVisible();
  const after = await titles(page);
  expect(after[0]).toBe('Blocked seats');
  expect(after.slice(1, 4)).toEqual(['Quick actions', 'My seat', 'Upcoming moves']);
  expect(after).not.toContain('Departments');
  expect(after).toHaveLength(before.length);

  await page.getByRole('button', { name: 'Customize' }).click();
  await page.getByRole('button', { name: 'Reset to default' }).click();
  await expect.poll(() => titles(page)).toEqual(before);
});

test('viewers get their own dashboard, without the change history', async ({ page }) => {
  await switchUser(page, 'Luca Rossi');
  await expect(page.getByTestId('dashboard')).toBeVisible();
  await expect(widget(page, 'Recent changes')).toHaveCount(0);
  await expect(widget(page, 'Seats at a glance')).toBeVisible();
  await page.getByRole('button', { name: 'Customize' }).click();
  await page.getByRole('button', { name: 'Remove Seats at a glance' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('Dashboard saved')).toBeVisible();
  await expect(widget(page, 'Seats at a glance')).toHaveCount(0);
});

test('old map links still open the map', async ({ page }) => {
  const res = await page.request.get('/api/buildings', { headers: adminHeaders });
  const [building] = (await res.json()) as Array<{ id: string }>;
  await page.goto(`/?building=${building!.id}`);
  await expect(page).toHaveURL(/\/map\?building=/);
  await expect(page.getByTestId('floor-map').locator('canvas').first()).toBeVisible();
});
