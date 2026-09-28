import { expect, test, type Page } from '@playwright/test';
import { addTask, openApp, seedCoins } from './helpers';

async function buyChips(page: Page) {
  await page.getByRole('tab', { name: /Shop/ }).click();
  await page.locator('.item', { hasText: '550 chips' }).getByRole('button').click();
  await expect(page.locator('.wallet .w', { hasText: 'chips' })).toContainText('550');
}

test('three card poker and hold’em rounds', async ({ page }) => {
  const errors = await openApp(page);
  await seedCoins(page, 100);
  await page.goto('./?view=play');
  await buyChips(page);
  await page.getByRole('tab', { name: /Casino/ }).click();

  await page.locator('.tile', { hasText: 'Three Card Poker' }).click();
  await page.getByRole('button', { name: 'Deal' }).click();
  await expect(page.locator('.cz-result')).toContainText('Play (match your ante) or fold');
  await page.getByRole('button', { name: 'Hint' }).click();
  await expect(page.locator('.cz-result')).toContainText(/Q-6-4 or better: (play|fold)/);
  await page.getByRole('button', { name: /^Play 10$/ }).click();
  await expect(page.locator('.cz-result')).toContainText(/beat the dealer|Dealer wins|doesn't qualify|Push/);
  await expect(page.locator('.cz-hand').first().getByRole('img', { name: 'Face-down card' })).toHaveCount(0); // dealer revealed
  await page.getByRole('button', { name: '← All games' }).click();

  await page.locator('.tile', { hasText: "Texas Hold'em" }).click();
  await page.getByRole('group', { name: 'Number of bots' }).getByRole('button', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: /Sit down \(200 chips\)/ }).click();
  await expect(page.locator('.wallet .w', { hasText: 'chips' })).not.toContainText('550');
  // fold every hand we're asked to act in until the hand ends
  const fold = page.getByRole('button', { name: 'Fold', exact: true });
  const next = page.getByRole('button', { name: 'Next hand' });
  await expect(fold.or(next)).toBeVisible({ timeout: 10_000 });
  if (await fold.isVisible()) await fold.click();
  await expect(next).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Leave table' }).click();
  await expect(page.getByRole('button', { name: /Sit down/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('limited seasonal items show only during their event', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 20, 12, 0)); // Halloween event
  // the daily prompts key off the (mocked) date: mark them seen for it
  const errors = await openApp(page, { lastFrogPromptDate: '2026-10-20', lastRecapDate: '2026-10-20' });
  await seedCoins(page, 300);
  await page.goto('./?view=play');
  await expect(page.locator('[data-event-banner]')).toContainText('Halloween event');
  await expect(page.locator('.page[data-season="halloween"]')).toBeVisible();
  await page.getByRole('tab', { name: /Shop/ }).click();
  await expect(page.locator('[data-seasonal]')).toContainText('Halloween');
  await expect(page.getByRole('region', { name: 'Halloween event quests' })).toBeVisible();
  const pumpkin = page.locator('.item', { hasText: 'Pumpkin frame' });
  await expect(pumpkin).toBeVisible();
  await pumpkin.getByRole('button', { name: /150/ }).click();
  await expect(pumpkin.getByRole('button', { name: 'Equipped' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('no seasonal items outside an event', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 8, 27, 12, 0));
  await openApp(page, { lastFrogPromptDate: '2026-09-27', lastRecapDate: '2026-09-27' });
  await page.goto('./?view=play');
  await page.getByRole('tab', { name: /Shop/ }).click();
  await expect(page.locator('[data-event-banner]')).toHaveCount(0);
  await expect(page.locator('.item', { hasText: 'Pumpkin frame' })).toHaveCount(0);
  await expect(page.locator('.soon')).toContainText('Next event: 🎃 Halloween in 18 days');
});

test('a gift code moves a cosmetic from one browser to another, once', async ({ page, browser, baseURL }) => {
  const errors = await openApp(page);
  await seedCoins(page, 150);
  await page.goto('./?view=play');
  await page.getByRole('tab', { name: /Shop/ }).click();
  const scholar = page.locator('.item', { hasText: 'Title: Scholar' });
  await scholar.getByRole('button', { name: /100/ }).click();
  await expect(scholar.getByRole('button', { name: 'Equipped' })).toBeVisible();

  const gifts = page.getByRole('region', { name: 'Gifts' });
  await gifts.getByRole('button', { name: 'Make gift code' }).click();
  await gifts.getByRole('button', { name: 'Yes, make the gift code' }).click();
  const code = await gifts.getByRole('textbox', { name: /Gift code for Title: Scholar/ }).inputValue();
  expect(code).toMatch(/^HWG1\./);
  // the item left the sender's inventory
  await expect(scholar.getByRole('button', { name: /100/ })).toBeVisible();
  await page.getByRole('tab', { name: /Wallet/ }).click();
  await expect(page.getByText('Gift sent: Title: Scholar')).toBeVisible();

  const ctx = await browser.newContext({ baseURL });
  const other = await ctx.newPage();
  const errorsB = await openApp(other);
  await other.goto('./?view=play');
  await other.getByRole('tab', { name: /Shop/ }).click();
  const giftsB = other.getByRole('region', { name: 'Gifts' });
  await giftsB.getByRole('textbox', { name: 'Gift code', exact: true }).fill(code);
  await giftsB.getByRole('button', { name: 'Redeem' }).click();
  await expect(giftsB.locator('[data-gift-message]')).toContainText('sent you Title: Scholar');
  await expect(other.locator('.item', { hasText: 'Title: Scholar' }).getByRole('button', { name: 'Equip' })).toBeVisible();
  // redeeming the same code again does nothing
  await giftsB.getByRole('textbox', { name: 'Gift code', exact: true }).fill(code);
  await giftsB.getByRole('button', { name: 'Redeem' }).click();
  await expect(giftsB.locator('[data-gift-message]')).toContainText('already redeemed');
  await other.goto('./?view=play');
  await other.getByRole('tab', { name: /Wallet/ }).click();
  await expect(other.getByText('Gift received: Title: Scholar')).toHaveCount(1);
  expect(errorsB).toEqual([]);
  expect(errors).toEqual([]);
  await ctx.close();
});

test('feeding the pet spends coins', async ({ page }) => {
  const errors = await openApp(page);
  await seedCoins(page, 50);
  await page.goto('./?view=play');
  await page.getByRole('tab', { name: /Pet/ }).click();
  await expect(page.locator('[data-pet-fill]')).toHaveText('70');
  await page.getByRole('button', { name: 'Feed Apple for 5 coins' }).click();
  await expect(page.locator('.wallet .w', { hasText: 'coins' })).toContainText('45');
  await expect(page.locator('[data-pet-fill]')).toHaveText('90');
  // full now: no more food until it gets hungry
  await expect(page.getByRole('button', { name: 'Feed Fish for 8 coins' })).toBeDisabled();
  await page.getByRole('button', { name: /Pat/ }).click();
  await page.getByRole('tab', { name: /Wallet/ }).click();
  await expect(page.getByText('Pet snack: apple')).toBeVisible();
  expect(errors).toEqual([]);
});

test('the garden grows and the dungeon opens rooms as tasks get done', async ({ page }) => {
  const errors = await openApp(page);
  await addTask(page, 'Garden task one');
  await addTask(page, 'Garden task two');
  await addTask(page, 'Garden task three');
  await page.goto('./?view=play');
  await page.getByRole('tab', { name: /Garden/ }).click();
  await expect(page.locator('[data-garden-summary]')).toContainText('0 tasks finished');
  await expect(page.locator('[data-seeds]')).toHaveText('0');
  await page.getByRole('button', { name: 'Pot 1: empty' }).click();
  await expect(page.locator('[data-garden-reaction]')).toContainText('No seed packets');
  await page.getByRole('tab', { name: /Dungeon/ }).click();
  await expect(page.locator('[data-room]')).toHaveCount(3);
  await expect(page.locator('[data-room][data-open="true"]')).toHaveCount(0);

  await page.goto('./');
  for (const title of ['Garden task one', 'Garden task two']) await page.locator('.task', { hasText: title }).getByRole('checkbox').click();
  await expect(page.locator('.task', { hasText: 'Garden task two' }).getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
  await page.goto('./?view=play');
  await page.getByRole('tab', { name: /Garden/ }).click();
  await expect(page.locator('[data-garden-summary]')).toContainText('2 tasks finished');
  // two finished tasks: two seed packets and two bags of fertilizer
  await expect(page.locator('[data-seeds]')).toHaveText('2');
  await expect(page.locator('[data-fertilizer]')).toHaveText('2');
  await page.getByRole('button', { name: 'Pot 1: empty' }).click();
  await expect(page.locator('.plant[data-stage="0"]')).toHaveCount(1);
  await expect(page.locator('[data-seeds]')).toHaveText('1');
  // a sprout wants water, then fertilizer; each happy moment drops a coin to tap
  const pot = page.getByRole('button', { name: /^Pot 1: / });
  await expect(pot).toHaveAttribute('aria-label', /wants water/);
  await pot.click();
  await expect(pot).toHaveAttribute('aria-label', /wants fertilizer/);
  await pot.click();
  await expect(page.locator('.plant[data-stage="1"]')).toHaveCount(1);
  await expect(page.locator('[data-fertilizer]')).toHaveText('1');
  await expect(pot).toHaveAttribute('aria-label', /resting/);
  const coin = page.getByRole('button', { name: /Collect \d+ coins?/ });
  await expect(coin).toHaveCount(2);
  await coin.first().click();
  await expect(coin).toHaveCount(1);
  await page.goto('./?view=play');
  await page.getByRole('tab', { name: /Garden/ }).click();
  // the garden is remembered on this device, and the coins landed in the wallet
  await expect(page.locator('.plant[data-stage="1"]')).toHaveCount(1);
  await expect(page.locator('.wallet .w', { hasText: 'coins' })).not.toContainText(/^🪙0/);
  // the Tree of Wisdom grows a foot per feeding and shares a thought
  await page.getByRole('button', { name: 'Tree of Wisdom' }).click();
  await page.getByRole('button', { name: /Feed the tree/ }).click();
  await expect(page.locator('[data-tree-height]')).toHaveText('1 ft');
  await expect(page.locator('[data-wisdom]')).not.toBeEmpty();
  await page.getByRole('tab', { name: /Wallet/ }).click();
  await expect(page.getByText('Garden coins').first()).toBeVisible();
  await page.getByRole('tab', { name: /Dungeon/ }).click();
  await expect(page.locator('[data-dungeon-summary]')).toContainText('2 of 3 rooms opened');
  await expect(page.locator('[data-room][data-open="true"]')).toHaveCount(2);
  await page.getByRole('button', { name: /Room 3: Garden task three, locked/ }).click();
  await expect(page.getByText(/Locked · finish the task to open it/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('the focus companion naps while the timer runs and wakes on breaks', async ({ page }) => {
  const errors = await openApp(page);
  await page.goto('./?view=focus');
  const pal = page.locator('[data-companion-state]');
  await expect(pal).toHaveAttribute('data-companion-state', 'waiting');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(pal).toHaveAttribute('data-companion-state', 'sleeping');
  await expect(page.getByRole('img', { name: 'Cat is napping while you focus' })).toBeVisible();
  await page.getByRole('tab', { name: /^Break/ }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(pal).toHaveAttribute('data-companion-state', 'playing');
  await page.getByRole('button', { name: 'Change' }).click();
  await page.getByRole('button', { name: /Owl/ }).click();
  await expect(page.getByRole('img', { name: 'Owl is awake: break time!' })).toBeVisible();
  expect(errors).toEqual([]);
});
