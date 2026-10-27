import { expect, test, type Page } from '@playwright/test';
import { resetE2eDb } from './db';
import { adminHeaders, floorMap, switchUser } from './helpers';

/** Make the first free desk on the current floor a shared desk; returns its label. */
async function shareFreeDesk(page: Page) {
  const map = await floorMap(page);
  const seat = map.seats.find((s) => !s.currentAssignment)!;
  const res = await page.request.patch(`/api/seats/${seat.id}`, {
    headers: adminHeaders,
    data: { shared: true },
  });
  expect(res.ok()).toBe(true);
  return seat.label;
}

async function selectSeat(page: Page, label: string) {
  await page
    .getByRole('button', { name: new RegExp(`^Seat ${label.replace('.', '\\.')},`) })
    .focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('booking-card')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  resetE2eDb();
  await page.goto('/map');
  await expect(page.getByTestId('floor-map').locator('canvas').first()).toBeVisible();
});

test('book a shared desk for today, see it on the map, other days stay free, cancel it', async ({
  page,
}) => {
  const label = await shareFreeDesk(page);
  await page.reload();
  // the day picker shows up once the floor has shared desks
  await expect(page.getByTestId('booking-day')).toHaveText(/Today/);
  await expect(
    page.getByRole('button', {
      name: new RegExp(`^Seat ${label.replace('.', '\\.')}, Free \\(shared desk\\)`),
    }),
  ).toBeAttached();
  await selectSeat(page, label);
  const card = page.getByTestId('booking-card');
  await card.getByRole('button', { name: 'Book for today' }).click();
  await expect(page.getByText(`Desk ${label} booked for you · today`)).toBeVisible();
  await expect(card.getByText('(you)')).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: new RegExp(`^Seat ${label.replace('.', '\\.')}, .*\\(shared desk\\)`),
    }),
  ).toHaveAccessibleName(/Alpenblick AG Admin/);

  // another day: free again
  await page.getByTestId('booking-day').click();
  await page.getByRole('option', { name: 'Tomorrow' }).click();
  await expect(page).toHaveURL(/day=\d{4}-\d{2}-\d{2}/);
  await expect(card.getByRole('button', { name: 'Book for tomorrow' })).toBeVisible();

  // back to today and give it back (Undo books it again)
  await page.getByTestId('booking-day').click();
  await page.getByRole('option', { name: 'Today' }).click();
  await card.getByRole('button', { name: 'Cancel my booking' }).click();
  await expect(card.getByRole('button', { name: 'Book for today' })).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).last().click();
  await expect(card.getByText('(you)')).toBeVisible();
});

test('viewers book for themselves; a shared desk takes nobody for good', async ({ page }) => {
  const label = await shareFreeDesk(page);
  await switchUser(page, 'Luca Rossi');
  await page.reload();
  await selectSeat(page, label);
  const card = page.getByTestId('booking-card');
  await expect(card.getByRole('button', { name: 'Book for someone' })).toHaveCount(0);
  await card.getByRole('button', { name: 'Book for today' }).click();
  await expect(card.getByText('Luca Rossi (you)')).toBeVisible();
  // no "Assign person" on a shared desk
  await expect(page.getByRole('button', { name: 'Assign person' })).toHaveCount(0);
});
