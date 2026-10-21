import { expect, test } from '@playwright/test';
import { resetE2eDb } from './db';

test.beforeEach(() => resetE2eDb());

test.describe('with a German browser', () => {
  test.use({ locale: 'de-CH' });

  test('the app is in German, and the language can be switched', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Anpassen' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Übersicht' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Plätze auf einen Blick' })).toBeVisible();

    await page.getByRole('combobox', { name: 'Sprache' }).click();
    await page.getByRole('option', { name: 'FR' }).click();
    await expect(page.getByRole('button', { name: 'Personnaliser' })).toBeVisible();

    // the choice is remembered
    await page.goto('/map');
    await expect(page.getByRole('link', { name: 'Vue d’ensemble' })).toBeVisible();
  });
});
