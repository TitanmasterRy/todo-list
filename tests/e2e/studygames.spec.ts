import { expect, test, type Page } from '@playwright/test';
import { openApp, seedCoins, seedDeck } from './helpers';

const SPANISH: [string, string][] = [
  ['cat', 'gato'],
  ['dog', 'perro'],
  ['cow', 'vaca'],
  ['hen', 'gallina'],
  ['pig', 'cerdo'],
  ['owl', 'búho'],
];
const answerOf = (front: string) => SPANISH.find(([f]) => f === front)![1];

async function openStudyGame(page: Page, game: RegExp, deck: string) {
  await page.goto('./?view=play');
  await page.getByRole('tab', { name: /Study games/ }).click();
  await page.getByRole('button', { name: game }).click();
  await page.getByRole('button', { name: new RegExp(deck) }).click();
}

test('boss battle: a right answer hits the boss, a wrong one costs a heart', async ({ page }) => {
  const errors = await openApp(page);
  await seedDeck(page, 'Spanish animals', SPANISH);
  await seedDeck(page, 'Tiny', [
    ['one', 'uno'],
    ['two', 'dos'],
  ]);
  await page.goto('./?view=play');
  await page.getByRole('tab', { name: /Study games/ }).click();
  await page.getByRole('button', { name: /Boss battle/ }).click();
  // too few cards: a friendly note instead of a broken game
  await expect(page.getByRole('button', { name: /Tiny/ })).toBeDisabled();
  await expect(page.getByText(/Needs at least 4 cards/)).toBeVisible();
  await page.getByRole('button', { name: /Spanish animals/ }).click();

  const boss = page.getByRole('progressbar', { name: 'Boss HP' });
  const max = Number(await boss.getAttribute('aria-valuemax'));
  await expect(boss).toHaveAttribute('aria-valuenow', String(max));
  await expect(page.locator('.choice')).toHaveCount(4);
  const q = (await page.locator('[data-question]').textContent())!.trim();
  await page.locator('.choice', { hasText: answerOf(q) }).click();
  await expect(boss).toHaveAttribute('aria-valuenow', String(max - 10));
  await expect(page.locator('.feedback')).toContainText('Hit!');

  // next card: answer wrong with the keyboard
  await expect(page.locator('[data-question]')).not.toHaveText(q);
  const q2 = (await page.locator('[data-question]').textContent())!.trim();
  const texts = await page.locator('.choice .ct').allTextContents();
  const wrongIdx = texts.findIndex((t) => t.trim() !== answerOf(q2));
  await page.keyboard.press(String(wrongIdx + 1));
  await expect(page.getByRole('img', { name: 'Your health: 4 of 5' })).toBeVisible();
  await expect(page.locator('.feedback')).toContainText(answerOf(q2));
  // number keys answered the question instead of switching views
  await expect(page.getByRole('tab', { name: /Study games/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('match rush: click and drag terms onto definitions, best time is kept', async ({ page }) => {
  const errors = await openApp(page);
  await seedDeck(page, 'Spanish animals', SPANISH.slice(0, 4));
  await openStudyGame(page, /Match rush/, 'Spanish animals');
  await expect(page.locator('.tile.term')).toHaveCount(4);
  await expect(page.locator('.tile.def')).toHaveCount(4);

  // a wrong pair doesn't match
  await page.getByRole('button', { name: 'cat', exact: true }).click();
  await page.getByRole('button', { name: 'perro', exact: true }).click();
  await expect(page.locator('.status')).toContainText('Not a match');
  await expect(page.getByRole('button', { name: 'cat', exact: true })).toBeEnabled();

  // click a term, then its definition
  await page.getByRole('button', { name: 'cat', exact: true }).click();
  await page.getByRole('button', { name: 'gato', exact: true }).click();
  await expect(page.locator('.tile.term.done')).toHaveCount(1);
  await expect(page.locator('.status')).toContainText('Matched');

  // drag a term onto its definition
  const dog = await page.getByRole('button', { name: 'dog', exact: true }).boundingBox();
  const perro = await page.getByRole('button', { name: 'perro', exact: true }).boundingBox();
  await page.mouse.move(dog!.x + 10, dog!.y + dog!.height / 2);
  await page.mouse.down();
  await page.mouse.move(dog!.x + 60, dog!.y + dog!.height / 2, { steps: 4 });
  await page.mouse.move(perro!.x + perro!.width / 2, perro!.y + perro!.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('.tile.term.done')).toHaveCount(2);

  // definition first, then the term
  await page.getByRole('button', { name: 'vaca', exact: true }).click();
  await page.getByRole('button', { name: 'cow', exact: true }).click();
  await page.getByRole('button', { name: 'hen', exact: true }).click();
  await page.getByRole('button', { name: 'gallina', exact: true }).click();
  await expect(page.getByText(/All 4 matched in/)).toBeVisible();
  await expect(page.getByText(/New best for this deck/)).toBeVisible();

  await page.getByRole('button', { name: 'Pick another deck' }).click();
  await expect(page.getByRole('button', { name: /Spanish animals/ })).toContainText('best');
  expect(errors).toEqual([]);
});

test('the new arcade games open in the player', async ({ page }) => {
  const errors = await openApp(page);
  await seedCoins(page, 10, 'vouchers');
  await page.goto('./?view=play');
  await page.getByRole('tab', { name: /Arcade/ }).click();
  for (const [title, file, ready] of [
    ['Solitaire', 'solitaire.html', '[data-slot="stock::"]'],
    ['Invaders', 'invaders.html', '#go'],
    ['Lunar lander', 'lander.html', '#go'],
    ['Paper-plane glider', 'glider.html', '#go'],
  ]) {
    await page.locator('.game', { hasText: title }).getByRole('button', { name: 'Play' }).click();
    const frame = page.frameLocator('.player iframe');
    await expect(frame.locator(ready)).toBeVisible();
    expect(page.frames().some((f) => f.url().includes(file))).toBe(true);
    await page.getByRole('button', { name: 'Close' }).click();
  }
  await expect(page.locator('.wallet .w', { hasText: 'vouchers' })).toContainText('6');
  expect(errors.filter((e) => !/sandboxed/.test(e))).toEqual([]);
});

test('solitaire draws, undoes and moves to a foundation; the glider reports its score', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./games/solitaire.html?dark=1');
  await page.locator('[data-slot="stock::"]').click();
  await expect(page.locator('#moves')).toHaveText('1');
  await expect(page.locator('[data-src^="waste:"]')).toHaveCount(1);
  await page.locator('#undo').click();
  await expect(page.locator('#moves')).toHaveText('0');
  await expect(page.locator('[data-src^="waste:"]')).toHaveCount(0);
  // a stacked deal: the waste ace goes up on a double-click, worth 10 points
  await page.evaluate('g.waste = [{ s: 1, r: 1, up: true }]; render();'); // the game's own top-level state
  await page.locator('[data-src="waste::0"]').dblclick();
  await expect(page.getByRole('button', { name: /Foundation \d, Ace of hearts/ })).toBeAttached();
  await expect(page.locator('#score')).toHaveText('10');

  await page.addInitScript(() => {
    (window as unknown as { scores: unknown[] }).scores = [];
    addEventListener('message', (e) => (window as unknown as { scores: unknown[] }).scores.push(e.data));
  });
  await page.goto('./games/glider.html?dark=0');
  await page.locator('#go').click();
  // no lift: the plane glides into the desk and the game reports to the app
  await expect.poll(() => page.evaluate(() => (window as unknown as { scores: unknown[] }).scores), { timeout: 8000 }).toEqual([{ type: 'hwtodo:score', score: 0 }]);
  await expect(page.locator('#go')).toHaveText('Again');
  expect(errors).toEqual([]);
});
