import { expect, test, type Page } from '@playwright/test';
import { resetE2eDb } from './db';
import { adminHeaders, floorMap, toScreen } from './helpers';

test.beforeEach(async ({ page }) => {
  resetE2eDb();
  await page.goto('/moves');
});

async function newPlan(page: Page, name: string) {
  await page.getByRole('button', { name: 'New move plan' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill(name);
  await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(name);
}

test('plan a move on the map; nothing changes until it is applied', async ({ page }) => {
  await newPlan(page, 'Mia gets a desk');
  await page.getByRole('link', { name: 'Plan on the map' }).first().click();
  await expect(page.getByTestId('plan-bar')).toContainText('Planning: Mia gets a desk');

  const map = page.getByTestId('floor-map');
  await expect(map.locator('canvas').first()).toBeVisible();
  const seat = (await floorMap(page)).seats.find((s) => s.label === '1.04')!;
  const at = await toScreen(map, seat);
  await page.mouse.click(at.x, at.y);
  const panel = page.getByTestId('plan-seat-panel');
  await panel.getByRole('button', { name: 'Plan: someone sits here' }).click();
  await page.getByRole('option', { name: /Mia Schmid/ }).click();
  await expect(page.getByTestId('plan-bar')).toContainText('1 move');
  await expect(panel).toContainText('Mia Schmid gets this seat');
  // only planned: the real seat is still free
  expect((await floorMap(page)).seats.find((s) => s.id === seat.id)?.currentAssignment).toBeNull();

  await page.getByRole('link', { name: 'Open the plan' }).click();
  await expect(page.getByTestId('plan-moves')).toContainText('Mia Schmid');
  await expect(page.getByTestId('plan-moves')).toContainText('1.04 · 1. OG');
  await page.getByRole('button', { name: 'Apply now' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Apply now' }).click();
  await expect(page.getByText('Moves applied')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Applied');

  const res = await page.request.get(`/api/seats/${seat.id}`, { headers: adminHeaders });
  expect((await res.json()).currentAssignment.person.displayName).toBe('Mia Schmid');
});

test('move a whole team to another floor and schedule it', async ({ page }) => {
  await newPlan(page, 'Sales to 2. OG');
  await page.getByRole('button', { name: 'Move a team' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Team').click();
  await page.getByRole('option', { name: /^Sales/ }).click();
  await dialog.getByLabel('To floor').click();
  await page.getByRole('option', { name: /2\. OG/ }).click();
  await dialog.getByRole('button', { name: 'Add to plan' }).click();
  await expect(page.getByText('2 moves added')).toBeVisible();
  await expect(page.getByTestId('plan-moves').getByRole('listitem')).toHaveCount(2);

  await page.getByRole('button', { name: 'Schedule' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Schedule' }).click();
  await expect(page.getByText('Plan scheduled')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Scheduled for');

  // the printable moving list: one row per move, a tick box each
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Moving list' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sales to 2. OG');
  await expect(page.getByTestId('moving-list').locator('tbody tr')).toHaveCount(2);
  await expect(page.getByTestId('moving-list')).toContainText('2. OG');

  await page.goto('/moves');
  await expect(page.getByTestId('plan-list').first()).toContainText('Sales to 2. OG');
});

test('a plan with a problem can’t be applied', async ({ page }) => {
  const seats = (
    await (
      await page.request.get('/api/floors/' + (await firstFloorId(page)) + '/map', {
        headers: adminHeaders,
      })
    ).json()
  ).seats as Array<{ id: string; label: string; currentAssignment: unknown }>;
  const taken = seats.find((s) => s.label === '1.01')!;
  const people = (await (
    await page.request.get('/api/people?search=Mia', { headers: adminHeaders })
  ).json()) as Array<{ id: string }>;
  const plan = await (
    await page.request.post('/api/move-plans', { headers: adminHeaders, data: { name: 'Clash' } })
  ).json();
  await page.request.put(`/api/move-plans/${plan.id}/items`, {
    headers: adminHeaders,
    data: { items: [{ personId: people[0]!.id, toSeatId: taken.id }] },
  });
  await page.goto(`/moves/${plan.id}`);
  await expect(page.getByTestId('plan-problems')).toContainText(
    'Mia Schmid → 1.01: Anna Meier sits there and isn’t moving.',
  );
  await expect(page.getByRole('button', { name: 'Apply now' })).toBeDisabled();
});

async function firstFloorId(page: Page) {
  const buildings = await (
    await page.request.get('/api/buildings', { headers: adminHeaders })
  ).json();
  const floors = await (
    await page.request.get(`/api/floors?buildingId=${buildings[0].id}`, { headers: adminHeaders })
  ).json();
  return floors[0].id as string;
}
