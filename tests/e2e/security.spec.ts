import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { addTask, openApp } from './helpers';

const privacy = (page: Page) => page.locator('section#privacy');

async function openSettings(page: Page) {
  await page.goto('./?view=settings');
  await expect(privacy(page)).toBeVisible();
}

test('the production page ships a Content-Security-Policy without inline scripts', async ({ page }) => {
  // not openApp: this test causes a violation on purpose
  await page.goto('./');
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain('https://*.supabase.co');
  expect(/script-src [^;]*'unsafe-inline'/.test(csp ?? '')).toBe(false);
  // injected inline script is refused
  const ran = await page.evaluate(async () => {
    const w = window as unknown as { __injected?: boolean };
    const s = document.createElement('script');
    s.textContent = 'window.__injected = true';
    const blocked = new Promise<boolean>((resolve) => document.addEventListener('securitypolicyviolation', () => resolve(true), { once: true }));
    document.body.appendChild(s);
    await Promise.race([blocked, new Promise((r) => setTimeout(r, 500))]);
    return !!w.__injected;
  });
  expect(ran).toBe(false);
});

test('HTML previews and JavaScript still run under the policy (sandbox page, worker)', async ({ page }) => {
  const errors = await openApp(page);
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('7');
  await page.getByRole('tablist', { name: 'Tool groups' }).getByRole('tab', { name: 'Compute' }).click();
  await page
    .getByRole('tablist', { name: 'Tools' })
    .getByRole('tab', { name: /Code editor/ })
    .click();
  await page.getByLabel('Language for new snippet').selectOption('html');
  await page.getByRole('button', { name: '+ New' }).click();
  await page.getByRole('button', { name: /Run/ }).click();
  const frame = page.frameLocator('iframe[title="HTML preview"]');
  await frame.getByRole('button', { name: 'Click me' }).click();
  await expect(frame.locator('p')).toHaveText('You clicked the button.');
  await page.getByLabel('Language for new snippet').selectOption('javascript');
  await page.getByRole('button', { name: '+ New' }).click();
  await page.getByRole('button', { name: /Run/ }).click();
  await expect(page.locator('.console')).toContainText('Hello, world!');
  // the sandbox page refuses to render outside a sandboxed frame
  const direct = await page.context().newPage();
  await direct.goto('./sandbox.html');
  await expect(direct.locator('body')).toContainText('only runs inside');
  await direct.close();
  // the test's own init script can't read localStorage inside the sandboxed frame; that's the point
  expect(errors.filter((e) => !/sandboxed/.test(e))).toEqual([]);
});

test('an uploaded arcade game runs its inline script in the sandbox and can report a score', async ({ page }) => {
  const errors = await openApp(page, { arcadeAdmin: true });
  await openSettings(page);
  const game = `<!doctype html><html><body><p id="msg">loading</p><script>
    document.getElementById('msg').textContent = 'inline script ran';
    let blocked = 'no';
    try { localStorage.length; } catch (e) { blocked = e.name; }
    document.body.dataset.storage = blocked;
    parent.postMessage({ type: 'hwtodo:score', score: 42 }, '*');
  </script></body></html>`;
  await page.locator('label.file input[type=file]').setInputFiles({ name: 'mini-game.html', mimeType: 'text/html', buffer: Buffer.from(game) });
  await page.getByRole('button', { name: 'Preview', exact: true }).first().click();
  const frame = page.frameLocator('.player iframe');
  await expect(frame.locator('#msg')).toHaveText('inline script ran');
  await expect(frame.locator('body')).toHaveAttribute('data-storage', 'SecurityError');
  await expect(page.locator('.toast', { hasText: 'New high score in mini game' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  expect(errors.filter((e) => !/sandboxed/.test(e))).toEqual([]);
});

test('lock keys with a passphrase: stored encrypted, asked once when a feature needs the key', async ({ page }) => {
  const seen: string[] = [];
  await page.route('https://api.groq.com/**', async (route) => {
    seen.push(route.request().headers()['authorization'] ?? '');
    const models = route.request().url().endsWith('/models');
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(models ? { data: [{ id: 'llama-3.3-70b-versatile' }] } : { choices: [{ message: { content: 'OK' } }] }),
    });
  });
  const errors = await openApp(page, { aiProvider: 'groq', aiKeys: { groq: 'gsk_secret_test_key' } });
  await openSettings(page);
  await privacy(page).getByLabel('Key passphrase', { exact: true }).fill('correct horse battery');
  await privacy(page).getByLabel('Repeat key passphrase', { exact: true }).fill('correct horse battery');
  await privacy(page).getByRole('button', { name: 'Lock my keys' }).click();
  await expect(privacy(page)).toContainText('On · unlocked for this session');
  await expect(privacy(page)).toContainText('Groq AI key');
  const stored = await page.evaluate(() => [localStorage.getItem('homework-todo:settings') ?? '', localStorage.getItem('homework-todo:vault') ?? '']);
  expect(stored[0]).not.toContain('gsk_secret_test_key');
  expect(stored[1]).toContain('PBKDF2');
  expect(stored[1]).not.toContain('gsk_secret_test_key');

  // a new session: no prompt at startup (only an AI key is locked), the key still shows as saved
  await openSettings(page);
  await expect(privacy(page)).toContainText('On · locked');
  await expect(page.getByRole('dialog', { name: /Unlock your keys/ })).toHaveCount(0);
  const ai = page.locator('section', { has: page.getByRole('heading', { name: /AI helper/ }) });
  await expect(ai.getByText('Key saved', { exact: true })).toBeVisible();
  await ai.getByRole('button', { name: 'Test', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /Unlock your keys/ });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Passphrase').fill('wrong passphrase');
  await dialog.getByRole('button', { name: 'Unlock' }).click();
  await expect(dialog.getByRole('alert')).toContainText('not right');
  await dialog.getByLabel('Passphrase').fill('correct horse battery');
  await dialog.getByRole('button', { name: 'Unlock' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.toast', { hasText: 'Groq connected' })).toBeVisible();
  expect(seen.length).toBeGreaterThan(0);
  expect(seen.every((h) => h === 'Bearer gsk_secret_test_key')).toBe(true);
  expect(errors).toEqual([]);
});

test('encrypted backup round trip, and Delete everything wipes this device', async ({ page }) => {
  await openApp(page, { autoDescribe: false });
  await addTask(page, 'Secret essay outline');
  await openSettings(page);
  await privacy(page).getByLabel('Sync passphrase', { exact: true }).fill('sync passphrase 42');
  await privacy(page).getByLabel('Repeat sync passphrase', { exact: true }).fill('sync passphrase 42');
  await privacy(page).getByRole('button', { name: 'Turn on' }).click();
  await expect(privacy(page)).toContainText('If you forget this passphrase');
  await expect(page.getByLabel('Encrypt backups with my sync passphrase')).toBeChecked();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download backup' }).click()]);
  const text = readFileSync((await download.path())!, 'utf8');
  const file = JSON.parse(text) as Record<string, unknown>;
  expect(file.hwtodoEncrypted).toBe(1);
  expect(typeof file.salt).toBe('string');
  expect(text).not.toContain('Secret essay');

  await page.getByRole('button', { name: 'Delete everything…' }).click();
  const confirm = page.getByRole('group', { name: 'Delete everything?' });
  await expect(confirm).toContainText('This device: 1 task');
  await confirm.getByRole('button', { name: 'Delete everything' }).click();
  await expect(page.getByRole('list', { name: 'Deletion results' })).toContainText('This device: Deleted');
  expect(await page.evaluate(() => localStorage.getItem('homework-todo:settings') ?? '')).not.toContain('sync passphrase 42');

  // this device no longer has the passphrase: the file asks for it, and a wrong one is refused
  await page.locator('input[aria-label="Import file"]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await page.getByLabel('Backup passphrase').fill('nope nope');
  await page.getByRole('button', { name: 'Open and import' }).click();
  await expect(page.locator('form', { has: page.getByLabel('Backup passphrase') }).getByRole('alert')).toContainText('does not open this file');
  await page.getByLabel('Backup passphrase').fill('sync passphrase 42');
  await page.getByRole('button', { name: 'Open and import' }).click();
  await expect(page.locator('.toast', { hasText: 'Merged 1 tasks from file' })).toBeVisible();
  await page.goto('./?view=inbox');
  await expect(page.locator('.task', { hasText: 'Secret essay outline' })).toBeVisible();
});

test('Delete everything lists the synced copies and deletes each one (best effort)', async ({ page }) => {
  const deleted: string[] = [];
  await page.route('https://api.github.com/**', async (route) => {
    const r = route.request();
    if (r.method() === 'DELETE') {
      deleted.push(r.url());
      return route.fulfill({ status: 204, body: '' });
    }
    if (r.method() === 'GET') return route.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"Not Found"}' });
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 'abc123def456' }) });
  });
  await page.route('https://accounts.google.com/**', (route) => route.abort());
  await openApp(page, { gistToken: 'ghp_test_token', gistId: 'abc123def456', googleSyncEnabled: true, googleClientId: 'x.apps.googleusercontent.com' });
  await openSettings(page);
  await page.getByRole('button', { name: 'Delete everything…' }).click();
  const confirm = page.getByRole('group', { name: 'Delete everything?' });
  await expect(confirm).toContainText('GitHub Gist');
  await expect(confirm).toContainText('abc123de');
  await expect(confirm).toContainText('Google Drive file');
  await expect(confirm.getByRole('checkbox')).toHaveCount(2);
  await confirm.getByRole('button', { name: 'Delete everything' }).click();
  const results = page.getByRole('list', { name: 'Deletion results' });
  await expect(results).toContainText('✓ GitHub Gist: Deleted');
  await expect(results).toContainText('✗ Google Drive file'); // Google unreachable here: reported, not fatal
  await expect(results).toContainText('✓ This device: Deleted');
  expect(deleted).toEqual(['https://api.github.com/gists/abc123def456']);
  expect(await page.evaluate(() => localStorage.getItem('homework-todo:settings') ?? '')).not.toContain('ghp_test_token');
});

test('the privacy section explains what goes where', async ({ page }) => {
  await openApp(page);
  await openSettings(page);
  await expect(privacy(page)).toContainText('no analytics');
  await privacy(page).getByText('What goes where').click();
  for (const s of ['GitHub Gist sync', 'Google', 'AI helper', 'Schoology', 'api.crossref.org']) await expect(privacy(page).locator('.where')).toContainText(s);
});
