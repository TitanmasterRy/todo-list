import { expect, test, type Page } from '@playwright/test';
import { openApp } from './helpers';

const PASS = 'owner passphrase 1';
const dialog = (page: Page) => page.getByRole('dialog', { name: /Admin/ });

async function openAdmin(page: Page, first = true) {
  await page.goto('./?admin');
  await expect(dialog(page)).toBeVisible();
  if (first) {
    await dialog(page).getByLabel('New admin passphrase').fill(PASS);
    await dialog(page).getByLabel('Repeat admin passphrase').fill(PASS);
    await dialog(page).getByRole('button', { name: 'Set passphrase' }).click();
  } else {
    await dialog(page).getByLabel('Admin passphrase').fill(PASS);
    await dialog(page).getByRole('button', { name: 'Unlock', exact: true }).click();
  }
  await expect(dialog(page).getByRole('tab', { name: /Overview/ })).toBeVisible();
}

test('the hidden admin panel: passphrase, economy grants and undo', async ({ page }) => {
  const errors = await openApp(page, { economyEnabled: true });
  // nothing about it in Settings
  await page.goto('./?view=settings');
  await expect(page.getByText(/arcade admin/i)).toHaveCount(0);

  await openAdmin(page);
  await expect(dialog(page)).toContainText('Tasks');
  await dialog(page)
    .getByRole('tab', { name: /Economy/ })
    .click();
  await dialog(page).getByLabel('Amount').fill('500');
  await dialog(page).getByLabel('Note').fill('launch bonus');
  await dialog(page).getByRole('button', { name: 'Give', exact: true }).click();
  await expect(dialog(page).locator('.big')).toContainText('🪙 500');
  await expect(dialog(page).locator('table')).toContainText('launch bonus');
  page.once('dialog', (d) => void d.accept());
  await dialog(page).getByRole('button', { name: 'Undo' }).first().click();
  await expect(dialog(page).locator('.big')).toContainText('🪙 0');

  // lock, then a wrong passphrase is refused
  await dialog(page).getByRole('button', { name: 'Lock', exact: true }).click();
  await dialog(page).getByLabel('Admin passphrase').fill('not it');
  await dialog(page).getByRole('button', { name: 'Unlock', exact: true }).click();
  await expect(dialog(page).getByRole('alert')).toContainText('not it');
  await dialog(page).getByRole('button', { name: 'Close' }).click();

  // after a reload it asks again (the passphrase isn't kept)
  await openAdmin(page, false);
  expect(errors).toEqual([]);
});

test('admin site tab: an announcement shows for this device and publishes to GitHub', async ({ page }) => {
  const puts: { url: string; body: Record<string, string> }[] = [];
  await page.route('https://api.github.com/repos/**', async (route) => {
    const req = route.request();
    if (req.method() === 'PUT') {
      puts.push({ url: req.url(), body: JSON.parse(req.postData() ?? '{}') });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ commit: { html_url: 'https://github.com/o/r/commit/abc' } }) });
    } else await route.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"Not Found"}' });
  });
  const errors = await openApp(page);
  await openAdmin(page);
  await dialog(page).getByRole('tab', { name: /Site/ }).click();
  await dialog(page).getByLabel('Announcement text').fill('Finals week: good luck!');
  await dialog(page).getByRole('button', { name: 'Try on this device' }).click();
  await expect(page.locator('.announce')).toContainText('Finals week: good luck!');

  await dialog(page).getByLabel('Repository owner').fill('o');
  await dialog(page).getByLabel('Repository name').fill('r');
  await dialog(page).getByLabel('GitHub token').fill('github_pat_test');
  await dialog(page).getByRole('button', { name: 'Save', exact: true }).click();
  await dialog(page)
    .getByRole('button', { name: /Publish to the site/ })
    .click();
  await expect(page.locator('.toast', { hasText: 'Published' })).toBeVisible();
  expect(puts).toHaveLength(1);
  expect(puts[0].url).toContain('/repos/o/r/contents/public/site.json');
  const published = JSON.parse(Buffer.from(puts[0].body.content, 'base64').toString('utf8'));
  expect(published.announcement.text).toBe('Finals week: good luck!');
  // the token is stored sealed, not in plain text
  const meta = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const r = indexedDB.open('homework-todo');
        r.onsuccess = () => {
          const g = r.result.transaction('meta').objectStore('meta').get('admin');
          g.onsuccess = () => resolve(JSON.stringify(g.result));
        };
      }),
  );
  expect(meta).not.toContain('github_pat_test');
  expect(meta).toContain('PBKDF2');

  await dialog(page).getByRole('button', { name: 'Close' }).click();
  await page.locator('.announce').getByRole('button', { name: 'Dismiss' }).click();
  await expect(page.locator('.announce')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('tapping the version in Settings → Help 7 times opens the admin panel', async ({ page }) => {
  await openApp(page);
  await page.goto('./?view=settings');
  const ver = page.locator('button.ver');
  for (let i = 0; i < 7; i++) await ver.click();
  await expect(dialog(page)).toBeVisible();
});
