import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const manifest = JSON.parse(readFileSync(new URL('../../public/games/games.json', import.meta.url), 'utf8')) as { games: { id: string; src?: string }[] };

for (const g of manifest.games.filter((x) => x.src)) {
  test(`arcade game ${g.id} loads and starts without errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const t0 = Date.now();
    await page.goto(`./games/${g.src}?theme=classic&dark=1&accent=%236c5ce7&words=alpha,bravo,charlie,delta,echo`);
    const go = page.locator('#go');
    if (await go.isVisible().catch(() => false)) await go.click();
    await page.mouse.move(200, 300);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('a');
    await page.mouse.click(200, 200);
    await page.waitForTimeout(600);
    expect(errors).toEqual([]);
    expect(Date.now() - t0).toBeLessThan(10_000); // e.g. sudoku generation stays fast
  });
}
