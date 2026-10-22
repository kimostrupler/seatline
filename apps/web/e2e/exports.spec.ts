import { expect, test } from '@playwright/test';
import { resetE2eDb } from './db';
import { adminHeaders, floorMap } from './helpers';

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

test('QR stickers: 12 per A4 sheet, never cut; scanning opens the desk’s page', async ({
  page,
}) => {
  await page.goto('/map');
  await expect(page.getByTestId('floor-map').locator('canvas').first()).toBeVisible();
  const map = await floorMap(page);
  // 8 desks + 6 more = 14: two sheets
  for (let i = 0; i < 6; i++)
    expect(
      (
        await page.request.post('/api/seats', {
          headers: adminHeaders,
          data: { floorId: map.floor.id, label: `9.${i + 1}`, x: 900 + i * 70, y: 900 },
        })
      ).ok(),
    ).toBe(true);
  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByRole('menuitem', { name: /Desk QR codes/ }).click();
  await expect(page).toHaveURL(/\/map\/qr\?floor=/);
  await page.reload(); // the desks added above, not the map's cached list
  const labels = page.getByTestId('desk-labels').getByRole('listitem');
  await expect(labels).toHaveCount(14);
  await expect(labels.first()).toContainText('1.01');
  await expect(
    page.getByRole('img', { name: 'QR code for desk 1.01' }).locator('svg'),
  ).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  const pdf = (await page.pdf({ preferCSSPageSize: true })).toString('latin1');
  expect(pdf.match(/\/Type\s*\/Page[^s]/g)).toHaveLength(2);
  await page.emulateMedia({ media: 'screen' });

  // what a sticker opens: the desk's own page
  const seat = map.seats.find((s) => s.label === '1.01')!;
  await page.goto(`/desk/${seat.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Desk 1.01');
  await expect(page.getByTestId('desk-page')).toContainText('Anna Meier');
  await expect(page.getByTestId('desk-page')).toContainText('Finance');
  await expect(page.getByTestId('desk-status')).toHaveText('Taken');
  await page.getByRole('link', { name: 'Show on the map' }).click();
  await expect(page).toHaveURL(new RegExp(`seat=${seat.id}`));
  await expect(page.getByTestId('seat-panel')).toBeVisible();
});
