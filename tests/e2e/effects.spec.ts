import { expect, test } from '@playwright/test';
import { addTask, openApp } from './helpers';

test('closing the daily ring fires confetti without errors, and the background holds still meanwhile', async ({ page }) => {
  const errors = await openApp(page, { effects: 'full' });
  // the default goal is three a day
  for (const title of ['First thing', 'Second thing', 'Third thing']) {
    await addTask(page, `${title} today`);
    await page.locator('.task', { hasText: title }).getByRole('checkbox').click();
  }
  const canvas = page.locator('canvas.confetti');
  await expect(canvas).toHaveClass(/active/);
  await expect(page.locator('html')).toHaveClass(/celebrating/);
  await expect(page.locator('html')).not.toHaveClass(/celebrating/, { timeout: 10_000 });
  await expect(canvas).not.toHaveClass(/active/);
  expect(errors).toEqual([]);
});

test('lite effects turn the glass solid and skip the blur', async ({ page }) => {
  await openApp(page, { effects: 'lite' });
  await expect(page.locator('html')).toHaveClass(/lite-fx/);
  await addTask(page, 'A quick one');
  // the toast is a glass panel: no backdrop blur in lite mode
  const toast = page.locator('.toast').first();
  await expect(toast).toBeVisible();
  const filter = await toast.evaluate((el) => getComputedStyle(el).backdropFilter);
  expect(filter).toBe('none');
  // and the setting is in Appearance
  await page
    .getByRole('button', { name: /Settings/ })
    .first()
    .click();
  await expect(page.getByLabel('Effects')).toHaveValue('lite');
  await page.getByLabel('Effects').selectOption('full');
  await expect(page.locator('html')).not.toHaveClass(/lite-fx/);
});

test('vibration switch lives under Sounds', async ({ page }) => {
  await openApp(page);
  await page
    .getByRole('button', { name: /Settings/ })
    .first()
    .click();
  const sw = page.getByLabel('Vibration');
  await expect(sw).toBeChecked();
  await sw.click();
  await expect(sw).not.toBeChecked();
});
