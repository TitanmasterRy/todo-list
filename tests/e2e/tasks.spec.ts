import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { addTask, openApp } from './helpers';

test('add, complete and undo a task; coins follow', async ({ page }) => {
  const errors = await openApp(page);
  await addTask(page, 'Read chapter 4 tomorrow !high');
  const row = page.locator('.task', { hasText: 'Read chapter 4' });
  await expect(page.getByText('Read chapter 4')).toBeVisible();
  // it's due tomorrow, so it shows on Upcoming
  await page.keyboard.press('Escape');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('2');
  await expect(row).toBeVisible();
  await row.getByRole('checkbox').click();
  const wallet = page.locator('.sidebar .wallet');
  await expect(wallet).not.toContainText('🪙 0');
  await page.keyboard.press('Control+z');
  await expect(wallet).toContainText('🪙 0');
  await expect(row.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');
  expect(errors).toEqual([]);
});

test('deleted tasks go to the trash and can be restored', async ({ page }) => {
  await openApp(page);
  await addTask(page, 'Lab report');
  const row = page.locator('.task', { hasText: 'Lab report' });
  await row.hover();
  await row.getByRole('button', { name: 'Delete' }).first().click();
  await expect(row).toHaveCount(0);
  await page
    .getByRole('button', { name: /Settings/ })
    .first()
    .click();
  const trash = page.locator('section', { has: page.getByRole('heading', { name: /Trash/ }) });
  await expect(trash).toContainText('Lab report');
  await trash.getByRole('button', { name: 'Restore' }).click();
  await page.keyboard.press('1');
  await expect(page.locator('.task', { hasText: 'Lab report' })).toBeVisible();
});

test('export downloads a JSON backup with tasks', async ({ page }) => {
  await openApp(page);
  await addTask(page, 'Exported task');
  await page
    .getByRole('button', { name: /Settings/ })
    .first()
    .click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download backup' }).click()]);
  const path = await download.path();
  const json = JSON.parse(readFileSync(path, 'utf8'));
  expect(json.tasks.map((t: { title: string }) => t.title)).toContain('Exported task');
});

test('works offline after the first visit', async ({ page, context }) => {
  await openApp(page);
  // the service worker has precached the app and controls the page
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 20_000 });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.shell')).toBeVisible();
  await addTask(page, 'Offline task');
  await expect(page.locator('.task', { hasText: 'Offline task' })).toBeVisible();
  await context.setOffline(false);
});

test('phone layout has no horizontal scroll @phone', async ({ page }) => {
  await openApp(page);
  await addTask(page, 'A task with a fairly long title that should wrap nicely on a small screen');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
