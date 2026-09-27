import { expect, test, type Page } from '@playwright/test';

// Glow Grid (public/games/glowgrid.html): the arcade's block-placement puzzle, opened directly.
// The page exposes window.glowGrid.layout()/state() so the test can find the pieces on its canvas.

interface Layout {
  bx: number;
  by: number;
  cell: number;
  slots: { cx: number; cy: number; piece: { id: string; w: number; h: number } | null }[];
}
interface State {
  score: number;
  gameOver: boolean;
  board: number[];
  hand: (string | null)[];
  bomb: boolean;
  wallet: number | null;
  pending: string | null;
}
type Msg = { type?: string; id?: string; label?: string; cost?: number; score?: number };

const layout = (page: Page) => page.evaluate(() => (window as unknown as { glowGrid: { layout(): Layout } }).glowGrid.layout());
const state = (page: Page) => page.evaluate(() => (window as unknown as { glowGrid: { state(): State } }).glowGrid.state());
/** Messages the game posted to its parent (opened on its own, the parent is the page itself). */
const sent = (page: Page) => page.evaluate(() => (window as unknown as { __msgs: Msg[] }).__msgs);
/** Play the part of the app. */
const fromApp = (page: Page, msg: object) => page.evaluate((m) => window.postMessage(m, '*'), msg);

async function open(page: Page, seed = 5) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(() => {
    const w = window as unknown as { __msgs: unknown[] };
    w.__msgs = [];
    addEventListener('message', (e) => w.__msgs.push(e.data));
  });
  await page.goto(`./games/glowgrid.html?seed=${seed}`);
  await expect.poll(async () => (await state(page)).hand.filter(Boolean).length).toBe(3);
  return errors;
}

/** Drag hand piece `i` so its top-left lands on row, col. Touch drags hold the piece above the finger. */
async function dragPiece(page: Page, i: number, row: number, col: number) {
  const L = await layout(page);
  const p = L.slots[i].piece!;
  await page.mouse.move(L.slots[i].cx, L.slots[i].cy);
  await page.mouse.down();
  const x = L.bx + (col + p.w / 2) * L.cell;
  const y = L.by + (row + p.h / 2) * L.cell;
  await page.mouse.move((x + L.slots[i].cx) / 2, (y + L.slots[i].cy) / 2, { steps: 4 });
  await page.mouse.move(x, y, { steps: 4 });
  await page.mouse.up();
}

/** Keyboard play (select a piece, Enter drops it where it fits) until the board is stuck. */
async function playUntilStuck(page: Page) {
  await page.evaluate(async () => {
    const g = (window as unknown as { glowGrid: { state(): State } }).glowGrid;
    const key = (k: string) => dispatchEvent(new KeyboardEvent('keydown', { key: k }));
    for (let n = 0; n < 3000 && !g.state().gameOver; n++) {
      key(String((n % 3) + 1));
      key('Enter');
      if (n % 20 === 0) await new Promise((r) => setTimeout(r, 0));
    }
  });
  expect((await state(page)).gameOver).toBe(true);
}

test('Glow Grid: drag a piece onto the board with the mouse and score', async ({ page }) => {
  const errors = await open(page);
  expect((await state(page)).score).toBe(0);
  await dragPiece(page, 0, 0, 0);
  const s = await state(page);
  expect(s.score).toBeGreaterThan(0);
  expect(s.board.filter(Boolean).length).toBeGreaterThan(0);
  expect(s.hand[0]).toBeNull();
  await expect(page.locator('#score')).toHaveText(String(s.score));
  // a drop off the board puts the piece back
  const L = await layout(page);
  await page.mouse.move(L.slots[1].cx, L.slots[1].cy);
  await page.mouse.down();
  await page.mouse.move(5, 70, { steps: 3 });
  await page.mouse.up();
  expect((await state(page)).hand[1]).not.toBeNull();
  expect((await state(page)).score).toBe(s.score);
  await page.waitForTimeout(700); // let the effects play out
  expect(errors).toEqual([]);
});

test('Glow Grid: touch drags hold the piece above the finger', async ({ page }) => {
  const errors = await open(page);
  const L = await layout(page);
  const p = L.slots[2].piece!;
  // the finger ends a cell and a half-piece below where the piece lands
  const x = L.bx + (p.w / 2) * L.cell;
  const y = L.by + (p.h / 2) * L.cell + (p.h * L.cell) / 2 + L.cell * 1.05;
  await page.evaluate(
    ([sx, sy, x, y]) => {
      const c = document.querySelector('canvas')!;
      const fire = (type: string, cx: number, cy: number) =>
        c.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: cx, clientY: cy, bubbles: true, isPrimary: true }));
      fire('pointerdown', sx, sy);
      fire('pointermove', (sx + x) / 2, (sy + y) / 2);
      fire('pointermove', x, y);
      fire('pointerup', x, y);
    },
    [L.slots[2].cx, L.slots[2].cy, x, y],
  );
  const s = await state(page);
  expect(s.hand[2]).toBeNull();
  expect(s.board[0] || s.board[1] || s.board[8]).toBeTruthy();
  expect(errors).toEqual([]);
});

test('Glow Grid: keyboard play reaches game over, reports the score and restarts', async ({ page }) => {
  const errors = await open(page);
  await playUntilStuck(page);
  const { score } = await state(page);
  expect(score).toBeGreaterThan(0);
  await expect.poll(() => sent(page)).toContainEqual({ type: 'hwtodo:score', score });
  await expect(page.locator('#over')).toBeVisible();
  await expect(page.locator('#final')).toHaveText(String(score));
  await expect(page.locator('#best')).toHaveText(String(score));
  // no wallet from an app: no power-ups, no Continue
  await expect(page.locator('#powers')).toBeHidden();
  await expect(page.locator('#p-continue')).toBeHidden();
  await page.locator('#again').click();
  await expect(page.locator('#over')).toBeHidden();
  expect((await state(page)).score).toBe(0);
  expect(errors).toEqual([]);
});

test('Glow Grid: power-ups are bought through the app and only applied once it confirms', async ({ page }) => {
  const errors = await open(page);
  await expect.poll(() => sent(page)).toContainEqual({ type: 'hwtodo:hello' });
  await expect(page.locator('#powers')).toBeHidden();
  await fromApp(page, { type: 'hwtodo:wallet', coins: 40 });
  await expect(page.locator('#powers')).toBeVisible();
  await expect(page.locator('#coins')).toHaveText('40');
  await expect(page.locator('#p-undo')).toBeDisabled(); // nothing to undo yet

  // reroll: asked for, denied, asked again, confirmed
  const hand0 = (await state(page)).hand;
  await page.locator('#p-reroll').click();
  await expect.poll(async () => (await sent(page)).filter((m) => m.type === 'hwtodo:buy')).toEqual([{ type: 'hwtodo:buy', id: 'reroll-1', label: 'Reroll pieces', cost: 5 }]);
  expect((await state(page)).pending).toBe('reroll-1');
  await expect(page.locator('#p-bomb')).toBeDisabled(); // one request at a time
  await fromApp(page, { type: 'hwtodo:bought', id: 'reroll-999' }); // not ours: ignored
  await fromApp(page, { type: 'hwtodo:denied', id: 'reroll-1', reason: 'Not enough coins' });
  await expect(page.locator('#toast')).toHaveText('Not enough coins');
  expect((await state(page)).hand).toEqual(hand0);
  expect((await state(page)).pending).toBeNull();
  await page.locator('#p-reroll').click();
  expect((await state(page)).pending).toBe('reroll-2');
  expect((await state(page)).hand).toEqual(hand0);
  await fromApp(page, { type: 'hwtodo:bought', id: 'reroll-2' });
  await expect.poll(async () => (await state(page)).hand).not.toEqual(hand0);
  expect((await state(page)).pending).toBeNull();
  await fromApp(page, { type: 'hwtodo:bought', id: 'reroll-2' }); // a repeat does nothing
  const hand1 = (await state(page)).hand;
  expect(hand1.filter(Boolean)).toHaveLength(3);

  // undo puts the board, hand and score back
  await dragPiece(page, 0, 0, 0);
  expect((await state(page)).score).toBeGreaterThan(0);
  await expect(page.locator('#p-undo')).toBeEnabled();
  await page.locator('#p-undo').click();
  await fromApp(page, { type: 'hwtodo:bought', id: 'undo-3' });
  await expect.poll(async () => (await state(page)).score).toBe(0);
  expect((await state(page)).board.every((v) => v === 0)).toBe(true);
  expect((await state(page)).hand).toEqual(hand1);

  // bomb: a one-off piece that clears the 3x3 it lands on
  await dragPiece(page, 0, 3, 3);
  const filled = (await state(page)).board.filter(Boolean).length;
  await page.locator('#p-bomb').click();
  await fromApp(page, { type: 'hwtodo:bought', id: 'bomb-4' });
  await expect.poll(async () => (await state(page)).bomb).toBe(true);
  const L = await layout(page);
  await page.mouse.move(L.slots[1].cx, L.slots[1].cy);
  await page.mouse.down();
  await page.mouse.move(L.bx + 4.5 * L.cell, L.by + 4.5 * L.cell, { steps: 6 });
  await page.mouse.up();
  const afterBomb = await state(page);
  expect(afterBomb.bomb).toBe(false);
  expect(afterBomb.board.filter(Boolean).length).toBeLessThan(filled);
  await page.waitForTimeout(800);
  expect(errors).toEqual([]);
});

test('Glow Grid: Continue after game over clears rows and play goes on', async ({ page }) => {
  const errors = await open(page, 11);
  await fromApp(page, { type: 'hwtodo:wallet', coins: 20 });
  await playUntilStuck(page);
  const stuck = await state(page);
  await expect(page.locator('#over')).toBeVisible();
  const cont = page.locator('#p-continue');
  await expect(cont).toBeVisible();
  await cont.click();
  await expect.poll(async () => (await sent(page)).filter((m) => m.type === 'hwtodo:buy').length).toBe(1);
  const buy = (await sent(page)).filter((m) => m.type === 'hwtodo:buy')[0];
  expect(buy).toMatchObject({ type: 'hwtodo:buy', cost: 15, label: 'Continue: clear 3 rows' });
  await fromApp(page, { type: 'hwtodo:bought', id: buy.id });
  await expect(page.locator('#over')).toBeHidden();
  const s = await state(page);
  expect(s.gameOver).toBe(false);
  expect(s.score).toBe(stuck.score);
  expect(s.board.filter(Boolean).length).toBeLessThan(stuck.board.filter(Boolean).length);
  // only once per game
  await playUntilStuck(page);
  await expect(page.locator('#over')).toBeVisible();
  await expect(cont).toBeHidden();
  expect(errors).toEqual([]);
});
