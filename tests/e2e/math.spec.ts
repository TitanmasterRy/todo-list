import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

test('LaTeX math renders on notecards', async ({ page }) => {
  const errors = await openApp(page, { autoDescribe: false });
  await page.keyboard.press('Escape');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('7');
  await page.getByRole('tablist', { name: 'Tool groups' }).getByRole('tab', { name: 'Study' }).click();
  await page
    .getByRole('tablist', { name: 'Tools' })
    .getByRole('tab', { name: /Notecards/ })
    .click();
  await page.getByLabel('Deck name').fill('Geometry');
  await page.getByLabel('Deck name').press('Enter');
  await page.getByLabel('Front', { exact: true }).fill('Area of a circle');
  await page.getByLabel('Back', { exact: true }).fill('$\\pi r^2$ (costs $5 to print)');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const back = page.locator('.bk').first();
  await expect(back.locator('.katex')).toBeVisible();
  await expect(back).toContainText('(costs $5 to print)');
  // MathML is there for screen readers
  await expect(back.locator('math')).toHaveCount(1);
  expect(errors).toEqual([]);
});
