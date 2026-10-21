import { DEMO_TENANTS } from '@seatline/shared';
import { expect, test } from '@playwright/test';
import { resetE2eDb, sqlE2e } from './db';
import { switchUser } from './helpers';

test.beforeEach(async ({ page }) => {
  resetE2eDb();
  await page.goto('/map');
  await expect(page.getByTestId('floor-map').locator('canvas').first()).toBeVisible();
});

test('admins manage roles and who can open Seatline', async ({ page }) => {
  await page.getByRole('link', { name: 'People & access' }).click();
  await expect(page.getByRole('heading', { name: 'People & access' })).toBeVisible();
  await expect(page.getByTestId('sync-status')).toHaveCount(0); // demo workspace: not connected

  await page.getByRole('combobox', { name: 'Role: Marc Dubois' }).click();
  await page.getByRole('option', { name: 'Editor' }).click();
  await expect(page.getByText('Marc Dubois is now Editor')).toBeVisible();

  await page.getByRole('combobox', { name: 'Who can open Seatline' }).click();
  await page.getByRole('option', { name: 'Only people you give a role' }).click();
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Who can open Seatline' })).toHaveText(
    'Only people you give a role',
  );
});

test('the last admin can’t remove their own admin role', async ({ page }) => {
  await page.goto('/people');
  await page.getByRole('combobox', { name: 'Role: Alpenblick AG Admin' }).click();
  await page.getByRole('option', { name: 'Viewer' }).click();
  await expect(page.getByText('A workspace needs at least one admin')).toBeVisible();
});

test('non-admins don’t get People & access', async ({ page }) => {
  await switchUser(page, DEMO_TENANTS[0]!.users[1].displayName); // editor
  await expect(page.getByTestId('floor-map').locator('canvas').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'People & access' })).toHaveCount(0);
  await page.goto('/people');
  await expect(page.getByText('Only admins can open this page.')).toBeVisible();
});

test('data protection: how long history is kept, a person’s data, forgetting a leaver', async ({
  page,
}) => {
  sqlE2e(`UPDATE people SET active = false, left_at = now() WHERE display_name = 'Marc Dubois'`);
  await page.goto('/people');
  await page.getByRole('combobox', { name: 'Keep seat history and the activity log for' }).click();
  await page.getByRole('option', { name: '5 years' }).click();
  await expect(page.getByText('Saved')).toBeVisible();

  await page.getByRole('button', { name: 'More for Anna Meier' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Download their data' }).click();
  expect((await download).suggestedFilename()).toMatch(/^seatline-person-.+\.json$/);

  // people who still work here can't be forgotten
  await page.getByRole('button', { name: 'More for Anna Meier' }).click();
  await expect(page.getByRole('menuitem', { name: 'Forget this person' })).toBeDisabled();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'More for Marc Dubois' }).click();
  await page.getByRole('menuitem', { name: 'Forget this person' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Forget this person' }).click();
  await expect(page.getByText('Personal data removed')).toBeVisible();
  await expect(page.getByTestId('directory')).not.toContainText('Marc Dubois');
  await expect(page.getByTestId('directory')).toContainText('Former employee');
});

test('without Stripe keys, billing stays out of the way', async ({ page }) => {
  await expect(page.getByRole('link', { name: 'People & access' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Billing' })).toHaveCount(0);
  await page.goto('/billing');
  await expect(page.getByText('Billing isn’t set up for this installation')).toBeVisible();
});
