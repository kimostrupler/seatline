import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import de from '../messages/de.json';
import en from '../messages/en.json';
import fr from '../messages/fr.json';
import { resetE2eDb } from './db';
import { adminHeaders, floorMap } from './helpers';

// The updates page's own pictures (public/updates-img/<language>/), taken from the real site.
// Not part of the normal run:
//   UPDATE_SCREENSHOTS=1 pnpm exec playwright test update-screenshots --project chromium
const MESSAGES = { en, de, fr };
const PAGE = { en: '/welcome', de: '/de', fr: '/fr' };
const OUT = join(__dirname, '..', 'public', 'updates-img');

test.skip(!process.env.UPDATE_SCREENSHOTS, 'only when updating the updates page');
test.use({ viewport: { width: 1280, height: 900 } });

for (const language of ['en', 'de', 'fr'] as const) {
  test(`update screenshots (${language})`, async ({ page }) => {
    const dir = join(OUT, language);
    mkdirSync(dir, { recursive: true });
    await page.goto(`${PAGE[language]}#pricing`);
    const desks = page.getByRole('textbox', { name: MESSAGES[language].site.calc.desks });
    await desks.fill('99');
    await page.waitForTimeout(900); // the total counts up
    const card = page
      .getByRole('heading', { name: MESSAGES[language].site.calc.title })
      .locator('../..');
    await card.screenshot({ path: join(dir, 'price-calculator.jpg'), type: 'jpeg', quality: 80 });
  });
}

for (const language of ['en', 'de', 'fr'] as const) {
  test(`desk booking screenshot (${language})`, async ({ page, baseURL }) => {
    const m = MESSAGES[language];
    const dir = join(OUT, language);
    mkdirSync(dir, { recursive: true });
    resetE2eDb();
    await page
      .context()
      .addCookies([{ name: 'seatline-language', value: language, url: baseURL! }]);
    await page.goto('/map');
    await expect(page.getByTestId('floor-map').locator('canvas').first()).toBeVisible();
    // three free desks become shared; one is booked
    const free = (await floorMap(page)).seats.filter((s) => !s.currentAssignment).slice(0, 3);
    for (const s of free)
      await page.request.patch(`/api/seats/${s.id}`, {
        headers: adminHeaders,
        data: { shared: true },
      });
    await page.reload();
    await expect(page.getByTestId('booking-day')).toBeVisible();
    // pick the desk the keyboard way (the accessible seat list), like a click on the map
    await page
      .getByRole('button', { name: new RegExp(`^\\S+ ${free[1]!.label.replace('.', '\\.')},`) })
      .focus();
    await page.keyboard.press('Enter');
    const card = page.getByTestId('booking-card');
    await card
      .getByRole('button', { name: m.booking.book.replace('{day}', m.booking.todayLower) })
      .click();
    // the confirmation shows, then goes: none in the picture
    const toast = page.locator('[data-sonner-toast]');
    await expect(toast.first()).toBeVisible();
    await expect(toast).toHaveCount(0, { timeout: 15_000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(dir, 'desk-booking.jpg'), type: 'jpeg', quality: 72 });
  });
}
