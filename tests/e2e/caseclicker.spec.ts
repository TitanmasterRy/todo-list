import { expect, test, type Frame, type Page } from '@playwright/test';

// Crate Rush (public/games/craterush.html): the arcade's crate-opening clicker.
// The page exposes window.crateRush.state() so tests can read the game state.

interface Item {
  u: number;
  d: number;
  w: number;
  s: number;
  t: number;
  l: number;
}
interface State {
  cash: number;
  inv: Item[];
  luck: number;
  stats: { clicks: number; opened: number; sold: number };
}
type Msg = { type?: string; id?: string; label?: string; cost?: number; score?: number; data?: string };
type Target = Page | Frame;

const state = (t: Target) => t.evaluate(() => (window as unknown as { crateRush: { state(): State } }).crateRush.state());

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

/** Click the big button n times (with the mouse: the button squishes on every press, so no waiting for it to settle). */
async function earn(page: Page, t: Target, n: number) {
  const box = (await t.locator('#clicker').boundingBox())!;
  for (let k = 0; k < n; k++) await page.mouse.click(box.x + box.width / 2 + (k % 5) * 4, box.y + box.height / 2);
}

/** Opens the first crate once, skips the spin and waits for the reveal. */
async function openOne(t: Target) {
  await t.locator('[data-a="open"][data-v="0"]').first().click();
  await t.locator('[data-a="skip"]').click();
  await expect(t.locator('.reveal')).toBeVisible();
}

test('Crate Rush: click to earn, open a crate, find it in Items and sell it', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./games/craterush.html?seed=5&dark=1');
  await expect(page.locator('#clicker svg')).toBeVisible();
  // opened on its own: no app, so no coin power-ups
  await expect(page.locator('#powers')).toBeHidden();

  await earn(page, page, 12);
  const s0 = await state(page);
  expect(s0.stats.clicks).toBe(12);
  expect(s0.cash).toBeGreaterThanOrEqual(12);
  await expect(page.locator('#cash')).toHaveText(/^\$1\d\.\d\d$/);
  await expect(page.locator('[data-a="open"][data-v="0"]')).toBeEnabled();
  await expect(page.locator('[data-a="open"][data-v="1"]')).toBeDisabled(); // $75 crate

  await openOne(page);
  const s1 = await state(page);
  expect(s1.inv).toHaveLength(1);
  expect(s1.stats.opened).toBe(1);
  expect(s1.cash).toBeCloseTo(s0.cash - 10, 1);
  const name = await page.evaluate((d) => (eval('ITEMS') as { name: string }[])[d].name, s1.inv[0].d);
  await expect(page.locator('.reveal .rv-name')).toContainText(name);
  await page.locator('.reveal [data-a="close"]').click();
  await expect(page.locator('#layer')).toBeHidden();

  await page.locator('.tab-inv').click();
  const cardEl = page.locator('#invgrid .icard');
  await expect(cardEl).toHaveCount(1);
  await cardEl.click();
  await expect(page.locator('.modal')).toBeVisible();
  const before = (await state(page)).cash;
  await page.locator('.modal [data-a="sell"]').click();
  const s2 = await state(page);
  expect(s2.inv).toHaveLength(0);
  expect(s2.stats.sold).toBeGreaterThan(0);
  expect(s2.cash).toBeGreaterThan(before);
  await expect(page.locator('#view')).toContainText('No items yet');
  await page.waitForTimeout(400);
  expect(errors).toEqual([]);
});

test('Crate Rush: opens 5 at once with a grid reveal and sells them all', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./games/craterush.html?seed=9');
  await earn(page, page, 55);
  await page.locator('[data-a="openn"][data-v="5"]').click();
  await page.locator('[data-a="open"][data-v="0"]').first().click();
  await expect(page.locator('.reel')).toHaveCount(5);
  await page.locator('[data-a="skip"]').click();
  await expect(page.locator('.rgrid .icard')).toHaveCount(5);
  expect((await state(page)).inv).toHaveLength(5);
  await page.locator('[data-a="rsellall"]').click();
  expect((await state(page)).inv).toHaveLength(0);
  expect(errors).toEqual([]);
});

// ---------- inside the app: a stand-in parent page that plays the app's part of the protocol ----------
const HARNESS = './__craterush-harness.html';
function harness(save: string | null, coins = 30) {
  return `<!doctype html><meta charset="utf-8"><body style="margin:0">
<iframe id="g" src="./games/craterush.html?seed=3" sandbox="allow-scripts" style="border:0;width:1200px;height:760px"></iframe>
<script>
  window.msgs = [];
  window.saved = ${JSON.stringify(save)};
  const f = document.getElementById('g');
  window.reply = (m) => f.contentWindow.postMessage(m, '*');
  addEventListener('message', (e) => {
    if (e.source !== f.contentWindow) return;
    msgs.push(e.data);
    if (e.data && e.data.type === 'hwtodo:hello') {
      reply({ type: 'hwtodo:load', data: window.saved });
      reply({ type: 'hwtodo:wallet', coins: ${coins} });
    }
    if (e.data && e.data.type === 'hwtodo:save') window.saved = e.data.data;
  });
</script></body>`;
}
async function openInApp(page: Page, save: string | null) {
  await page.route('**/__craterush-harness.html', (route) => route.fulfill({ contentType: 'text/html', body: harness(save) }));
  await page.goto(HARNESS);
  await expect.poll(() => page.frames().length).toBeGreaterThan(1);
  const frame = page.frames().find((f) => f.url().includes('craterush.html'))!;
  await expect(frame.locator('#boot')).toBeHidden();
  return frame;
}
const msgs = (page: Page) => page.evaluate(() => (window as unknown as { msgs: Msg[] }).msgs);
const saved = (page: Page) => page.evaluate(() => (window as unknown as { saved: string | null }).saved);
const reply = (page: Page, m: object) => page.evaluate((m) => (window as unknown as { reply(m: object): void }).reply(m), m);

test('Crate Rush: saves to the app and loads back; coin power-ups apply only once the app confirms', async ({ page }) => {
  const errors = watchErrors(page);
  const game = await openInApp(page, null);
  await expect.poll(() => msgs(page)).toContainEqual({ type: 'hwtodo:hello' });

  // play a little: the save follows shortly after opening a crate
  await earn(page, game, 14);
  await openOne(game);
  await game.locator('.reveal [data-a="close"]').click();
  const { inv } = await state(game);
  expect(inv).toHaveLength(1);
  await expect.poll(async () => JSON.parse((await saved(page)) || '{}').inv?.length, { timeout: 5000 }).toBe(1);
  await expect.poll(async () => (await msgs(page)).some((m) => m.type === 'hwtodo:score' && (m.score ?? 0) >= 14)).toBe(true);

  // the wallet arrived, so the power-ups show
  await expect(game.locator('#powers')).toBeVisible();
  await expect(game.locator('#coins')).toHaveText('30');
  const cash0 = (await state(game)).cash;
  await game.locator('#p-cash').click();
  const buys = async () => (await msgs(page)).filter((m) => m.type === 'hwtodo:buy');
  await expect.poll(async () => (await buys()).length).toBe(1);
  const first = (await buys())[0];
  expect(first).toMatchObject({ label: 'Cash crate', cost: 5 });
  expect(first.id).toMatch(/^[a-z0-9-]{1,40}$/);
  await expect(game.locator('#p-lucky')).toBeDisabled(); // one purchase at a time
  expect((await state(game)).cash).toBeCloseTo(cash0, 0); // nothing until the app says so

  // denied: a toast, and still nothing
  await reply(page, { type: 'hwtodo:denied', id: first.id, reason: 'Not enough coins' });
  await expect(game.locator('.toast').filter({ hasText: 'Not enough coins' })).toBeVisible();
  expect((await state(game)).cash).toBeCloseTo(cash0, 0);

  // asked again and confirmed: applied once, even if the confirmation repeats
  await game.locator('#p-cash').click();
  await expect.poll(async () => (await buys()).length).toBe(2);
  const second = (await buys())[1];
  expect(second.id).not.toBe(first.id);
  await reply(page, { type: 'hwtodo:bought', id: 'cash-somebody-else' });
  await page.waitForTimeout(150);
  expect((await state(game)).cash).toBeCloseTo(cash0, 0);
  await reply(page, { type: 'hwtodo:bought', id: second.id });
  await expect.poll(async () => (await state(game)).cash).toBeGreaterThanOrEqual(cash0 + 100);
  const cash1 = (await state(game)).cash;
  await reply(page, { type: 'hwtodo:bought', id: second.id });
  await page.waitForTimeout(150);
  expect((await state(game)).cash).toBeLessThan(cash1 + 5);

  // a lucky key: confirmed → five boosted crates
  await game.locator('#p-lucky').click();
  await expect.poll(async () => (await buys()).length).toBe(3);
  await reply(page, { type: 'hwtodo:bought', id: (await buys())[2].id });
  await expect.poll(async () => (await state(game)).luck).toBe(5);
  await expect(game.locator('#c-luck')).toBeVisible();

  // the save catches up, then a fresh visit loads it
  await expect.poll(async () => JSON.parse((await saved(page)) || '{}').luck, { timeout: 5000 }).toBe(5);
  const save = await saved(page);
  const before = await state(game);
  await page.unrouteAll();
  const again = await openInApp(page, save);
  const after = await state(again);
  expect(after.inv).toEqual(before.inv);
  expect(after.luck).toBe(5);
  expect(after.stats.clicks).toBe(before.stats.clicks);
  expect(after.cash).toBeGreaterThanOrEqual(before.cash - 0.01);
  await again.locator('.tab-inv').click();
  await expect(again.locator('#invgrid .icard')).toHaveCount(1);
  expect(errors).toEqual([]);
});
