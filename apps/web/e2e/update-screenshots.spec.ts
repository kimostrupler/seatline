import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import de from '../messages/de.json';
import en from '../messages/en.json';
import fr from '../messages/fr.json';

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
