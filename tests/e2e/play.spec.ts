import { expect, test } from '@playwright/test';
import { openApp, seedCoins } from './helpers';

test('shop, a casino round, and an arcade game in the sandbox', async ({ page }) => {
  const errors = await openApp(page);
  await seedCoins(page, 200);
  await page.goto('./?view=play');
  await page.getByRole('tab', { name: /Shop/ }).click();
  await page.locator('.item', { hasText: '550 chips' }).getByRole('button').click();
  await page.locator('.item', { hasText: 'Arcade voucher' }).first().getByRole('button').click();
  const wallet = page.locator('.wallet').first();
  await expect(wallet).toContainText('135'); // 200 - 50 - 15
  await expect(wallet).toContainText('550');

  await page.getByRole('tab', { name: /Casino/ }).click();
  await page.locator('.tile', { hasText: 'Dice' }).click();
  await page.getByRole('button', { name: 'Roll' }).click();
  await expect(page.locator('.cz-result')).not.toBeEmpty();
  await page.getByRole('button', { name: '← All games' }).click();

  await page.getByRole('tab', { name: /Arcade/ }).click();
  await page.locator('.game', { hasText: 'Snake' }).getByRole('button', { name: 'Play' }).click();
  const frame = page.frameLocator('.player iframe');
  await expect(frame.locator('#go')).toBeVisible();
  // the game runs in an opaque origin: no access to the app's storage
  const storage = await page
    .frames()
    .find((f) => f.url().includes('snake.html'))!
    .evaluate(() => {
      try {
        return String(localStorage.length);
      } catch (e) {
        return (e as Error).name;
      }
    });
  expect(storage).toBe('SecurityError');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.wallet .w', { hasText: 'vouchers' })).toContainText('0');
  // the sandbox refusing the game's storage access is expected
  expect(errors.filter((e) => !/sandboxed/.test(e))).toEqual([]);
});
