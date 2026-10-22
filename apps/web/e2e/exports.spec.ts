import { expect, test } from '@playwright/test';
import { resetE2eDb } from './db';

test.beforeEach(() => resetE2eDb());

test('download the seating list from Home', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Export' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Seating list (Excel)' }).click();
  expect((await download).suggestedFilename()).toMatch(
    /^seatline-seating-\d{4}-\d{2}-\d{2}\.xlsx$/,
  );
});

test('print a floor: map and who sits where', async ({ page }) => {
  await page.goto('/map');
  await expect(page.getByTestId('floor-map').locator('canvas').first()).toBeVisible();
  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByRole('menuitem', { name: /Print floor/ }).click();
  await expect(page).toHaveURL(/\/map\/print\?floor=/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hauptsitz Zürich › 1. OG');
  await expect(page.getByRole('row', { name: /1\.01 Anna Meier Finance/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Print / save as PDF' })).toBeVisible();
});
