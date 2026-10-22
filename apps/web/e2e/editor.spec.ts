import { DEMO_TENANTS } from '@seatline/shared';
import { expect, test, type Page } from '@playwright/test';
import { resetE2eDb } from './db';
import { adminHeaders, currentFloorId, floorMap, makePng, switchUser, toScreen } from './helpers';

test.beforeEach(async ({ page }) => {
  resetE2eDb();
  await page.goto('/map');
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

/** A click that doesn't move focus first (like Safari): the selection changes while the field is still focused. */
async function clickPlanKeepFocus(page: Page, p: { x: number; y: number }) {
  const s = await toScreen(editor(page), p);
  await page.evaluate(({ x, y }) => {
    const target = document.elementFromPoint(x, y)!;
    const init = { bubbles: true, cancelable: true, clientX: x, clientY: y };
    const pointer = { ...init, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    target.dispatchEvent(new PointerEvent('pointerdown', pointer));
    target.dispatchEvent(new MouseEvent('mousedown', init));
    target.dispatchEvent(new PointerEvent('pointerup', pointer));
    target.dispatchEvent(new MouseEvent('mouseup', init));
    target.dispatchEvent(new MouseEvent('click', init));
  }, s);
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

test('a new label is kept when you click on the map without pressing Enter', async ({ page }) => {
  const map = await floorMap(page);
  const seat = map.seats.find((s) => s.label === '1.04')!;
  const other = map.seats.find((s) => s.label === '1.05')!;
  await clickPlan(page, seat);
  const label = page.getByTestId('inspector').getByRole('textbox', { name: 'Label' });
  await label.fill('A1');
  await clickPlanKeepFocus(page, other); // selecting another seat must not lose the typed label
  await expect(page.getByTestId('inspector').getByRole('heading')).toHaveText('Seat 1.05');
  await saved(page);
  await expect
    .poll(async () => (await floorMap(page)).seats.find((s) => s.id === seat.id)?.label)
    .toBe('A1');

  await label.fill('B2');
  await clickPlanKeepFocus(page, { x: 40, y: 40 }); // empty spot: clears the selection
  await saved(page);
  await expect
    .poll(async () => (await floorMap(page)).seats.find((s) => s.id === other.id)?.label)
    .toBe('B2');
});

test('copy a seat and paste it on another floor', async ({ page }) => {
  const seat = (await floorMap(page)).seats.find((s) => s.label === '1.04')!;
  await clickPlan(page, seat);
  await page.keyboard.press('ControlOrMeta+c');
  await page.getByTestId('floor-select').click();
  await page.getByRole('option', { name: '2. OG' }).click();
  await expect(page.getByTestId('layout-editor').locator('canvas').first()).toBeVisible();
  await expect.poll(async () => (await floorMap(page)).seats[0]?.label).toMatch(/^2\./);

  await page.keyboard.press('ControlOrMeta+v');
  // 2.04 already stands there: the copy moves aside and takes the next free label
  await expect(page.getByTestId('inspector').getByRole('heading')).toHaveText('Seat 2.09');
  await saved(page);
  const pasted = (await floorMap(page)).seats.find((s) => s.label === '2.09');
  expect(pasted).toMatchObject({ x: seat.x + 96, y: seat.y }); // an 80-unit desk (1.6 m at 50 units/m) + 16
});

test('resize a room by dragging its side, or by typing its size', async ({ page }) => {
  const room = () => floorMap(page).then((m) => m.rooms.find((r) => r.name === 'Meeting Rigi')!);
  await clickPlan(page, { x: 975, y: 175 }); // inside the empty meeting room
  await expect(page.getByTestId('inspector').getByRole('heading')).toHaveText('Meeting Rigi');

  await dragPlan(page, { x: 1150, y: 175 }, { x: 1250, y: 175 }); // right side's handle
  await saved(page);
  expect((await room()).polygon).toEqual([
    { x: 800, y: 50 },
    { x: 1250, y: 50 },
    { x: 1250, y: 300 },
    { x: 800, y: 300 },
  ]);

  // scale is 50 units per metre: 4 m deep = 200 units
  const height = page.getByTestId('inspector').getByRole('textbox', { name: 'Height' });
  await expect(height).toHaveValue('5');
  await height.fill('4');
  await height.press('Enter');
  await saved(page);
  expect((await room()).polygon.map((p) => p.y)).toEqual([50, 50, 250, 250]);
});

test('dragging the empty floor moves around; Shift-drag selects a box', async ({ page }) => {
  const view = async () => JSON.parse((await editor(page).getAttribute('data-view'))!);
  const before = await view();
  await dragPlan(page, { x: 900, y: 600 }, { x: 1000, y: 650 }); // empty floor
  const after = await view();
  expect(after.x).toBeGreaterThan(before.x + 20);
  expect(after.scale).toBe(before.scale);

  // Shift + drag from empty floor draws a box: what it covers is selected
  const seat = (await floorMap(page)).seats[0]!;
  const away = (v: number, from: number) => (v < from ? v - 40 : v + 40);
  await page.keyboard.down('Shift');
  await dragPlan(page, { x: 900, y: 600 }, { x: away(seat.x, 900), y: away(seat.y, 600) });
  await page.keyboard.up('Shift');
  await expect(page.getByTestId('inspector')).toBeVisible();
  await expect(page.getByTestId('floor-settings')).toHaveCount(0);
});

test('align seats and add a row of desks', async ({ page }) => {
  const map = await floorMap(page);
  const a = map.seats.find((s) => s.label === '1.01')!;
  const b = map.seats.find((s) => s.label === '1.06')!;
  await clickPlan(page, a);
  await page.keyboard.down('Shift');
  await clickPlan(page, b);
  await page.keyboard.up('Shift');
  await page.getByRole('button', { name: 'Align left' }).click();
  await saved(page);
  expect((await floorMap(page)).seats.find((s) => s.id === b.id)!.x).toBe(a.x);

  await clickPlan(page, { x: 975, y: 175 }); // select something else first
  const free = (await floorMap(page)).seats.find((s) => s.label === '1.08')!;
  await clickPlan(page, free);
  const inspector = page.getByTestId('inspector');
  await inspector.getByRole('spinbutton', { name: 'How many desks' }).fill('2');
  await inspector.getByRole('button', { name: 'Below' }).click();
  await saved(page);
  const labels = (await floorMap(page)).seats.map((s) => s.label);
  expect(labels).toEqual(expect.arrayContaining(['1.09', '1.10']));
});

test('duplicate a floor: same rooms and seats, no people, numbered for the new level', async ({
  page,
}) => {
  const source = await floorMap(page);
  await page.getByTestId('floor-settings').getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Duplicate floor' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Start with')).toHaveText('A copy of 1. OG');
  await dialog.getByLabel('Floor name').fill('3. OG');
  await expect(dialog.getByLabel('Level')).toHaveValue('3');
  await dialog.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByTestId('floor-select')).toHaveText('3. OG');

  const copy = await floorMap(page);
  expect(copy.floor.id).not.toBe(source.floor.id);
  expect(copy.rooms.map((r) => r.name).sort()).toEqual(source.rooms.map((r) => r.name).sort());
  expect(copy.seats.map((s) => s.label)).toEqual(
    source.seats.map((s) => s.label.replace(/^1\./, '3.')),
  );
  expect(copy.seats.every((s) => !('currentAssignment' in s) || s.currentAssignment === null)).toBe(
    true,
  );
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
  await expect(settings).toContainText('Floor plan added');
  await expect(settings.getByRole('button', { name: 'Change plan' })).toBeVisible();
  expect((await floorMap(page)).floor.planFileKey).toBeTruthy();

  await page.keyboard.press('m');
  await dragPlan(page, { x: 100, y: 780 }, { x: 600, y: 780 });
  const dialog = page.getByRole('dialog');
  // the ruler doesn't snap (it measures), so allow a pixel of rounding
  await expect(dialog).toContainText(/(499|500|501) units/);
  await dialog.getByRole('textbox', { name: 'Length in metres' }).fill('10');
  await dialog.getByRole('button', { name: 'Set scale' }).click();
  await expect(settings).toContainText('1 m = 50 units');

  // with a scale, desks are drawn at their real size, which can be changed per floor
  await settings.getByRole('textbox', { name: 'Desk width in metres' }).fill('1.4');
  await settings.getByRole('textbox', { name: 'Desk width in metres' }).press('Enter');
  await expect.poll(async () => (await floorMap(page)).floor).toMatchObject({ deskWidth: 1.4 });
});

test('number desks per room, then undo', async ({ page }) => {
  const before = await floorMap(page);
  const open = before.rooms.find((r) => r.name === 'Open Space')!;
  const res = await page.request.patch(`/api/floors/${currentFloorId(page)}/layout`, {
    headers: adminHeaders,
    data: { rooms: { update: [{ id: open.id, name: '1.20 Open Space' }] } },
  });
  expect(res.ok()).toBe(true);
  await page.reload();
  await page.getByTestId('mode-edit').click();

  const settings = page.getByTestId('floor-settings');
  await settings.getByRole('combobox', { name: 'Numbering' }).click();
  await page.getByRole('option', { name: /Per room/ }).click();
  await expect
    .poll(async () => (await floorMap(page)).floor)
    .toMatchObject({
      seatNumbering: 'room',
    });
  await settings.getByTestId('renumber').click();
  await expect(page.getByText(/desks? renumbered/)).toBeVisible();
  await saved(page);
  const inRoom = (await floorMap(page)).seats.filter((s) => s.roomId === open.id);
  expect(inRoom.length).toBeGreaterThan(0);
  expect(inRoom.map((s) => s.label).sort()).toEqual(
    inRoom.map((_, i) => `1.20-${String.fromCharCode(65 + i)}`),
  );

  await page.keyboard.press('ControlOrMeta+z');
  await saved(page);
  const labels = async () => (await floorMap(page)).seats.map((s) => s.label).sort();
  await expect.poll(labels).toEqual(before.seats.map((s) => s.label).sort());
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

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('edit mode works with the inspector as a panel under the floor', async ({ page }) => {
    const seat = (await floorMap(page)).seats.find((s) => s.label === '1.04')!;
    await clickPlan(page, seat);
    const panel = page.getByTestId('mobile-inspector');
    await expect(panel.getByRole('heading')).toHaveText('Seat 1.04');
    await panel.getByRole('textbox', { name: 'Label' }).fill('Window');
    await panel.getByRole('button', { name: 'Close panel' }).click();
    await expect(panel).toBeHidden();
    await saved(page);
    expect((await floorMap(page)).seats.find((s) => s.id === seat.id)?.label).toBe('Window');
  });

  test('the floor panel is one tap away: plan, import, name', async ({ page }) => {
    const panel = page.getByTestId('mobile-inspector');
    await expect(panel).toBeHidden();
    await page.getByTestId('floor-panel-toggle').click();
    await expect(panel.getByTestId('floor-settings')).toBeVisible();
    await expect(panel.getByRole('button', { name: /Add plan|Change plan/ })).toBeVisible();
    await expect(panel.getByRole('textbox', { name: 'Name' })).toHaveValue('1. OG');
    await page.getByTestId('floor-panel-toggle').click();
    await expect(panel).toBeHidden();
  });
});
