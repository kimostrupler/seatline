import { DEMO_TENANTS } from '@seatline/shared';
import { expect, test, type Page } from '@playwright/test';
import { resetE2eDb } from './db';
import { floorMap, makePng, switchUser, toScreen } from './helpers';

test.beforeEach(async ({ page }) => {
  resetE2eDb();
  await page.goto('/');
  await expect(page.getByTestId('floor-map').locator('canvas').first()).toBeVisible();
  await page.getByTestId('mode-edit').click();
  await expect(page.getByTestId('layout-editor').locator('canvas').first()).toBeVisible();
});

const editor = (page: Page) => page.getByTestId('layout-editor');
const saved = (page: Page) =>
  expect(page.getByTestId('save-state')).toHaveText('All changes saved');

async function clickPlan(page: Page, p: { x: number; y: number }) {
  const s = await toScreen(editor(page), p);
  await page.mouse.click(s.x, s.y);
}

async function dragPlan(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const a = await toScreen(editor(page), from);
  const b = await toScreen(editor(page), to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
}

test('add a seat, then undo it', async ({ page }) => {
  const before = (await floorMap(page)).seats.length;
  await page.keyboard.press('s');
  await clickPlan(page, { x: 600, y: 700 });
  await expect(page.getByTestId('inspector').getByRole('heading')).toHaveText('Seat 1.09');
  await saved(page);
  const added = (await floorMap(page)).seats.find((s) => s.label === '1.09');
  expect(added).toMatchObject({ x: 600, y: 700, roomId: null });

  await page.keyboard.press('Escape'); // back to select
  await page.keyboard.press('ControlOrMeta+z');
  await saved(page);
  await expect.poll(async () => (await floorMap(page)).seats.length).toBe(before);
});

test('draw a rectangular room, rename it; seats inside join it', async ({ page }) => {
  await page.getByRole('button', { name: /Draw rectangular room/ }).click();
  await dragPlan(page, { x: 820, y: 500 }, { x: 1100, y: 750 });
  const inspector = page.getByTestId('inspector');
  await expect(inspector.getByRole('heading')).toHaveText('Room 3');
  await inspector.getByRole('textbox', { name: 'Name' }).fill('Focus');
  await inspector.getByRole('textbox', { name: 'Name' }).press('Enter');
  await saved(page);

  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  await clickPlan(page, { x: 900, y: 600 });
  await saved(page);
  const map = await floorMap(page);
  const focus = map.rooms.find((r) => r.name === 'Focus')!;
  expect(focus.polygon).toEqual([
    { x: 820, y: 500 },
    { x: 1100, y: 500 },
    { x: 1100, y: 750 },
    { x: 820, y: 750 },
  ]);
  expect(map.seats.find((s) => s.x === 900 && s.y === 600)?.roomId).toBe(focus.id);
});

test('drag a seat to move it; arrows nudge; R rotates', async ({ page }) => {
  const map = await floorMap(page);
  const seat = map.seats.find((s) => s.label === '1.04')!;
  const grid = map.floor.scale ? map.floor.scale / 10 : 10; // arrows move one grid step (10 cm)
  await dragPlan(page, seat, { x: seat.x + 100, y: seat.y + 40 });
  await saved(page);
  let moved = (await floorMap(page)).seats.find((s) => s.id === seat.id)!;
  expect([moved.x, moved.y]).toEqual([seat.x + 100, seat.y + 40]);

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('r');
  await saved(page);
  moved = (await floorMap(page)).seats.find((s) => s.id === seat.id)!;
  expect([moved.x, moved.rotation]).toEqual([seat.x + 100 + grid, 90]);
});

test('seats with people can’t be deleted', async ({ page }) => {
  const seat = (await floorMap(page)).seats.find((s) => s.label === '1.01')!;
  await clickPlan(page, seat);
  await expect(page.getByTestId('inspector').getByRole('heading')).toHaveText('Seat 1.01');
  await page.keyboard.press('Delete');
  await expect(page.getByText(/Free or cancel the reservation on 1\.01 first/)).toBeVisible();
  expect((await floorMap(page)).seats.some((s) => s.id === seat.id)).toBe(true);
});

test('upload a floor plan and set the scale', async ({ page }) => {
  const settings = page.getByTestId('floor-settings');
  await settings
    .getByTestId('plan-file')
    .setInputFiles({ name: 'plan.png', mimeType: 'image/png', buffer: makePng(1400, 900) });
  await expect(page.getByText('Floor plan uploaded')).toBeVisible();
  await expect(settings.getByRole('button', { name: 'Replace plan' })).toBeVisible();
  expect((await floorMap(page)).floor.planFileKey).toBeTruthy();

  await page.keyboard.press('m');
  await dragPlan(page, { x: 100, y: 780 }, { x: 600, y: 780 });
  const dialog = page.getByRole('dialog');
  // the ruler doesn't snap (it measures), so allow a pixel of rounding
  await expect(dialog).toContainText(/(499|500|501) units/);
  await dialog.getByRole('textbox', { name: 'Length in metres' }).fill('10');
  await dialog.getByRole('button', { name: 'Set scale' }).click();
  await expect(settings).toContainText('1 m = 50 units');
});

test('create a building and a floor', async ({ page }) => {
  await page.getByRole('button', { name: 'New building' }).click();
  await page.getByRole('dialog').getByLabel('Building name').fill('Annex');
  await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Annex created')).toBeVisible();

  await page.getByRole('button', { name: 'New floor' }).click();
  await page.getByRole('dialog').getByLabel('Floor name').fill('EG');
  await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Annex › EG');
  await expect(page.getByTestId('floor-settings')).toBeVisible(); // straight into the editor
});

test('viewers don’t get the editor', async ({ page }) => {
  await switchUser(page, DEMO_TENANTS[0]!.users[2].displayName);
  await expect(page.getByTestId('floor-map').locator('canvas').first()).toBeVisible();
  await expect(page.getByTestId('mode-edit')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'New building' })).toHaveCount(0);
});
