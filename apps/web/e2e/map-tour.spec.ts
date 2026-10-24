import { expect, test } from '@playwright/test';
import { resetE2eDb } from './db';

// a browser that has never seen the map
test.use({ storageState: { cookies: [], origins: [] } });

test('the first map visit shows three tips, then never again', async ({ page }) => {
  resetE2eDb();
  await page.goto('/map');
  const tour = page.getByTestId('map-tour');
  await expect(tour.getByRole('heading', { name: 'Welcome to your floor' })).toBeVisible();
  await expect(tour).toContainText('Tip 1 of 3');
  await tour.getByRole('button', { name: 'Next' }).click();
  await expect(tour.getByRole('heading', { name: 'Click a desk' })).toBeVisible();
  await tour.getByRole('button', { name: 'Next' }).click();
  await expect(tour.getByRole('heading', { name: 'Nothing can go wrong' })).toBeVisible();
  await tour.getByRole('button', { name: 'Got it' }).click();
  await expect(tour).toBeHidden();
  await page.reload();
  await expect(page.getByTestId('floor-map').locator('canvas').first()).toBeVisible();
  await expect(tour).toBeHidden();
});
