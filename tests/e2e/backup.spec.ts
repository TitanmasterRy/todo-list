import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { addTask, openApp, seedCoins } from './helpers';

const privacy = (page: Page) => page.locator('section#privacy');
const admin = (page: Page) => page.getByRole('dialog', { name: /Admin/ });

async function download(page: Page): Promise<string> {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download backup' }).click()]);
  return readFileSync((await dl.path())!, 'utf8');
}

/** Game progress the way the games store it: Orebelt/garden/arcade scores in localStorage, arcade saves in IndexedDB. */
async function seedGames(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        localStorage.setItem('homework-todo:arcade-scores', JSON.stringify({ snake: 420 }));
        const r = indexedDB.open('homework-todo');
        r.onsuccess = () => {
          const tx = r.result.transaction('meta', 'readwrite');
          tx.objectStore('meta').put('level 7', 'gamesave:snake');
          tx.oncomplete = () => resolve();
        };
      }),
  );
}

test('backups carry game progress, and keys only when sealed with the sync passphrase', async ({ page, browser }) => {
  const errors = await openApp(page, { autoDescribe: false, aiKeys: { groq: 'gsk_e2e_secret_key' }, schoologyDomain: 'https://school.schoology.com' });
  await addTask(page, 'Backed-up task');
  await seedGames(page);
  await page.goto('./?view=settings');
  await expect(privacy(page)).toBeVisible();

  // no sync passphrase: keys stay out of the file, game progress goes in
  await expect(page.getByText('Keys and sign-ins are left out of backups')).toBeVisible();
  const plain = await download(page);
  const plainFile = JSON.parse(plain) as Record<string, unknown>;
  expect(plain).not.toContain('gsk_e2e_secret_key');
  expect(plainFile.account).toBeUndefined();
  expect(plainFile.gameData).toEqual({ local: { 'homework-todo:arcade-scores': '{"snake":420}' }, saves: { snake: 'level 7' } });

  // with one: the keys ride along, encrypted on their own (the file itself left readable here)
  await privacy(page).getByLabel('Sync passphrase', { exact: true }).fill('sync passphrase 42');
  await privacy(page).getByLabel('Repeat sync passphrase', { exact: true }).fill('sync passphrase 42');
  await privacy(page).getByRole('button', { name: 'Turn on' }).click();
  await page.getByLabel('Encrypt backups with my sync passphrase').uncheck();
  await expect(page.getByLabel(/Include my keys and sign-ins/)).toBeChecked();
  const text = await download(page);
  const file = JSON.parse(text) as { account?: Record<string, unknown>; tasks: unknown[] };
  expect(file.tasks).toHaveLength(1);
  expect(file.account?.hwtodoEncrypted).toBe(1);
  expect(text).not.toContain('gsk_e2e_secret_key');
  expect(text).not.toContain('sync passphrase 42');
  expect(errors).toEqual([]);

  // a new device: the data imports, and the backup's password unlocks the keys
  const fresh = await (await browser.newContext()).newPage();
  const freshErrors = await openApp(fresh, { autoDescribe: false });
  await fresh.goto('./?view=settings');
  await fresh.locator('input[aria-label="Import file"]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(fresh.getByText('This backup also holds keys and sign-ins')).toBeVisible();
  await fresh.getByLabel('Backup passphrase').fill('not the one');
  await fresh.getByRole('button', { name: 'Restore keys and import' }).click();
  await expect(fresh.locator('form', { has: fresh.getByLabel('Backup passphrase') }).getByRole('alert')).toContainText('does not open this file');
  await fresh.getByLabel('Backup passphrase').fill('sync passphrase 42');
  await fresh.getByRole('button', { name: 'Restore keys and import' }).click();
  await expect(fresh.locator('.toast', { hasText: 'Restored 2 keys and sign-ins' })).toBeVisible();
  await expect(fresh.locator('.toast', { hasText: 'Game progress restored' })).toBeVisible();
  const restored = await fresh.evaluate(() => ({
    settings: JSON.parse(localStorage.getItem('homework-todo:settings') ?? '{}') as { aiKeys?: Record<string, string>; schoologyDomain?: string; syncPassphrase?: string },
    scores: localStorage.getItem('homework-todo:arcade-scores'),
  }));
  expect(restored.settings.aiKeys?.groq).toBe('gsk_e2e_secret_key');
  expect(restored.settings.syncPassphrase).toBe('sync passphrase 42');
  expect(restored.settings.schoologyDomain).toBe('https://school.schoology.com');
  expect(restored.scores).toBe('{"snake":420}');
  await fresh.goto('./?view=inbox');
  await expect(fresh.locator('.task', { hasText: 'Backed-up task' })).toBeVisible();
  expect(freshErrors).toEqual([]);
});

test('coins typed into storage by hand do not count until the admin approves them', async ({ page }) => {
  const errors = await openApp(page, { economyEnabled: true });
  await seedCoins(page, 250); // sealed, like the app's own entries
  await expect(page.locator('.sidebar .wallet')).toContainText('🪙 250');

  await seedCoins(page, 100000, 'coins', false);
  await expect(page.locator('.toast', { hasText: '1 coin entry failed the tamper check' })).toBeVisible();
  await expect(page.locator('.sidebar .wallet')).toContainText('🪙 250');

  await page.goto('./?admin');
  await admin(page).getByLabel('New admin passphrase').fill('owner passphrase 1');
  await admin(page).getByLabel('Repeat admin passphrase').fill('owner passphrase 1');
  await admin(page).getByRole('button', { name: 'Set passphrase' }).click();
  await admin(page)
    .getByRole('tab', { name: /Economy/ })
    .click();
  const check = admin(page).getByRole('region', { name: /Tamper check/ });
  await expect(check).toContainText('1 set aside');
  await expect(check).toContainText('+100000');
  await check.getByRole('button', { name: 'Approve' }).click();
  await expect(check).toContainText('0 set aside');
  await expect(admin(page).locator('.big')).toContainText('🪙 100,250');
  expect(errors).toEqual([]);
});
