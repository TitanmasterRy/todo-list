import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

test('periodic table: details, keyboard, highlight, molar mass, notecards', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('Escape');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('7');
  await page.getByRole('tablist', { name: 'Tool groups' }).getByRole('tab', { name: 'Compute' }).click();
  await page
    .getByRole('tablist', { name: 'Tools' })
    .getByRole('tab', { name: /Periodic table/ })
    .click();
  await page.getByRole('button', { name: 'Iron, Fe, atomic number 26' }).click();
  const detail = page.locator('.detail');
  await expect(detail).toContainText('Iron');
  await expect(detail).toContainText('[Ar] 4s2 3d6');
  await expect(detail).toContainText('Period 4, group 8, d-block');
  await page.keyboard.press('ArrowRight');
  await expect(detail).toContainText('Cobalt');
  await page.keyboard.press('ArrowDown');
  await expect(detail).toContainText('Rhodium');
  await page.getByLabel('Chemical formula').fill('H2SO4');
  await expect(page.locator('.mm')).toContainText('98.07');
  await page.getByLabel('Chemical formula').fill('Ca(OH');
  await expect(page.locator('.err')).toContainText('never closed');
  await page.getByLabel('Highlight').selectOption('noble');
  await expect(page.locator('.el:not(.dim)')).toHaveCount(7);
  await page.getByRole('button', { name: /Notecards \(7\)/ }).click();
  await expect(page.getByText('Added 7 cards to “Elements: Noble gases”')).toBeVisible();
  if (process.env.SHOT_DIR) {
    await page.getByLabel('Highlight').selectOption('');
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.locator('.pt').screenshot({ path: `${process.env.SHOT_DIR}/pt-${scheme}.png` });
    }
  }
});
