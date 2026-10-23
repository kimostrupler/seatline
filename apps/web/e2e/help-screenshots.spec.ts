import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import de from '../messages/de.json';
import en from '../messages/en.json';
import fr from '../messages/fr.json';
import type { FloorMap } from '../lib/types';
import { resetE2eDb } from './db';
import { adminHeaders, floorMap, toScreen } from './helpers';

// The help center's screenshots (public/help-img/<language>/<name>.jpg), taken from the real app
// with the sample office. Not part of the normal run:
//   HELP_SCREENSHOTS=1 pnpm exec playwright test help-screenshots --project chromium
const MESSAGES = { en, de, fr };
const NAMES = {
  en: { floor: '3rd floor', plan: 'Sales to the 2nd floor' },
  de: { floor: '3. OG', plan: 'Verkauf in den 2. Stock' },
  fr: { floor: '3e étage', plan: 'Ventes au 2e étage' },
};
const OUT = join(__dirname, '..', 'public', 'help-img');

test.skip(!process.env.HELP_SCREENSHOTS, 'only when updating the help center');
test.use({ viewport: { width: 1280, height: 800 } });
test.setTimeout(240_000);

for (const language of ['en', 'de', 'fr'] as const) {
  test(`help screenshots (${language})`, async ({ page, browser, baseURL }) => {
    const m = MESSAGES[language];
    const dir = join(OUT, language);
    mkdirSync(dir, { recursive: true });
    const shot = async (name: string, p: Page = page) => {
      await p.waitForLoadState('networkidle');
      // no notices over the screenshot
      await expect(p.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 10_000 });
      await p.waitForTimeout(400); // fonts, canvas, toasts settle
      await p.screenshot({ path: join(dir, `${name}.jpg`), type: 'jpeg', quality: 72 });
    };
    resetE2eDb();
    await page
      .context()
      .addCookies([{ name: 'seatline-language', value: language, url: baseURL! }]);
    const api = page.request;

    // Home
    await page.goto('/');
    await expect(page.getByTestId('dashboard')).toBeVisible();
    await page
      .getByTestId('help-banner')
      .getByRole('button', { name: m.dashboard.helpBanner.hide })
      .click();
    await shot('home');

    // Map: a desk selected, its person and history on the right
    await page.goto('/map');
    await expect(page.getByTestId('floor-map').locator('canvas').first()).toBeVisible();
    const map = (await floorMap(page)) as unknown as FloorMap;
    const taken = map.seats.find((s) => s.currentAssignment?.person)!;
    const s = await toScreen(page.getByTestId('floor-map'), taken);
    await page.mouse.click(s.x, s.y);
    await expect(page.getByTestId('seat-panel')).toBeVisible();
    await shot('map-seat');

    // Export menu
    await page.getByRole('button', { name: m.exports.menu }).click();
    await shot('export-menu');
    await page.keyboard.press('Escape');

    // Edit mode
    await page.getByTestId('mode-edit').click();
    await expect(page.getByTestId('layout-editor').locator('canvas').first()).toBeVisible();
    await shot('edit');

    // An empty floor: example offices, then the medium one
    const floor = await api.post('/api/floors', {
      headers: adminHeaders,
      data: { buildingId: map.floor.buildingId, name: NAMES[language].floor, level: 3 },
    });
    const floorId = (await floor.json()).id as string;
    await page.goto(`/map?building=${map.floor.buildingId}&floor=${floorId}&mode=edit`);
    await expect(page.getByTestId('template-picker')).toBeVisible();
    await shot('edit-template');
    await page.getByTestId('template-picker').getByRole('button').nth(1).click();
    await expect(page.getByTestId('save-state')).toHaveText(m.editor.saved);
    await page.getByRole('button', { name: m.map.fit }).click();
    await page.getByRole('button', { name: m.map.zoomOut }).click();
    await shot('edit-example');

    // People & access
    await page.goto('/people');
    await expect(page.getByTestId('directory')).toBeVisible();
    await shot('people');
    await page.getByRole('button', { name: m.admin.add.button }).click();
    await shot('people-add');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: m.admin.import.button }).click();
    await shot('people-import');
    await page.keyboard.press('Escape');
    for (const [tab, ready] of [
      ['teams', 'teams'],
      ['changes', 'changes-table'],
      ['settings', 'notices'],
    ] as const) {
      await page.goto(`/people?tab=${tab}`);
      await expect(page.getByTestId(ready)).toBeVisible();
      await shot(tab);
    }
    await page.getByTestId('dpa').scrollIntoViewIfNeeded();
    await shot('privacy');

    // A move plan: two people to free desks, on the list, the plan and the map
    const free = map.seats.filter((x) => x.occupancy === 'free');
    const movers = map.seats.filter((x) => x.currentAssignment?.person).slice(0, 2);
    const plan = await api.post('/api/move-plans', {
      headers: adminHeaders,
      data: { name: NAMES[language].plan },
    });
    const planId = (await plan.json()).id as string;
    await api.put(`/api/move-plans/${planId}/items`, {
      headers: adminHeaders,
      data: {
        items: movers.map((x, i) => ({
          personId: x.currentAssignment!.person!.id,
          toSeatId: free[i]!.id,
        })),
      },
    });
    await page.goto('/moves');
    await expect(page.getByTestId('plan-list')).toBeVisible();
    await shot('moves');
    await page.goto(`/moves/${planId}`);
    await expect(page.getByTestId('plan-moves')).toBeVisible();
    await shot('move-plan');
    await page.goto(`/map?building=${map.floor.buildingId}&floor=${map.floor.id}&plan=${planId}`);
    await expect(page.getByTestId('plan-bar')).toBeVisible();
    await shot('move-map');

    for (const [path, ready] of [
      ['planning', 'planning-summary'],
      ['activity', 'activity-list'],
    ] as const) {
      await page.goto(`/${path}`);
      await expect(page.getByTestId(ready)).toBeVisible();
      await shot(path);
    }

    // QR stickers and the page a sticker opens, on a phone
    await page.goto(`/map/qr?floor=${map.floor.id}`);
    await expect(page.getByTestId('desk-labels')).toBeVisible();
    await shot('qr');
    const phone = await browser.newPage({
      viewport: { width: 390, height: 780 },
      extraHTTPHeaders: adminHeaders,
    });
    await phone
      .context()
      .addCookies([{ name: 'seatline-language', value: language, url: baseURL! }]);
    await phone.goto(`/desk/${taken.id}`);
    await expect(phone.getByTestId('desk-page')).toBeVisible();
    await shot('desk-phone', phone);
    await phone.close();
  });
}
