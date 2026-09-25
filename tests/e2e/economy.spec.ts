import { expect, test } from '@playwright/test';
import { addTask, openApp, seedCoins } from './helpers';

test('daily quests show progress, and the deal of the day is discounted', async ({ page }) => {
  await openApp(page);
  const quests = page.getByRole('region', { name: 'Daily quests' });
  await expect(quests).toBeVisible();
  await expect(quests.locator('li')).toHaveCount(3);
  await seedCoins(page, 300);
  await page.goto('./?view=play');
  await page.getByRole('tab', { name: /Shop/ }).click();
  const deal = page.getByRole('region', { name: 'Deal of the day' });
  await expect(deal).toBeVisible();
  const full = Number(await deal.locator('s').innerText());
  const btn = deal.getByRole('button');
  expect(await btn.innerText()).toContain(String(Math.round(full * 0.7)));
  await btn.click();
  await expect(deal).toContainText('Bought today');
});

test('finishing tasks completes a quest that can be claimed', async ({ page }) => {
  await openApp(page);
  // finish 5 tasks: covers the "finish 3/5 tasks" and ring quests whichever are offered today
  for (let i = 1; i <= 5; i++) await addTask(page, `Quest task ${i}`);
  for (let i = 1; i <= 5; i++) {
    await page
      .locator('.task', { hasText: `Quest task ${i}` })
      .getByRole('checkbox')
      .click();
    await page.waitForTimeout(250);
  }
  const quests = page.getByRole('region', { name: 'Daily quests' });
  const claim = quests.getByRole('button', { name: /Claim/ });
  if ((await claim.count()) === 0) test.skip(true, "today's quests don't include task-count goals");
  const before = await page.locator('.sidebar .wallet').innerText();
  await claim.first().click();
  await expect(page.locator('.sidebar .wallet')).not.toHaveText(before);
});

test('parent PIN locks economy settings; casino daily limit locks the casino', async ({ page }) => {
  const today = new Date();
  const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  await openApp(page, { casinoDailyLimitMin: 10, casinoMinutesByDay: { [key]: 10 } });
  await page.goto('./?view=play');
  await page.getByRole('tab', { name: /Casino/ }).click();
  await expect(page.getByText('Casino time is up for today.')).toBeVisible();

  await page
    .getByRole('button', { name: /Settings/ })
    .first()
    .click();
  await page.getByLabel('New parent PIN').fill('2468');
  await page.getByRole('button', { name: 'Set PIN' }).click();
  await expect(page.locator('#cas')).toBeDisabled();
  await page.getByLabel('Parent PIN').fill('1111');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.locator('#cas')).toBeDisabled();
  await page.getByLabel('Parent PIN').fill('2468');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.locator('#cas')).toBeEnabled();
});
