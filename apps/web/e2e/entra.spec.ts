import { expect, test, type Page } from '@playwright/test';
import { resetE2eDb } from './db';
import { clearMails, lastLink, mailsTo } from './mail';
import { openFold } from './helpers';

// The web app in "entra" mode against a fake Microsoft login (e2e/fake-microsoft.mjs).

test.beforeEach(() => {
  resetE2eDb();
  clearMails();
});

const signInAs = (page: Page, email: string) =>
  page.goto(`/auth/login?login_hint=${encodeURIComponent(email)}`);

test('pages need a Microsoft sign-in; the sign-in button goes to Microsoft and back', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/signin$/);
  await page.getByRole('link', { name: 'Sign in with Microsoft' }).click();
  // first sign-in from a new organisation → onboarding
  await expect(page).toHaveURL(/\/onboarding$/);
});

test('the website and legal pages need no sign-in', async ({ page }) => {
  await page.goto('/legal/privacy');
  await expect(page.getByRole('heading', { name: 'Privacy policy' })).toBeVisible();
  await page.goto('/welcome');
  await expect(page.getByRole('link', { name: 'Try it free for 30 days' }).first()).toBeVisible();
  await page.goto('/signin');
  await page.getByRole('link', { name: 'terms of service' }).click();
  await expect(page.getByRole('heading', { name: 'Terms of service' })).toBeVisible();

  // the help center: public, each language with its own address, steps with screenshots
  await page.goto('/help');
  await expect(page).toHaveURL(/\/help\/en$/);
  await page.waitForLoadState('networkidle'); // a click while the page still loads can get lost
  await page
    .getByTestId('help-topics')
    .getByRole('link', { name: /Planning moves/ })
    .click();
  await expect(page).toHaveURL(/\/help\/en\/moves$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Planning moves');
  const shot = page.getByTestId('help-steps').getByRole('img').first();
  await expect(shot).toBeVisible();
  expect(await shot.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('link', { name: 'DE', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Umzüge planen');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de-CH');
  expect(await (await page.request.get('/sitemap.xml')).text()).toContain('/help/fr/moves');
});

test('visitors try a demo workspace from the website, then start a real trial', async ({
  page,
}) => {
  await page.goto('/welcome');
  await page.getByRole('link', { name: 'Try the demo' }).first().click();
  await expect(page.getByRole('heading', { name: 'Try Seatline' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to the website' })).toBeVisible();
  await page.getByRole('button', { name: 'Open the demo' }).click();
  await expect(page.getByTestId('demo-banner')).toBeVisible();
  await page.goto('/map');
  await expect(page.getByTestId('floor-map').locator('canvas').first()).toBeVisible();
  await page
    .getByTestId('demo-banner')
    .getByRole('button', { name: 'Start your free trial' })
    .click();
  await expect(page).toHaveURL(/\/signin/);

  // or leave it: back to the website
  await page.goto('/welcome');
  await page.getByRole('link', { name: 'Try the demo' }).first().click();
  await page.getByRole('button', { name: 'Open the demo' }).click();
  await page.getByTestId('demo-banner').getByRole('button', { name: 'Leave the demo' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Know who sits where.' })).toBeVisible();
});

test('a new organisation creates its workspace; a colleague joins as viewer', async ({
  page,
  browser,
}) => {
  await signInAs(page, 'first@newco.example');
  await expect(
    page.getByRole('heading', { name: 'Set up Seatline for your organisation' }),
  ).toBeVisible();
  await expect(page.getByText('first@newco.example')).toBeVisible();
  await page.getByLabel('Organisation name').fill('NewCo AG');
  await page.getByRole('button', { name: 'Create workspace' }).click();

  // the empty workspace, with the first person as admin
  await expect(page.getByTestId('account-menu')).toContainText('NewCo AG');
  await expect(page.getByTestId('account-menu')).toContainText('Admin');
  await expect(page.getByRole('button', { name: 'Create your first building' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'People & access' })).toBeVisible();

  // a colleague from the same organisation, in another browser
  const other = await browser.newPage();
  await signInAs(other, 'second@newco.example');
  await expect(other.getByTestId('account-menu')).toContainText('NewCo AG');
  await expect(other.getByTestId('account-menu')).toContainText('Viewer');
  await expect(other.getByRole('link', { name: 'People & access' })).toHaveCount(0);
  await other.close();

  // the admin sees both people
  await page.getByRole('link', { name: 'People & access' }).click();
  await expect(page.getByTestId('directory')).toContainText('second@newco.example');
  await page.getByRole('tab', { name: 'Settings' }).click();
  await openFold(page, 'Microsoft 365');
  await expect(page.getByTestId('sync-status')).toContainText('People haven’t been synced yet');
});

test('another organisation never sees the first one’s workspace', async ({ page, browser }) => {
  await signInAs(page, 'first@newco.example');
  await page.getByLabel('Organisation name').fill('NewCo AG');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByTestId('account-menu')).toContainText('NewCo AG');

  const stranger = await browser.newPage();
  await signInAs(stranger, 'boss@otherorg.example');
  await expect(stranger).toHaveURL(/\/onboarding$/); // their own, new organisation
  await stranger.close();
});

test('sign out, and the API refuses requests without a session (dev headers are ignored)', async ({
  page,
}) => {
  await signInAs(page, 'first@newco.example');
  await page.getByLabel('Organisation name').fill('NewCo AG');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  // the website and help center know you're signed in
  await page.goto('/welcome');
  await expect(page.getByRole('link', { name: 'Open Seatline' })).toBeVisible();
  await page.goto('/help/en');
  await expect(page.getByRole('link', { name: 'Open Seatline' })).toBeVisible();
  await page.goto('/');
  await page.getByTestId('account-menu').click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/signin\?signedOut=1$/);
  await page.goto('/welcome');
  await expect(page.getByRole('link', { name: 'Sign in', exact: true }).first()).toBeVisible();
  await page.goto('/');
  await expect(page).toHaveURL(/\/signin$/);

  const res = await page.request.get('/api/buildings', {
    headers: {
      'x-tenant-id': '11111111-1111-4111-8111-111111111111',
      'x-user-id': '11111111-1111-4111-8111-0000000000a1',
    },
  });
  expect(res.status()).toBe(401);
});

// ---- sign-in with an e-mail link (workspaces without Microsoft 365) ---------------------

async function emailSignIn(page: Page, email: string) {
  await page.goto('/signin');
  await page.getByLabel('Work e-mail').fill(email);
  await page.getByRole('button', { name: 'E-mail me a sign-in link' }).click();
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
  const link = lastLink(email);
  expect(link).toContain('/auth/email?token=');
  await page.goto(link!);
  // the link page doesn't sign in by itself (mail scanners open links): one click does
  await page.getByRole('button', { name: 'Continue' }).click();
  return link!;
}

test('an e-mail link signs in once; admins add and invite people', async ({ page, browser }) => {
  const link = await emailSignIn(page, 'admin@alpenblick.example');
  await expect(page.getByTestId('account-menu')).toContainText('Alpenblick AG');
  await expect(page.getByTestId('account-menu')).toContainText('Admin');

  // the link is used up
  const again = await browser.newPage();
  await again.goto(link);
  await again.getByRole('button', { name: 'Continue' }).click();
  await expect(again.getByText(/expired or was already used/)).toBeVisible();
  await again.close();

  // add a colleague and invite her
  await page.goto('/people');
  await page.getByRole('button', { name: 'Add person' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name', { exact: true }).fill('Nora Neu');
  await dialog.getByLabel('E-mail', { exact: true }).fill('nora@alpenblick.example');
  await dialog.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('Nora Neu added and invited')).toBeVisible();
  expect(mailsTo('nora@alpenblick.example')[0]?.subject).toBe(
    'Alpenblick AG Admin added you to Seatline',
  );

  // she follows the invitation: the sign-in page with her address filled in
  const nora = await browser.newPage();
  await nora.goto(lastLink('nora@alpenblick.example')!);
  await expect(nora.getByLabel('Work e-mail')).toHaveValue('nora@alpenblick.example');
  await emailSignIn(nora, 'nora@alpenblick.example');
  await expect(nora.getByTestId('account-menu')).toContainText('Viewer');
  await nora.close();
});

test('a new company signs up with an e-mail link', async ({ page }) => {
  await emailSignIn(page, 'founder@small.example');
  await expect(page.getByText('Create your company’s workspace')).toBeVisible();
  await page.getByLabel('Organisation name').fill('Small GmbH');
  await page.getByLabel('Your name').fill('Fiona Founder');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByTestId('account-menu')).toContainText('Small GmbH');

  // Home shows the first steps until they're done (or hidden)
  await page.goto('/');
  const steps = page.getByTestId('getting-started');
  await expect(steps).toContainText('0 of 4 done');
  await expect(steps.getByRole('link', { name: 'Add building' })).toHaveAttribute('href', '/map');
  await steps.getByRole('button', { name: 'Hide this checklist' }).click();
  await expect(steps).toBeHidden();
  await page.reload();
  await expect(page.getByTestId('dashboard')).toBeVisible();
  await expect(steps).toBeHidden();
});
