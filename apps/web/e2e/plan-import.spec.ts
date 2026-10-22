import { expect, test } from '@playwright/test';
import path from 'node:path';
import { resetE2eDb } from './db';
import { floorMap } from './helpers';

// the made-up office in apps/plan-engine/samples (9 spaces incl. the corridor, 23 desks, 1:100)
const OFFICE_PDF = path.resolve(__dirname, '../../plan-engine/samples/office.pdf');

test.beforeEach(async ({ page }) => {
  resetE2eDb();
  await page.goto('/map');
  await page.getByTestId('mode-edit').click();
  await expect(page.getByTestId('layout-editor').locator('canvas').first()).toBeVisible();
  await page.getByTestId('import-plan').click();
});

test('import a PDF plan: review, leave a room out, import, undo', async ({ page }) => {
  const before = await floorMap(page);
  await page.getByTestId('import-file').setInputFiles(OFFICE_PDF);
  const confirm = page.getByTestId('import-confirm');
  await expect(confirm).toHaveText('Import 9 rooms and 23 desks', { timeout: 60_000 });
  await expect(page.getByText('Scale from the plan: 1 m = 40 px')).toBeVisible();

  await page.getByTestId('import-preview').locator('polygon').first().click({ force: true });
  await expect(confirm).toHaveText('Import 8 rooms and 23 desks');
  await confirm.click();
  await expect(page.getByText('Imported 8 rooms and 23 desks.')).toBeVisible();
  await expect(page.getByTestId('save-state')).toHaveText('All changes saved');

  const after = await floorMap(page);
  expect(after.rooms.length).toBe(before.rooms.length + 8);
  expect(after.seats.length).toBe(before.seats.length + 23);
  expect(after.rooms.map((r) => r.name)).toContain('1.03 Sitzungszimmer');
  expect(after.seats.map((s) => s.label)).toContain('1.31'); // continues the floor's 1.xx labels
  expect(after.floor).toMatchObject({ planWidth: 1770, scale: 40 });

  // one undo removes everything that was imported
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.getByTestId('save-state')).toHaveText('All changes saved');
  await expect.poll(async () => (await floorMap(page)).seats.length).toBe(before.seats.length);
  expect((await floorMap(page)).rooms.length).toBe(before.rooms.length);
});

test('a DWG file gets a clear explanation', async ({ page }) => {
  await page.getByTestId('import-file').setInputFiles({
    name: 'plan.dwg',
    mimeType: 'application/acad',
    buffer: Buffer.from('AC1032\0\0\0\0 not really a drawing'),
  });
  await expect(page.getByRole('alert')).toContainText('save the plan as DXF');
});
