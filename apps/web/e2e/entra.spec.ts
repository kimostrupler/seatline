import { expect, test, type Page } from '@playwright/test';
import { resetE2eDb } from './db';

// The web app in "entra" mode against a fake Microsoft login (e2e/fake-microsoft.mjs).

test.beforeEach(() => resetE2eDb());

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
  await expect(page.getByRole('link', { name: 'Start 30 days free' }).first()).toBeVisible();
  await page.goto('/signin');
  await page.getByRole('link', { name: 'terms of service' }).click();
  await expect(page.getByRole('heading', { name: 'Terms of service' })).toBeVisible();
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
  await page.getByTestId('account-menu').click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/signin\?signedOut=1$/);
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
