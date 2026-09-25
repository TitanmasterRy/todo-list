import { expect, test, type Page } from '@playwright/test';
import { openApp } from './helpers';

async function goKey(page: Page, key: string) {
  await page.keyboard.press('Escape');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press(key);
}

test('syllabus box finds dates and adds tasks and breaks', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 8, 1, 10, 0));
  await openApp(page, { autoDescribe: false });
  await goKey(page, '7');
  await page.getByRole('tablist', { name: 'Tool groups' }).getByRole('tab', { name: 'Plan' }).click();
  await page
    .getByRole('tablist', { name: 'Tools' })
    .getByRole('tab', { name: /Syllabus box/ })
    .click();
  await page.getByLabel('Syllabus text').fill('Aug 20 – Summer reading\nSep 14: Read Chapter 4\n9/18 Quiz: Unit 1\nOct 14 Midterm exam\nNov 23 – Nov 27 Thanksgiving break');
  await page.getByRole('button', { name: 'Find dates' }).click();
  await expect(page.getByLabel('Add Summer reading')).not.toBeChecked(); // in the past
  await expect(page.getByLabel('Type for Midterm exam')).toHaveValue('exam');
  await page.getByLabel('Add Read Chapter 4').uncheck();
  await page.getByRole('button', { name: 'Add 2 tasks + 1 break' }).click();
  await expect(page.getByText('Added 2 tasks and 1 break')).toBeVisible();
  await goKey(page, '4');
  await expect(page.getByRole('group', { name: 'Midterm exam' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Quiz – Unit 1' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Read Chapter 4' })).toHaveCount(0);
  await page
    .getByRole('button', { name: /Settings/ })
    .first()
    .click();
  await expect(page.getByText(/Thanksgiving break · 2026-11-23 → 2026-11-27/)).toBeVisible();
});
