import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { addTask, openApp } from './helpers';

test('What now? suggests the most urgent task and starts it in Focus', async ({ page }) => {
  await openApp(page);
  await addTask(page, 'Someday reading');
  await addTask(page, 'Chem worksheet today !urgent');
  await page.getByRole('button', { name: /What now/ }).click();
  const card = page.getByRole('region', { name: 'Suggested next task' });
  await expect(card).toContainText('Chem worksheet');
  await expect(card).toContainText('due today');
  await card.getByRole('button', { name: /Start in Focus/ }).click();
  await expect(page.getByRole('heading', { name: /Focus/ }).first()).toBeVisible();
});

test('month calendar shows tasks on their day and adds to the picked day', async ({ page }, info) => {
  await openApp(page);
  await addTask(page, 'Quiz review tomorrow');
  await page.keyboard.press('Escape');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('2');
  await page.getByRole('radio', { name: 'Month' }).click();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const key = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  const cell = page.locator(`[data-cal-day="${key}"]`);
  await expect(cell).toContainText('Quiz review');
  await cell.click();
  await cell.press('ArrowRight');
  await page.locator('.dayview [data-quick-add]').fill('Essay outline');
  await page.locator('.dayview [data-quick-add]').press('Enter');
  const next = new Date(tomorrow);
  next.setDate(next.getDate() + 1);
  const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
  await expect(page.locator(`[data-cal-day="${nextKey}"]`)).toContainText('Essay outline');
  await page.screenshot({ path: info.outputPath('month.png') });
  // the layout choice sticks
  await page.reload();
  await page.keyboard.press('Escape');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('2');
  await expect(page.getByRole('radio', { name: 'Month' })).toHaveAttribute('aria-checked', 'true');
});

test('CSV export and import round-trip', async ({ page }, info) => {
  await openApp(page);
  await addTask(page, 'Lab report, part 2 #bio !high');
  await page
    .getByRole('button', { name: /Settings/ })
    .first()
    .click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
  const csv = readFileSync(await dl.path(), 'utf8');
  expect(csv.split('\r\n')[0]).toContain('title,status,due');
  expect(csv).toContain('"Lab report, part 2"');
  const file = info.outputPath('todoist.csv');
  writeFileSync(file, 'TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE\ntask,Imported essay,,1,1,,,2026-12-01,en,\n');
  await page.locator('input[aria-label="Import CSV file"]').setInputFiles(file);
  await expect(page.getByText('1 tasks found')).toBeVisible();
  await page.getByRole('button', { name: 'Import 1' }).click();
  await page.keyboard.press('4'); // Inbox
  await expect(page.locator('.task', { hasText: 'Imported essay' })).toBeVisible();
});
