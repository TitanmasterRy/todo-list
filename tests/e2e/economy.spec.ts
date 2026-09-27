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

test('cash chips back into coins at half value, with a daily limit', async ({ page }) => {
  const errors = await openApp(page, { economyEnabled: true });
  await seedCoins(page, 3000, 'chips');
  await page.goto('./?view=play');
  await page.getByRole('tab', { name: /Wallet/ }).click();
  await page.getByLabel('Chips to cash out').fill('400');
  await page.getByRole('button', { name: 'Get 20 🪙' }).click();
  await expect(page.locator('.toast', { hasText: 'Cashed out 400 chips for 20 coins' })).toBeVisible();
  await page.getByRole('button', { name: 'Max' }).click();
  await expect(page.getByRole('button', { name: 'Get 80 🪙' })).toBeVisible();
  await page.getByRole('button', { name: 'Get 80 🪙' }).click();
  await expect(page.getByText("Today's limit is used up")).toBeVisible();
  expect(errors).toEqual([]);
});

test('an arcade game can sell a power-up for coins after the player confirms', async ({ page }) => {
  const errors = await openApp(page, { economyEnabled: true });
  const game = `<!doctype html><html><body><p id="w">no wallet</p><p id="s">none</p><button id="b">Buy</button><script>
    addEventListener('message', (e) => {
      if (e.data.type === 'hwtodo:wallet') document.getElementById('w').textContent = 'coins ' + e.data.coins;
      if (e.data.type === 'hwtodo:bought') document.getElementById('s').textContent = 'bought ' + e.data.id;
      if (e.data.type === 'hwtodo:denied') document.getElementById('s').textContent = 'denied ' + e.data.reason;
    });
    parent.postMessage({ type: 'hwtodo:hello' }, '*');
    document.getElementById('b').onclick = () => parent.postMessage({ type: 'hwtodo:buy', id: 'extra-life', label: 'Extra life', cost: 7 }, '*');
  </script></body></html>`;
  await page.evaluate(
    (html) =>
      new Promise<void>((resolve) => {
        const r = indexedDB.open('homework-todo');
        r.onsuccess = () => {
          const tx = r.result.transaction('games', 'readwrite');
          tx.objectStore('games').put({ id: 'powerups', title: 'Power test', emoji: '⚡', cost: 0, html });
          tx.oncomplete = () => resolve();
        };
      }),
    game,
  );
  await seedCoins(page, 20);
  await page.goto('./?view=play');
  await page.getByRole('tab', { name: /Arcade/ }).click();
  await page.locator('.card.game', { hasText: 'Power test' }).getByRole('button', { name: 'Play' }).click();
  const frame = page.frameLocator('.player iframe');
  await expect(frame.locator('#w')).toHaveText('coins 20');
  await frame.locator('#b').click();
  const ask = page.getByRole('alertdialog');
  await expect(ask).toContainText('Extra life for 7 🪙?');
  await ask.getByRole('button', { name: 'No thanks' }).click();
  await expect(frame.locator('#s')).toHaveText('denied Cancelled');
  await frame.locator('#b').click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Buy' }).click();
  await expect(frame.locator('#s')).toHaveText('bought extra-life');
  await expect(frame.locator('#w')).toHaveText('coins 13');
  await frame.locator('#b').click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Buy' }).click();
  await frame.locator('#b').click();
  await expect(frame.locator('#s')).toHaveText('denied Not enough coins');
  expect(errors.filter((e) => !/sandboxed/.test(e))).toEqual([]);
});
