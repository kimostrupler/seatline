import { expect, test } from '@playwright/test';
import { resetE2eDb } from './db';

test.beforeEach(() => resetE2eDb());

test('space planning: expected headcount per team against free desks', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Planning' }).click();
  await expect(page.getByRole('heading', { name: 'Space planning' })).toBeVisible();
  await expect(page.getByTestId('planning-summary')).toContainText('Enough desks');

  const expected = page.getByRole('spinbutton', { name: 'Expected people in Sales' });
  await expected.fill('30');
  await expected.press('Enter');
  await expect(page.getByText('Plan for Sales saved')).toBeVisible();
  await expect(page.getByTestId('planning-summary')).toContainText(/desks short/);

  await page.reload();
  await expect(page.getByRole('spinbutton', { name: 'Expected people in Sales' })).toHaveValue(
    '30',
  );
});
