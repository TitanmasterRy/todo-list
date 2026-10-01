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

test('the tab bar has four tabs and a More sheet with the rest @phone', async ({ page }) => {
  const errors = await openApp(page);
  const bar = page.locator('.tabbar');
  await expect(bar.getByRole('button')).toHaveCount(5);
  await bar.getByRole('button', { name: 'More' }).click();
  const sheet = page.getByRole('dialog', { name: 'More' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('menuitem')).toHaveCount(6);
  await sheet.getByRole('menuitem', { name: /Stats/ }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Stats' })).toBeVisible();
  // the More tab now shows where you are
  await expect(bar.getByRole('button', { name: 'More' })).toHaveCount(0);
  await expect(bar.getByRole('button', { name: 'Stats' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('the + button opens quick add in a sheet, which closes once the task is in @phone', async ({ page }) => {
  const errors = await openApp(page);
  await page.goto('./?view=focus');
  await expect(page.locator('.shell')).toBeVisible();
  await page.getByRole('button', { name: 'Add task' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add task' });
  await expect(sheet).toBeVisible();
  const box = sheet.locator('[data-quick-add]');
  await expect(box).toBeFocused();
  await box.fill('From the sheet tomorrow');
  await box.press('Enter');
  await expect(sheet).toHaveCount(0);
  await page.goto('./?view=upcoming');
  await expect(page.locator('.task', { hasText: 'From the sheet' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a row’s ⋯ opens the action sheet: snooze, done, delete @phone', async ({ page }) => {
  const errors = await openApp(page);
  await addTask(page, 'Sheet me today');
  await addTask(page, 'And me today');
  await addTask(page, 'Bin me today');
  const row = page.locator('.task', { hasText: 'Sheet me' });
  // the hover strip is gone on phones; the ⋯ is there
  await expect(row.locator('.actions')).toBeHidden();
  await row.getByRole('button', { name: 'More actions' }).click();
  const sheet = page.getByRole('dialog', { name: 'Task actions' });
  await expect(sheet).toContainText('Sheet me');
  await sheet.getByRole('button', { name: /Tomorrow/ }).click();
  await expect(sheet).toHaveCount(0);
  await expect(row).toHaveCount(0); // it moved to tomorrow
  const other = page.locator('.task', { hasText: 'And me' });
  await other.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('dialog', { name: 'Task actions' }).getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('.toast', { hasText: 'And me' })).toBeVisible();
  await expect(other.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
  const third = page.locator('.task', { hasText: 'Bin me' });
  await third.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('dialog', { name: 'Task actions' }).getByRole('button', { name: 'Delete' }).click();
  await expect(third).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('settings has a jump row that scrolls to a section @phone', async ({ page }) => {
  await openApp(page);
  await page.goto('./?view=settings');
  await expect(page.locator('.shell')).toBeVisible();
  const jump = page.getByRole('navigation', { name: 'Jump to a section' });
  await expect(jump).toBeVisible();
  await jump.getByRole('button', { name: 'Trash' }).click();
  await page.waitForTimeout(800);
  await expect(page.getByRole('heading', { name: /Trash/ })).toBeInViewport();
});
