import { expect, test, type Page } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';
import { openApp } from './helpers';

async function openAdd(page: Page) {
  await page.goto('./?view=play');
  await page.getByRole('tab', { name: /Arcade/ }).click();
  await page.getByRole('button', { name: '➕ Add a game' }).click();
  return page.getByRole('dialog', { name: /Add a game/ });
}

test('add games from files, a zip, pasted code and a link', async ({ page }) => {
  const errors = await openApp(page, { economyEnabled: true });

  // an HTML page with a separate script and picture
  let dlg = await openAdd(page);
  await dlg.getByLabel('Game files').setInputFiles([
    {
      name: 'index.html',
      mimeType: 'text/html',
      buffer: Buffer.from('<html><head><title>Loose Files</title></head><body><p id="m">…</p><img src="dot.png"><script src="game.js"></script></body></html>'),
    },
    { name: 'game.js', mimeType: 'text/javascript', buffer: Buffer.from('document.getElementById("m").textContent = "script ran"') },
    { name: 'dot.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') },
  ]);
  await expect(dlg.getByLabel('Game name')).toHaveValue('Loose Files');
  await dlg.getByRole('button', { name: 'Try it' }).click();
  const frame = page.frameLocator('.player iframe');
  await expect(frame.locator('#m')).toHaveText('script ran');
  await expect(frame.locator('img')).toHaveJSProperty('naturalWidth', 1);
  await page.locator('.player').getByText('Close', { exact: true }).click();
  await dlg.getByLabel('Game name').fill('Loose Files');
  await dlg.getByRole('button', { name: 'Add to my arcade' }).click();
  await expect(page.locator('.card.game', { hasText: 'Loose Files' })).toBeVisible();

  // a zipped folder
  dlg = await openAdd(page);
  const zip = zipSync({
    'Zippy/index.html': strToU8('<title>Zippy</title><div id="z"></div><script src="js/app.js"></script>'),
    'Zippy/js/app.js': strToU8('document.getElementById("z").textContent = "zip ok"'),
  });
  await dlg.getByLabel('Game files').setInputFiles({ name: 'zippy.zip', mimeType: 'application/zip', buffer: Buffer.from(zip) });
  await expect(dlg.getByLabel('Game name')).toHaveValue('Zippy');
  await dlg.getByLabel('Cost').fill('0');
  await dlg.getByRole('button', { name: 'Add to my arcade' }).click();
  await page.locator('.card.game', { hasText: 'Zippy' }).getByRole('button', { name: 'Play' }).click();
  await expect(page.frameLocator('.player iframe').locator('#z')).toHaveText('zip ok');
  await page.locator('.player').getByText('Close', { exact: true }).click();

  // pasted JavaScript gets a canvas
  dlg = await openAdd(page);
  await dlg.getByRole('tab', { name: /Paste code/ }).click();
  await dlg.getByLabel('Game code').fill('document.body.dataset.w = document.getElementById("game").width > 0 ? "canvas" : "none";');
  await dlg.getByLabel('Game name').fill('Canvas toy');
  await dlg.getByRole('button', { name: 'Try it' }).click();
  await expect(page.frameLocator('.player iframe').locator('body')).toHaveAttribute('data-w', 'canvas');
  await page.locator('.player').getByText('Close', { exact: true }).click();
  await dlg.getByRole('button', { name: 'Cancel' }).click();

  // a Scratch link becomes its embed link
  dlg = await openAdd(page);
  await dlg.getByRole('tab', { name: /Link/ }).click();
  await dlg.getByLabel('Game link').fill('https://scratch.mit.edu/projects/10128407/');
  await dlg.getByRole('button', { name: 'Add to my arcade' }).click();
  await expect(page.locator('.card.game', { hasText: 'Scratch' })).toBeVisible();
  const saved = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const r = indexedDB.open('homework-todo');
        r.onsuccess = () => {
          const g = r.result.transaction('games').objectStore('games').getAll();
          g.onsuccess = () => resolve(JSON.stringify(g.result.map((x: { url?: string }) => x.url ?? '')));
        };
      }),
  );
  expect(saved).toContain('https://scratch.mit.edu/projects/10128407/embed');

  // remove one
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Remove Loose Files' }).click();
  await expect(page.locator('.card.game', { hasText: 'Loose Files' })).toHaveCount(0);
  expect(errors.filter((e) => !/sandboxed|scratch/i.test(e))).toEqual([]);
});

test('with a parent PIN, adding a game asks for it', async ({ page }) => {
  await openApp(page);
  // PIN 1234, hashed the way lib/parental.ts does
  const hash = await page.evaluate(async () => {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('homework-todo:parent:1234'));
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
  });
  await page.evaluate((h) => {
    const s = JSON.parse(localStorage.getItem('homework-todo:settings') ?? '{}');
    localStorage.setItem('homework-todo:settings', JSON.stringify({ ...s, parentPinHash: h }));
  }, hash);
  const dlg = await openAdd(page);
  await dlg.getByRole('tab', { name: /Paste code/ }).click();
  await dlg.getByLabel('Game code').fill('<p>hi</p>');
  await dlg.getByLabel('Parent PIN').fill('0000');
  await dlg.getByRole('button', { name: 'Add to my arcade' }).click();
  await expect(dlg.getByRole('alert')).toContainText('parent PIN');
  await dlg.getByLabel('Parent PIN').fill('1234');
  await dlg.getByRole('button', { name: 'Add to my arcade' }).click();
  await expect(dlg).toHaveCount(0);
});

test('arcade games can save progress through the app and load it next time', async ({ page }) => {
  const errors = await openApp(page);
  const dlg = await openAdd(page);
  await dlg.getByRole('tab', { name: /Paste code/ }).click();
  await dlg
    .getByLabel('Game code')
    .fill(
      `<p id="n">?</p><button id="b">+1</button><script>let n=0;addEventListener('message',e=>{if(e.data.type==='hwtodo:load'){n=e.data.data?JSON.parse(e.data.data).n:0;document.getElementById('n').textContent=n}});parent.postMessage({type:'hwtodo:hello'},'*');document.getElementById('b').onclick=()=>{n++;document.getElementById('n').textContent=n;parent.postMessage({type:'hwtodo:save',data:JSON.stringify({n})},'*')}</script>`,
    );
  await dlg.getByLabel('Game name').fill('Counter');
  await dlg.getByLabel('Cost').fill('0');
  await dlg.getByRole('button', { name: 'Add to my arcade' }).click();
  const open = async () => {
    await page.locator('.card.game', { hasText: 'Counter' }).getByRole('button', { name: 'Play' }).click();
    return page.frameLocator('.player iframe');
  };
  let f = await open();
  await expect(f.locator('#n')).toHaveText('0');
  await f.locator('#b').click();
  await f.locator('#b').click();
  await page.locator('.player').getByText('Close', { exact: true }).click();
  await page.goto('./?view=play');
  await page.getByRole('tab', { name: /Arcade/ }).click();
  f = await open();
  await expect(f.locator('#n')).toHaveText('2');
  expect(errors.filter((e) => !/sandboxed/.test(e))).toEqual([]);
});
