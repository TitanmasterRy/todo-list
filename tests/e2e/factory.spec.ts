import { expect, test, type Page } from '@playwright/test';
import { openApp, seedCoins } from './helpers';

const tile = (page: Page, x: number, y: number) => page.locator(`.factory .tile[data-x="${x}"][data-y="${y}"]`);

async function stockOf(page: Page, item: string): Promise<number> {
  await page.getByRole('tab', { name: 'Production' }).click();
  const cell = page.locator(`[data-stock="${item}"]`);
  await expect(cell).toBeVisible();
  return Number((await cell.innerText()).replace(/[^\d.]/g, ''));
}

test('factory: build a mine and a smelter, belt them up, make ingots, buy a supply drop, and keep it all after a reload', async ({ page }) => {
  await page.clock.install();
  const errors = await openApp(page);
  await seedCoins(page, 100);
  await page.goto('./?view=play');
  await page.getByRole('tab', { name: /Factory/ }).click();
  const game = page.locator('.factory');
  await expect(game.getByRole('heading', { name: 'Orebelt' })).toBeVisible();

  // place a miner on the iron node and a smelter next to it
  const tools = page.getByRole('toolbar', { name: 'Map tools' });
  await tools.getByRole('button', { name: 'Build' }).click();
  await page.locator('[data-build="miner1"]').click();
  await tile(page, 4, 3).click();
  await expect(tile(page, 4, 3)).toHaveAttribute('data-building', 'miner1');
  await page.locator('[data-build="smelter"]').click();
  await tile(page, 5, 3).click();
  await expect(tile(page, 5, 3)).toHaveAttribute('data-building', 'smelter');

  // pick the smelter's recipe
  await tools.getByRole('button', { name: 'Inspect' }).click();
  await tile(page, 5, 3).click();
  await page.locator('[data-recipe]').selectOption('ironIngot');

  // belts: miner → smelter → base camp
  await tools.getByRole('button', { name: 'Belt' }).click();
  await tile(page, 4, 3).click();
  await tile(page, 5, 3).click();
  await expect(page.locator('[data-msg]')).toHaveText('Belt connected');
  await tile(page, 5, 3).click();
  await tile(page, 2, 5).click();
  await expect(page.locator('.belt')).toHaveCount(2);

  // a minute of factory time
  await page.clock.runFor(60_000);
  await tools.getByRole('button', { name: 'Inspect' }).click();
  await tile(page, 5, 3).click();
  await expect(page.locator('[data-panel] [data-status]')).toHaveText('Running');
  const ingots = await stockOf(page, 'ironIngot');
  expect(ingots).toBeGreaterThan(15);

  // spend homework coins on a supply crate (asks first)
  await page.getByRole('tab', { name: 'Supply & market' }).click();
  await expect(page.locator('[data-wallet]')).toContainText('100');
  const crate = page.locator('[data-offer="crate"]');
  await crate.getByRole('button', { name: 'Buy for 15' }).click();
  await crate.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.locator('[data-wallet]')).toContainText('85');
  await expect(page.locator('.wallet .w', { hasText: 'coins' })).toContainText('85');
  await expect(crate).toContainText('Today: 1/3');
  expect(await stockOf(page, 'wire')).toBe(40);

  // reload: the factory and its stock come back
  await page.reload();
  await page.goto('./?view=play');
  await expect(page.locator('.factory')).toBeVisible(); // the Play tab remembers the factory
  await page.getByRole('tab', { name: 'Factory', exact: true }).click();
  await expect(tile(page, 4, 3)).toHaveAttribute('data-building', 'miner1');
  await expect(tile(page, 5, 3)).toHaveAttribute('data-building', 'smelter');
  await expect(page.locator('.belt')).toHaveCount(2);
  expect(await stockOf(page, 'ironIngot')).toBeGreaterThanOrEqual(ingots);
  expect(await stockOf(page, 'wire')).toBe(40);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('homework-todo:factory') || '{}'));
  expect(saved.v).toBeGreaterThan(0);
  expect(saved.buildings.map((b: { type: string }) => b.type).sort()).toEqual(['camp', 'miner1', 'smelter']);
  expect(errors).toEqual([]);
});

test('factory works on a phone-sized screen @phone', async ({ page }) => {
  const errors = await openApp(page);
  await page.goto('./?view=play');
  await page.getByRole('tab', { name: /Factory/ }).click();
  await expect(page.locator('.factory .map')).toBeVisible();
  // the page itself doesn't scroll sideways: only the map does
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.getByRole('toolbar', { name: 'Map tools' }).getByRole('button', { name: 'Build' }).click();
  await page.locator('[data-build="miner1"]').click();
  await tile(page, 4, 3).click();
  await expect(tile(page, 4, 3)).toHaveAttribute('data-building', 'miner1');
  expect(errors).toEqual([]);
});
