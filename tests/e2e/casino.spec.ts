import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openApp, seedCoins } from './helpers';

async function openCasino(page: Page) {
  await seedCoins(page, 5000, 'chips');
  await page.goto('./?view=play');
  await page.getByRole('tab', { name: /Casino/ }).click();
  await expect(page.locator('.tile').first()).toBeVisible();
}

test('the lobby shows every game in its category with drawn art', async ({ page }) => {
  const errors = await openApp(page);
  await openCasino(page);
  for (const name of ['Tables', 'Cards', 'Slots & wheels', 'Quick games']) await expect(page.getByRole('heading', { name })).toBeVisible();
  await expect(page.locator('.tile')).toHaveCount(16);
  // no art files are listed in public/art/manifest.json, so every tile uses its drawn fallback
  await expect(page.locator('.tile svg.lobbyart')).toHaveCount(16);
  await expect(page.locator('.tile img')).toHaveCount(0);
  await expect(page.locator('[data-chip-balance]')).toHaveAttribute('aria-label', /5,000 chips/);
  expect(errors).toEqual([]);
});

test('a slots spin lands and shows the result', async ({ page }) => {
  const errors = await openApp(page);
  await openCasino(page);
  await page.locator('.tile', { hasText: 'Slots' }).click();
  await page.getByRole('button', { name: 'Spin', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Spinning…' })).toBeDisabled();
  const result = page.locator('.cz-result');
  await expect(result).toHaveText(/No win|chips/, { timeout: 8000 });
  await expect(page.getByRole('button', { name: 'Spin', exact: true })).toBeEnabled();
  await expect(page.locator('[data-chip-balance]')).not.toHaveAttribute('aria-label', /5,000 chips/);
  expect(errors).toEqual([]);
});

test('roulette: chips on red, the ball lands and the number lights up', async ({ page }) => {
  const errors = await openApp(page);
  await openCasino(page);
  await page.locator('.tile', { hasText: 'Roulette' }).click();
  await page.getByRole('button', { name: 'Red', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Red, 10 on it' })).toBeVisible();
  await page.getByRole('button', { name: 'Spin' }).click();
  await expect(page.locator('.cz-result')).toHaveText(/^\d+ (red|black|green) · /, { timeout: 10_000 });
  await expect(page.locator('.hist .h')).toHaveCount(1);
  await expect(page.locator('.spotbtn.win').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('blackjack deals cards from the shoe', async ({ page }) => {
  const errors = await openApp(page);
  await openCasino(page);
  await page.locator('.tile', { hasText: 'Blackjack' }).click();
  await page.getByRole('button', { name: 'Deal' }).click();
  const hands = page.locator('.cz-hand');
  await expect(hands.nth(1).getByRole('img')).toHaveCount(2);
  await expect(hands.nth(1).getByRole('img').first()).toHaveAttribute('aria-label', /^(\d+|[JQKA]) of [♠♥♦♣]$/);
  // either it's your turn or the hand ended on a natural
  await expect(page.getByRole('button', { name: 'Hit' }).or(page.getByRole('button', { name: 'Deal' }))).toBeEnabled({ timeout: 5000 });
  if (await page.getByRole('button', { name: 'Stand' }).isVisible()) {
    await page.getByRole('button', { name: 'Stand' }).click();
  }
  await expect(page.locator('.cz-result')).toHaveText(/win|Push|Bust|Dealer wins|Blackjack|busts/, { timeout: 8000 });
  expect(errors).toEqual([]);
});

test('with reduced motion the games still play, quickly and without errors', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = await openApp(page);
  await openCasino(page);
  await page.locator('.tile', { hasText: 'Slots' }).click();
  await page.getByRole('button', { name: 'Spin', exact: true }).click();
  await expect(page.locator('.cz-result')).toHaveText(/No win|chips/, { timeout: 1500 });
  await page.getByRole('button', { name: '← All games' }).click();

  await page.locator('.tile', { hasText: 'Roulette' }).click();
  await page.getByRole('button', { name: 'Black', exact: true }).click();
  await page.getByRole('button', { name: 'Spin' }).click();
  await expect(page.locator('.cz-result')).toHaveText(/^\d+ (red|black|green) · /, { timeout: 1500 });
  await page.getByRole('button', { name: '← All games' }).click();

  await page.locator('.tile', { hasText: 'Plinko' }).click();
  await page.getByRole('button', { name: 'Drop ball' }).click();
  await expect(page.locator('.cz-result')).toHaveText(/×[\d.]+ · /, { timeout: 1500 });
  await page.getByRole('button', { name: '← All games' }).click();

  await page.locator('.tile', { hasText: 'Mines' }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await page.getByRole('button', { name: 'Tile 13' }).click();
  await expect(page.locator('.cz-result')).toHaveText(/Mine|Pick a tile/);
  // nothing decorative is left flying around
  await expect(page.locator('.cz-flychip')).toHaveCount(0);
  expect(errors).toEqual([]);
});

async function axeCasino(page: Page) {
  await openApp(page);
  await openCasino(page);
  const check = async (where: string) => {
    await page.waitForTimeout(600);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${where}: ${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
  };
  await check('lobby');
  for (const name of [
    'Slots',
    'Roulette',
    'Blackjack',
    'Baccarat',
    'Video poker',
    'Three Card Poker',
    'Hi-Lo',
    'Mines',
    'Keno',
    'Big Six',
    'Craps',
    'Plinko',
    'Dice',
    'Scratch cards',
    'Let It Ride',
    "Texas Hold'em",
  ]) {
    await page.locator('.tile', { hasText: name }).click();
    await expect(page.locator('.cz-game')).toBeVisible();
    await check(name);
    await page.getByRole('button', { name: '← All games' }).click();
  }
}

// 17 full-page axe scans (the lobby and every table) take close to a minute on their own
test.describe('accessibility', () => {
  test.describe.configure({ timeout: 180_000 });
  test('the casino lobby and tables have no serious accessibility violations', async ({ page }) => axeCasino(page));
});
test.describe('dark mode', () => {
  test.describe.configure({ timeout: 180_000 });
  test.use({ colorScheme: 'dark' });
  test('the casino (dark) has no serious accessibility violations', async ({ page }) => axeCasino(page));
});
