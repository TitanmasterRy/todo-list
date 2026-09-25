import { expect, type Page } from '@playwright/test';

/** Open the app with onboarding and the daily prompts already dismissed. Fails the test on page errors. */
export async function openApp(page: Page, settings: Record<string, unknown> = {}): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  const today = new Date().toISOString().slice(0, 10);
  await page.addInitScript(
    ([s, day]) => {
      if (!localStorage.getItem('homework-todo:settings')) {
        localStorage.setItem('homework-todo:settings', JSON.stringify({ onboarded: true, soundPromptShown: true, lastFrogPromptDate: day, lastRecapDate: day, ...s }));
      }
    },
    [settings, today] as const,
  );
  await page.goto('./');
  await expect(page.locator('.shell')).toBeVisible();
  return errors;
}

export async function addTask(page: Page, text: string): Promise<void> {
  const box = page.locator('[data-quick-add]').first();
  await box.fill(text);
  await box.press('Enter');
}

/** Put coins in the wallet directly (IndexedDB ledger), then reload. */
export async function seedCoins(page: Page, amount: number): Promise<void> {
  await page.evaluate(
    (n) =>
      new Promise<void>((resolve) => {
        const r = indexedDB.open('homework-todo');
        r.onsuccess = () => {
          const tx = r.result.transaction('ledger', 'readwrite');
          tx.objectStore('ledger').put({ id: `seed-${Date.now()}`, at: new Date().toISOString(), currency: 'coins', amount: n, reason: 'task' });
          tx.oncomplete = () => resolve();
        };
      }),
    amount,
  );
  await page.reload();
  await expect(page.locator('.shell')).toBeVisible();
}
