import { expect, test, type Page } from '@playwright/test';
import { openApp } from './helpers';

async function goKey(page: Page, key: string) {
  await page.keyboard.press('Escape');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press(key);
}

test('grades: trend chart, what-if and letter scales', async ({ page }) => {
  await openApp(page, { autoDescribe: false });
  await goKey(page, '3');
  await page.getByRole('button', { name: '+ New course' }).click();
  await page.getByRole('form', { name: 'New course' }).getByLabel('Name', { exact: true }).fill('History');
  await page.getByRole('form', { name: 'New course' }).getByLabel('Name', { exact: true }).press('Enter');
  await goKey(page, '7');
  await page.getByRole('tablist', { name: 'Tool groups' }).getByRole('tab', { name: 'Grades' }).click();
  await page
    .getByRole('tablist', { name: 'Tools' })
    .getByRole('tab', { name: /Grade calculator/ })
    .click();

  const form = page.locator('form.addg');
  await form.getByLabel('Course').selectOption({ label: 'History' });
  for (const [title, weight] of [
    ['Quiz 1', '10'],
    ['Quiz 2', '10'],
    ['Essay', '30'],
    ['Final exam', '50'],
  ]) {
    await form.getByLabel('Title').fill(title);
    await form.getByLabel('Weight').fill(weight);
    await form.getByRole('button', { name: 'Add' }).click();
  }
  const scores = page.getByLabel('Score', { exact: true });
  await scores.nth(0).fill('90');
  await scores.nth(0).press('Tab');
  await scores.nth(1).fill('80');
  await scores.nth(1).press('Tab');
  await scores.nth(2).fill('89');
  await scores.nth(2).press('Tab');
  await expect(page.locator('.grade').first()).toContainText('87.4% B+');

  await page.getByRole('button', { name: '📈 Trend' }).click();
  const chart = page.getByRole('img', { name: /History grade trend: average 87.4% after 3 graded items/ });
  await expect(chart).toBeVisible();
  await chart.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.tip')).toContainText('Quiz 1: 90%');

  await page.getByRole('button', { name: /What if/ }).click();
  const wi = page.getByRole('group', { name: 'What if for History' });
  await wi.getByLabel('Imagined score for Final exam').fill('95');
  await expect(wi.getByRole('status')).toContainText('Final grade: 91.2% A−');

  await page.getByLabel('Letter scale for History').selectOption('ten');
  await expect(wi.getByRole('status')).toContainText('91.2% A');
  await expect(page.locator('.grade').first()).toContainText('87.4% B');
  await page.getByLabel('Letter scale for History').selectOption('custom');
  const custom = page.getByLabel('Custom scale for History');
  await custom.fill('A 85, B 75, F 0');
  await custom.press('Tab');
  await expect(page.locator('.grade').first()).toContainText('87.4% A');

  await chart.focus();
  await page.keyboard.press('ArrowRight');
  if (process.env.SHOT_DIR) {
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page
        .locator('section.card div.course')
        .first()
        .screenshot({ path: `${process.env.SHOT_DIR}/grades-${scheme}.png` });
    }
  }
});
