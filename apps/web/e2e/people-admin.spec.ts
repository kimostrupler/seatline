import { DEMO_TENANTS } from '@seatline/shared';
import { expect, test } from '@playwright/test';
import { resetE2eDb, sqlE2e } from './db';
import { openFold, switchUser } from './helpers';

test.beforeEach(async ({ page }) => {
  resetE2eDb();
  await page.goto('/map');
  await expect(page.getByTestId('floor-map').locator('canvas').first()).toBeVisible();
});

test('admins manage roles and who can open Seatline', async ({ page }) => {
  await page.getByRole('link', { name: 'People & access' }).click();
  await expect(page.getByRole('heading', { name: 'People & access' })).toBeVisible();

  await page.getByRole('combobox', { name: 'Role: Marc Dubois' }).click();
  await page.getByRole('option', { name: 'Editor' }).click();
  await expect(page.getByText('Marc Dubois is now Editor')).toBeVisible();

  await page.getByRole('tab', { name: 'Settings' }).click();
  await expect(page).toHaveURL(/tab=settings/);
  await expect(page.getByTestId('sync-status')).toHaveCount(0); // demo workspace: not connected
  await openFold(page, 'Who can open Seatline');
  await page.getByRole('combobox', { name: 'Who can open Seatline' }).click();
  await page.getByRole('option', { name: 'Only people you give a role' }).click();
  await page.reload();
  await openFold(page, 'Who can open Seatline');
  await expect(page.getByRole('combobox', { name: 'Who can open Seatline' })).toHaveText(
    'Only people you give a role',
  );
});

test('admins import people from a spreadsheet', async ({ page }) => {
  await page.goto('/people');
  await page.getByRole('button', { name: 'Import list' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByTestId('import-file').setInputFiles({
    name: 'people.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'Vorname;Nachname;E-Mail;Abteilung\nLina;Graf;lina.graf@example.ch;Finance\nTim;Roth;tim.roth@example.ch;Finance\nOhne;Mail;;\n',
    ),
  });
  await expect(dialog.getByTestId('import-summary')).toHaveText(
    '2 new people · 1 row with a problem',
  );
  await dialog.getByRole('button', { name: 'Import 2 people' }).click();
  await expect(page.getByText('2 people added')).toBeVisible();
  await expect(page.getByText('Lina Graf')).toBeVisible();
});

test('admins put people in a team', async ({ page }) => {
  await page.goto('/people');
  await page.getByRole('button', { name: 'More for Marc Dubois' }).click();
  await page.getByRole('menuitem', { name: 'Set team' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Team').fill('Platform');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Team of Marc Dubois saved')).toBeVisible();
  await expect(page.getByTestId('directory')).toContainText('Platform');
});

test('teams: create one with people, rename it; it shows in the people list', async ({ page }) => {
  await page.goto('/people?tab=teams');
  await page.getByRole('button', { name: 'New team' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Team name').fill('Platform');
  await dialog.getByLabel('Marc Dubois').check();
  await dialog.getByLabel('Mia Schmid').check();
  await dialog.getByRole('button', { name: 'Add 2 people' }).click();
  await expect(page.getByText('2 people now in Platform')).toBeVisible();
  const team = page.getByTestId('teams').getByRole('listitem', { name: 'Platform' });
  await expect(team).toContainText('2 people · 0 with a desk');

  await team.getByRole('button', { name: 'More for Platform' }).click();
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('Core Platform');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('teams')).toContainText('Core Platform');

  await page.getByRole('tab', { name: 'People' }).click();
  await expect(
    page.getByTestId('directory').getByRole('listitem').filter({ hasText: 'Mia Schmid' }),
  ).toContainText('Core Platform');
});

test('HR changes: several people at once, a leaving date, notices to IT', async ({ page }) => {
  await page.goto('/people?tab=settings');
  await openFold(page, 'Notices');
  const notices = page.getByTestId('notices');
  await notices.getByLabel('E-mail address for notices').fill('it@alpenblick.example');
  await notices.getByRole('button', { name: 'Add' }).click();
  await expect(notices).toContainText('it@alpenblick.example');

  await page.getByRole('tab', { name: 'Changes' }).click();
  await expect(page.getByText('Notices go to it@alpenblick.example.')).toBeVisible();
  const table = page.getByTestId('changes-table');
  await table.getByLabel('Team of Marc Dubois').fill('Platform');
  await table.getByLabel('Leaving date of Mia Schmid').fill('2099-12-31');
  await expect(page.getByText('2 people changed')).toBeVisible();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('2 changes saved — notice sent')).toBeVisible();

  await page.getByRole('tab', { name: 'People' }).click();
  await page.getByRole('radio', { name: 'Leaving' }).click();
  const directory = page.getByTestId('directory');
  await expect(directory.getByRole('listitem')).toHaveCount(1);
  await expect(directory).toContainText('Mia Schmid');
  await expect(directory).toContainText('Leaves 31 Dec');
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
  await page.goto('/people?tab=settings');
  await openFold(page, 'Data protection');
  await page.getByRole('combobox', { name: 'Keep seat history and the activity log for' }).click();
  await page.getByRole('option', { name: '5 years' }).click();
  await expect(page.getByText('Saved')).toBeVisible();

  // the DPA as a PDF, by e-mail to the admin
  await page.getByTestId('dpa').getByRole('button', { name: 'E-mail me the DPA (PDF)' }).click();
  await expect(page.getByText(/^Sent to /)).toBeVisible();
  await page.getByRole('tab', { name: 'People' }).click();

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
