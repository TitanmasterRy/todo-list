import { expect, test } from '@playwright/test';
import { addTask, openApp } from './helpers';

// Phone-only checks: the "phone" project runs the @phone tests on a Pixel 7; the desktop project skips them.
test.skip(({ isMobile }) => !isMobile, 'phone layout only');

test('no view scrolls sideways on a phone @phone', async ({ page }) => {
  const errors = await openApp(page);
  await addTask(page, 'A task with a fairly long title that should wrap nicely on a small screen tomorrow ~45m #bio !high');
  for (const view of ['today', 'upcoming', 'courses', 'inbox', 'focus', 'stats', 'tools', 'settings']) {
    await page.goto(`./?view=${view}`);
    await expect(page.locator('.shell')).toBeVisible();
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, view).toBeLessThanOrEqual(0);
  }
  expect(errors).toEqual([]);
});

test('toasts stay out of the way: two at most, clear of the + button @phone', async ({ page }) => {
  await openApp(page);
  for (const t of ['One', 'Two', 'Three', 'Four']) await addTask(page, `${t} today`);
  const visible = page.locator('.toast:visible');
  await expect(visible).toHaveCount(2);
  const toast = await visible.last().boundingBox();
  const fab = await page.getByRole('button', { name: 'Add task' }).boundingBox();
  expect(toast && fab && toast.x + toast.width <= fab.x).toBe(true);
});

test('the task editor opens as a sheet with Save in reach @phone', async ({ page }) => {
  await openApp(page);
  await addTask(page, 'Sheet task');
  await page.locator('.task', { hasText: 'Sheet task' }).locator('.title').click();
  const modal = page.locator('.modal');
  await expect(modal).toBeVisible();
  const box = await modal.boundingBox();
  const vw = await page.evaluate(() => window.innerWidth);
  expect(box?.width).toBe(vw);
  // the buttons are pinned to the bottom of the sheet, so they're on screen before any scrolling
  const save = page.getByRole('button', { name: 'Save', exact: true });
  await expect(save).toBeInViewport();
  await save.click();
  await expect(modal).toHaveCount(0);
});

test('inbox filters fold away behind a button @phone', async ({ page }) => {
  await openApp(page);
  await page.goto('./?view=inbox');
  await expect(page.locator('.shell')).toBeVisible();
  await expect(page.getByLabel('Course', { exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Filters' }).click();
  await expect(page.getByLabel('Course', { exact: true })).toBeVisible();
  await page.getByLabel('Priority', { exact: true }).selectOption('urgent');
  await page.getByRole('button', { name: /Hide filters/ }).click();
  await expect(page.getByLabel('Course', { exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: /Filters · 1/ })).toBeVisible();
});

test('overdue actions sit on their own line under the heading @phone', async ({ page }) => {
  await openApp(page);
  await addTask(page, 'Old one yesterday');
  await addTask(page, 'Old two yesterday');
  const head = page.locator('.section-title.overdue');
  const title = await head.locator('span').first().boundingBox();
  const roll = await head.getByRole('button', { name: 'Roll all to today' }).boundingBox();
  expect(roll && title && roll.y > title.y + title.height - 1).toBe(true);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
