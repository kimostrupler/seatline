import { expect, test } from '@playwright/test';
import { resetE2eDb } from './db';
import { switchUser } from './helpers';

test.beforeEach(() => resetE2eDb());

test('the owner dashboard: only for the operator, linked nowhere', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Business overview/ })).toHaveCount(0);

  await page.goto('/owner');
  await expect(page.getByRole('heading', { name: 'Business overview' })).toBeVisible();
  await expect(page.getByTestId('owner-workspaces')).toContainText('Alpenblick');
  await expect(page.getByTestId('owner-workspaces')).toContainText('admin@alpenblick.example');

  // anyone else: the same "not found" as an address that doesn't exist
  await page.goto('/');
  await switchUser(page, 'Luca Rossi');
  await page.goto('/owner');
  await expect(page.getByText('This page could not be found.')).toBeVisible();
  await expect(page.getByText('Business overview')).toHaveCount(0);
});

test('outreach leads: one personal e-mail, scheduled for the morning', async ({ page }) => {
  await page.goto('/owner');
  await page.getByRole('link', { name: 'Leads' }).click();
  await expect(page.getByRole('heading', { name: 'Leads' })).toBeVisible();
  await page.getByRole('button', { name: 'New lead' }).click();
  const panel = page.getByRole('dialog');
  await panel.getByLabel('Company').fill('Livingdocs');
  await panel.getByLabel('Greeting').fill('Herr van der Ploeg');
  await panel.getByLabel('E-mail', { exact: true }).fill('contact@livingdocs.io');
  await panel.getByRole('button', { name: 'Add lead' }).click();
  await expect(panel.getByRole('heading', { name: 'Livingdocs' })).toBeVisible();

  // without the personal "why now" sentence nothing can be scheduled
  await panel.getByRole('button', { name: 'Write the first e-mail' }).click();
  const body = panel.getByLabel('Message');
  await expect(body).toHaveValue(/Guten Tag Herr van der Ploeg/);
  await expect(panel.getByRole('button', { name: 'Schedule' })).toBeDisabled();
  await expect(panel.getByText(/Write the “why now” sentence first/)).toBeVisible();

  await panel
    .getByLabel('Why now (the first sentence)')
    .fill('Ich habe gesehen, dass Livingdocs weiter wächst.');
  await panel.getByRole('button', { name: 'Save' }).click();
  // the draft follows the saved lead
  await expect(body).toHaveValue(/Ich habe gesehen, dass Livingdocs weiter wächst\./);
  // a word count only as a guide: a longer e-mail can still go out
  const text = await body.inputValue();
  await body.fill(`${text}\n${'Wort '.repeat(40)}`);
  await expect(panel.getByTestId('word-count')).toHaveText(/^\d+ words$/);
  await expect(panel.getByRole('button', { name: 'Schedule' })).toBeEnabled();
  await body.fill(text);
  await panel.getByRole('button', { name: 'Schedule' }).click();
  await expect(page.getByText(/E-mail scheduled for/)).toBeVisible();
  await expect(panel.getByText(/First e-mail · Goes out/)).toBeVisible();
  await panel.getByRole('button', { name: 'Don’t send' }).click();
  await expect(panel.getByText('Not sent (cancelled)')).toBeVisible();

  // or right away, after one confirmation
  await panel.getByRole('button', { name: 'Write the first e-mail' }).click();
  await expect(body).toHaveValue(/Livingdocs weiter wächst/);
  await panel.getByRole('button', { name: 'Send now' }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText('contact@livingdocs.io');
  await confirm.getByRole('button', { name: 'Send now' }).click();
  await expect(page.getByText('E-mail sent')).toBeVisible();
  await expect(panel.getByText(/^Sent /)).toBeVisible();
  await expect(panel.getByLabel('Status')).toHaveValue('sent');

  // anyone else: not found
  await page.goto('/');
  await switchUser(page, 'Luca Rossi');
  await page.goto('/owner/leads');
  await expect(page.getByText('This page could not be found.')).toBeVisible();
});

test('researched leads come in from a file and wait under To do', async ({ page }) => {
  await page.goto('/owner/leads');
  // wait for the page to be ready before handing it the file
  await expect(page.getByRole('group', { name: 'Where each lead is' })).toBeVisible();
  const leads = [
    {
      company: 'Muster AG',
      contactEmail: 'info@muster.example',
      whyNow: 'Ich habe gelesen, dass Sie umziehen.',
      status: 'ready', // ignored: imported leads start as "Research"
    },
  ];
  await page.locator('input[type=file]').setInputFiles({
    name: 'leads.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(leads)),
  });
  await expect(page.getByText('1 lead added')).toBeVisible();
  await expect(page.getByRole('main')).toContainText('Muster AG');
  // the same file again: nothing new
  await page.locator('input[type=file]').setInputFiles({
    name: 'leads.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(leads)),
  });
  await expect(page.getByText('0 leads added')).toBeVisible();
  await expect(page.getByText('Already there, skipped: Muster AG')).toBeVisible();
});

test('leads sit in one tab per step; "send all" writes and sends to every ready lead', async ({
  page,
}) => {
  await page.goto('/owner/leads');
  const leads = ['Alpha', 'Beta'].map((name) => ({
    company: `${name} AG`,
    greeting: 'Frau Muster',
    contactEmail: `it@${name.toLowerCase()}.example`,
    whyNow: 'Ich habe gelesen, dass Sie umziehen.',
  }));
  // wait for the page to be ready before handing it the file
  await expect(page.getByRole('group', { name: 'Where each lead is' })).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({
    name: 'leads.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify([...leads, { company: 'Gamma AG' }])),
  });
  await expect(page.getByText('3 leads added')).toBeVisible();
  const tabs = page.getByRole('group', { name: 'Where each lead is' });
  await tabs.getByRole('button', { name: /^To write/ }).click();
  await expect(page.getByTestId('leads')).toContainText('Alpha AG');
  await expect(page.getByTestId('leads')).not.toContainText('Gamma AG');

  await page.getByRole('button', { name: 'Write and send to all ready (2)' }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText('to 2 leads now');
  await confirm.getByRole('button', { name: 'Send now' }).click();
  await expect(page.getByText('2 e-mails sent')).toBeVisible();
  await expect(page.getByText('No leads at this step.')).toBeVisible();
  await tabs.getByRole('button', { name: /^Waiting for an answer/ }).click();
  await expect(page.getByTestId('leads')).toContainText('Beta AG');
});

test('write all: each ready lead’s e-mail one after the other, then schedule the rest', async ({
  page,
}) => {
  await page.goto('/owner/leads');
  await expect(page.getByRole('group', { name: 'Where each lead is' })).toBeVisible();
  const leads = ['Alpha', 'Beta', 'Gamma'].map((name) => ({
    company: `${name} AG`,
    greeting: 'Frau Muster',
    contactEmail: `it@${name.toLowerCase()}.example`,
    whyNow: 'Ich habe gelesen, dass Sie umziehen.',
  }));
  await page.locator('input[type=file]').setInputFiles({
    name: 'leads.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(leads)),
  });
  await expect(page.getByText('3 leads added')).toBeVisible();

  await page.getByRole('button', { name: 'Write all one by one (3)' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('1 of 3')).toBeVisible();
  const body = sheet.getByLabel('Message');
  await expect(body).toHaveValue(/Frau Muster/);
  await body.fill(`${await body.inputValue()}\nPS: Persönlich ergänzt.`);
  await sheet.getByRole('button', { name: 'Schedule', exact: true }).click();
  await expect(sheet.getByText('2 of 3')).toBeVisible();
  await sheet.getByRole('button', { name: 'Skip' }).click();
  await expect(sheet.getByText('3 of 3')).toBeVisible();
  // the skipped one and this one: both still waiting
  await sheet.getByRole('button', { name: 'Schedule the rest as they are (2)' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Schedule' }).click();
  await expect(page.getByText('2 e-mails scheduled')).toBeVisible();
  await page.keyboard.press('Escape');
  await page
    .getByRole('group', { name: 'Where each lead is' })
    .getByRole('button', { name: /^Scheduled 3/ })
    .click();
  await expect(page.getByTestId('leads')).toContainText('Beta AG');
});
