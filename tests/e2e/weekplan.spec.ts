import { expect, test, type Page } from '@playwright/test';
import { addTask, openApp } from './helpers';

async function goKey(page: Page, key: string) {
  await page.keyboard.press('Escape');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press(key);
}

test('plan my week spreads work by capacity and pins it', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 5, 15, 0)); // Monday afternoon
  await openApp(page, { autoDescribe: false, dailyCapacityMin: 60 });
  await addTask(page, 'Bio lab tomorrow ~45m');
  await addTask(page, 'History essay fri ~60m');
  await addTask(page, 'Read chapter 3 fri ~30m');
  await goKey(page, '7');
  await page.getByRole('tablist', { name: 'Tool groups' }).getByRole('tab', { name: 'Plan' }).click();
  await page
    .getByRole('tablist', { name: 'Tools' })
    .getByRole('tab', { name: /Plan my week/ })
    .click();
  await expect(page.getByLabel('Monday Oct 5')).toContainText('Bio lab');
  await expect(page.getByLabel('Tuesday Oct 6')).toContainText('History essay');
  await expect(page.getByLabel('Wednesday Oct 7')).toContainText('Read chapter 3');
  await page.getByRole('button', { name: /Apply plan \(3\)/ }).click();
  await expect(page.getByText('Planned 3 tasks into your week')).toBeVisible();
  await goKey(page, '1');
  const bio = page.getByRole('group', { name: 'Bio lab' });
  await expect(bio).toBeVisible();
  await expect(bio).toContainText('📌 today');
  await expect(page.getByRole('group', { name: 'History essay' })).toHaveCount(0);
});
