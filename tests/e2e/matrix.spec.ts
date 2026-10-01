import { expect, test } from '@playwright/test';
import { addTask, openApp } from './helpers';

test('priority matrix sorts open tasks into four boxes', async ({ page }) => {
  const errors = await openApp(page);
  await addTask(page, 'Bio exam tomorrow !high');
  await addTask(page, 'History project in 3 weeks !high');
  await addTask(page, 'Worksheet today');
  await addTask(page, 'Optional reading in 4 weeks');
  await page.keyboard.press('Escape');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('7');
  await page.getByRole('tablist', { name: 'Tool groups' }).getByRole('tab', { name: 'Plan' }).click();
  await page
    .getByRole('tablist', { name: 'Tools' })
    .getByRole('tab', { name: /Priority matrix/ })
    .click();
  await expect(page.locator('.box.do')).toContainText('Bio exam');
  await expect(page.locator('.box.plan')).toContainText('History project');
  await expect(page.locator('.box.quick')).toContainText('Worksheet');
  await expect(page.locator('.box.later')).toContainText('Optional reading');
  // the rows work in place: completing a task takes it out of its box
  await page.locator('.box.quick .task', { hasText: 'Worksheet' }).getByRole('checkbox').click();
  await expect(page.locator('.box.quick')).not.toContainText('Worksheet');
  expect(errors).toEqual([]);
});

test('spread overdue tasks over the week, and undo it', async ({ page }) => {
  const errors = await openApp(page, { dailyCapacityMin: 60 });
  await addTask(page, 'Lab write-up yesterday ~45m');
  await addTask(page, 'Problem set yesterday ~45m');
  await addTask(page, 'Vocab list yesterday ~45m');
  const overdue = page.locator('.section-title.overdue');
  await expect(overdue).toContainText('3');
  await overdue.getByRole('button', { name: 'Spread over the week' }).click();
  // one fits today's hour of capacity; the others land on later days (and leave Overdue)
  await expect(page.locator('.section-title.overdue')).toHaveCount(0);
  await expect(page.locator('.toast', { hasText: 'Spread 3 overdue tasks over 3 days' })).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(page.locator('.section-title.overdue')).toContainText('3');
  expect(errors).toEqual([]);
});
