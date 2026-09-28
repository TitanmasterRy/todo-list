import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { addTask, openApp, seedCoins } from './helpers';

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

test('finishing homework powers the factory: a shard, insight and a boost', async ({ page }) => {
  const errors = await openApp(page);
  await addTask(page, 'Factory homework');
  await page.locator('.task', { hasText: 'Factory homework' }).getByRole('checkbox').click();
  await page.waitForTimeout(300);
  await page.goto('./?view=play');
  await page.getByRole('tab', { name: /Factory/ }).click();
  await expect(page.locator('[data-shards]')).toContainText('1 shard');
  await expect(page.locator('.factory .hud')).toContainText('1 insight');
  await expect(page.locator('.factory .hud')).toContainText('Boost');
  expect(errors).toEqual([]);
});

test('every factory section has no serious accessibility violations', async ({ page }) => {
  await openApp(page);
  await seedCoins(page, 50);
  await page.goto('./?view=play');
  await page.getByRole('tab', { name: /Factory/ }).click();
  await page.getByRole('toolbar', { name: 'Map tools' }).getByRole('button', { name: 'Build' }).click();
  await page.locator('.factory .tile[data-x="2"][data-y="5"]').click();
  for (const section of ['Factory', 'Production', 'Milestones', 'Records', 'Supply & market']) {
    await page.getByRole('tab', { name: section, exact: true }).click();
    await page.waitForTimeout(300);
    const results = await new AxeBuilder({ page }).include('.factory').withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${section} ${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
  }
});

/** A tier-1 save with a full stock, so the expansion features are reachable without an hour of play. */
async function seedFactory(page: Page): Promise<void> {
  await page.evaluate(() => {
    const save = {
      v: 3,
      lastSeen: Date.now(),
      simTime: 0,
      nextId: 2,
      buildings: [{ id: 1, type: 'camp', x: 2, y: 5, rot: 0, clock: 1, shards: 0, inBuf: {}, outBuf: {} }],
      belts: [],
      inv: { ironPlate: 500, ironRod: 200, wire: 200, screw: 200, concrete: 200, ironOre: 300, copperIngot: 100 },
      milestones: ['fasteners', 'copper', 'logistics'],
      research: [],
      phase: 1,
      delivered: {},
      shards: 2,
      insight: 5,
      boostLeft: 0,
      rushLeft: 0,
      extraOffline: 0,
      made: {},
      credit: 0,
      rewards: { tasks: 0, study: 0 },
      sectors: ['home'],
      contracts: { day: '', done: [], progress: {} },
      ach: [],
      stars: 0,
      runs: 0,
      perks: [],
      event: null,
      madeTotal: 0,
      lifetime: { launches: 0, contracts: 0, relaunches: 0 },
    };
    localStorage.setItem('homework-todo:factory', JSON.stringify(save));
  });
}

test('Orebelt 2: survey a sector, feed a smelter from stock with a loader, see contracts, records and perks', async ({ page }) => {
  await page.clock.install();
  const errors = await openApp(page);
  await seedFactory(page);
  await page.goto('./?view=play');
  await page.getByRole('tab', { name: /Factory/ }).click();
  const tools = page.getByRole('toolbar', { name: 'Map tools' });

  // East Ridge costs 100 plates, 50 concrete and an insight; once surveyed its button is gone
  await expect(page.locator('[data-sector="east"]')).toBeVisible();
  await page
    .locator('[data-sector="east"]')
    .getByRole('button', { name: /Survey/ })
    .click();
  await expect(page.locator('[data-sector="east"]')).toHaveCount(0);
  expect(await stockOf(page, 'ironPlate')).toBe(400);
  await page.getByRole('tab', { name: 'Factory', exact: true }).click();

  // a loader pulls ore out of stock and feeds a smelter through a belt
  await tools.getByRole('button', { name: 'Build' }).click();
  await page.locator('[data-build="loader"]').click();
  await tile(page, 5, 3).click();
  await expect(tile(page, 5, 3)).toHaveAttribute('data-building', 'loader');
  await page.locator('[data-build="smelter"]').click();
  await tile(page, 6, 3).click();
  await tools.getByRole('button', { name: 'Inspect' }).click();
  await tile(page, 5, 3).click();
  await page.locator('[data-loader-item]').selectOption('ironOre');
  await tile(page, 6, 3).click();
  await page.locator('[data-recipe]').selectOption('ironIngot');
  await tools.getByRole('button', { name: 'Belt' }).click();
  await tile(page, 5, 3).click();
  await tile(page, 6, 3).click();
  await expect(page.locator('[data-msg]')).toHaveText('Belt connected');
  await page.clock.runFor(30_000);
  await tools.getByRole('button', { name: 'Inspect' }).click();
  await tile(page, 5, 3).click();
  await expect(page.locator('[data-panel] [data-status]')).toHaveText('Running');
  expect(await stockOf(page, 'ironOre')).toBeLessThan(300);

  // three contracts a day, a records tab with achievements, and the Star Charts perks
  await page.getByRole('tab', { name: 'Milestones' }).click();
  await expect(page.locator('[data-contract]')).toHaveCount(3);
  await expect(page.locator('[data-perk]').first()).toBeVisible();
  await page.getByRole('tab', { name: 'Records' }).click();
  await expect(page.locator('[data-achievement="belt1"]')).toHaveAttribute('data-earned', 'true');
  await expect(page.locator('[data-achievement="launched"]')).toHaveAttribute('data-earned', 'false');
  expect(errors).toEqual([]);
});
