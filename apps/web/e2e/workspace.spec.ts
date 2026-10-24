import { DEMO_TENANTS } from '@seatline/shared';
import { expect, test, type Page } from '@playwright/test';
import { resetE2eDb } from './db';

const [alpenblick, seeblick] = DEMO_TENANTS;
const admin = { tenantId: alpenblick!.id, userId: alpenblick!.users[0].id };

test.beforeEach(async ({ page }) => {
  resetE2eDb();
  await page.goto('/map');
  await expect(page.getByTestId('floor-map').locator('canvas').first()).toBeVisible();
});

/** Select a seat the keyboard way (the hidden accessible seat list). */
async function selectSeat(page: Page, label: string) {
  await page
    .getByRole('button', { name: new RegExp(`^Seat ${label.replace('.', '\\.')},`) })
    .focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByTestId('seat-panel').getByRole('heading', { name: `Seat ${label}` }),
  ).toBeVisible();
}

/** Where a seat is on screen, from its plan position and the map's current zoom/pan. */
async function seatOnScreen(page: Page, label: string) {
  const map = page.getByTestId('floor-map');
  const view = JSON.parse((await map.getAttribute('data-view'))!) as {
    scale: number;
    x: number;
    y: number;
  };
  const floorId = new URL(page.url()).searchParams.get('floor');
  const res = await page.request.get(`/api/floors/${floorId}/map`, {
    headers: { 'x-tenant-id': admin.tenantId, 'x-user-id': admin.userId },
  });
  const seat = (
    (await res.json()) as { seats: Array<{ label: string; x: number; y: number }> }
  ).seats.find((s) => s.label === label)!;
  const box = (await map.boundingBox())!;
  return { x: box.x + view.x + seat.x * view.scale, y: box.y + view.y + seat.y * view.scale };
}

const status = (page: Page) => page.getByTestId('seat-status');

test('shows the floor, and a seat with its person and history', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hauptsitz Zürich › 1. OG');
  await expect(page.getByText('Taken 6')).toBeVisible();

  await selectSeat(page, '1.01');
  const panel = page.getByTestId('seat-panel');
  await expect(status(page)).toHaveText('Taken');
  await expect(panel.getByRole('button', { name: 'Anna Meier' })).toBeVisible();
  await expect(panel.getByTestId('history')).toContainText('Anna Meier');
  await expect(panel.getByTestId('history')).toContainText('Moved closer to the team');
});

test('clicking a seat on the map selects it', async ({ page }) => {
  const p = await seatOnScreen(page, '1.03');
  await page.mouse.click(p.x, p.y);
  await expect(
    page.getByTestId('seat-panel').getByRole('heading', { name: 'Seat 1.03' }),
  ).toBeVisible();
  await expect(page).toHaveURL(/seat=/);
});

test('assign a person with the picker, then undo', async ({ page }) => {
  await selectSeat(page, '1.04');
  await expect(status(page)).toHaveText('Free');

  await page.getByRole('button', { name: 'Assign person' }).click();
  await page.getByPlaceholder('Search people').fill('Marc');
  await page.getByRole('option', { name: /Marc Dubois/ }).click();

  await expect(page.getByText('Marc Dubois now sits at 1.04')).toBeVisible();
  await expect(status(page)).toHaveText('Taken');
  await expect(page.getByTestId('seat-panel').getByTestId('history')).toContainText('Marc Dubois');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Change undone')).toBeVisible();
  await expect(status(page)).toHaveText('Free');
});

test('drag a person from the list onto a free seat', async ({ page }) => {
  const target = await seatOnScreen(page, '1.07');
  const person = page.getByTestId('people-list').getByRole('button', { name: /Mia Schmid/ });
  await person.dragTo(page.getByTestId('floor-map'), {
    targetPosition: await relativeTo(page, target),
  });
  await expect(page.getByText('Mia Schmid now sits at 1.07')).toBeVisible();
  await expect(person).toContainText('Seat 1.07');
});

test('drag someone to another seat to move them', async ({ page }) => {
  const from = await seatOnScreen(page, '1.02');
  const to = await seatOnScreen(page, '1.04');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 5 });
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();

  await expect(page.getByText('Luca Rossi moved from 1.02 to 1.04')).toBeVisible();
  await selectSeat(page, '1.02');
  await expect(status(page)).toHaveText('Free');
  await expect(page.getByTestId('history')).toContainText('Luca Rossi');
});

test('reserve a seat and free it again', async ({ page }) => {
  await selectSeat(page, '1.04');
  await page.getByRole('button', { name: 'Reserve' }).click();
  await page.getByPlaceholder('Who is it for?').fill('New hire Oct');
  await page.getByRole('button', { name: 'Reserve seat' }).click();
  await expect(status(page)).toHaveText('Reserved');
  await expect(page.getByTestId('seat-panel')).toContainText('Reserved for New hire Oct');

  await page.getByRole('button', { name: 'Cancel reservation' }).click();
  await expect(status(page)).toHaveText('Free');
});

test('a person’s panel shows their seat and history', async ({ page }) => {
  await page
    .getByTestId('people-list')
    .getByRole('button', { name: /Anna Meier/ })
    .click();
  const panel = page.getByTestId('person-panel');
  await expect(panel.getByRole('heading', { name: 'Anna Meier' })).toBeVisible();
  await expect(panel).toContainText('Seat 1.01');
  await panel.locator('summary', { hasText: 'History' }).click(); // folded until tapped
  await expect(panel.getByTestId('history').getByRole('listitem')).toHaveCount(2);
});

test('viewers see everything but cannot change seats', async ({ page }) => {
  await switchUser(page, alpenblick!.users[2].displayName);
  await expect(page.getByText('Viewer').first()).toBeVisible();
  await selectSeat(page, '1.04');
  await expect(page.getByText('View only')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Assign person' })).toHaveCount(0);
});

test('switching company shows only that company’s data', async ({ page }) => {
  await switchUser(page, seeblick!.users[0].displayName);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Büro Bern');
  const people = page.getByTestId('people-list');
  await expect(people).toContainText('Laura Graf');
  await expect(people).not.toContainText('Anna Meier');
});

async function switchUser(page: Page, name: string) {
  await page.getByTestId('dev-login').click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: new RegExp(name) })
    .click();
}

async function relativeTo(page: Page, p: { x: number; y: number }) {
  const box = (await page.getByTestId('floor-map').boundingBox())!;
  return { x: p.x - box.x, y: p.y - box.y };
}

test('colour seats by team; highlight one team; the choice is remembered', async ({ page }) => {
  const legend = page.getByTestId('map-legend');
  await legend.getByRole('radio', { name: 'Team' }).click();
  const engineering = legend.getByRole('button', { name: /Engineering/ });
  await expect(engineering).toContainText('3');
  await expect(legend.getByRole('button', { name: /Finance/ })).toBeVisible();
  // the accessible seat list names the team too
  await expect(
    page.getByRole('button', { name: /taken by Luca Rossi \(Engineering\)/ }),
  ).toBeAttached();

  await engineering.click();
  await expect(engineering).toHaveAttribute('aria-pressed', 'true');

  await page.reload();
  await expect(page.getByTestId('map-legend').getByRole('radio', { name: 'Team' })).toBeChecked();
});

test.describe('tablet width', () => {
  test.use({ viewport: { width: 900, height: 1000 } });
  test('the floors and people stay beside the map; seat details open from below', async ({
    page,
  }) => {
    await expect(page.getByRole('button', { name: 'Floors and people' })).toBeHidden();
    await expect(page.getByPlaceholder('Find a person')).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('tablet-map.png') });
    await selectSeat(page, '1.01');
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});
