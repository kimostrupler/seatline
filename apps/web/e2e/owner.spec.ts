import { expect, test } from '@playwright/test';
import { resetE2eDb } from './db';
import { switchUser } from './helpers';

test.beforeEach(() => resetE2eDb());

test('the owner dashboard: only for the operator, linked nowhere', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Business overview/ })).toHaveCount(0);

  await page.goto('/owner');
  await expect(page.getByRole('heading', { name: 'Business overview' })).toBeVisible();
  await expect(page.getByTestId('owner-workspaces')).toContainText('Alpenblick');
  await expect(page.getByTestId('owner-workspaces')).toContainText('admin@alpenblick.example');

  // anyone else: the same "not found" as an address that doesn't exist
  await page.goto('/');
  await switchUser(page, 'Luca Rossi');
  await page.goto('/owner');
  await expect(page.getByText('This page could not be found.')).toBeVisible();
  await expect(page.getByText('Business overview')).toHaveCount(0);
});
