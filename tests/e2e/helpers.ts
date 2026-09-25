import { expect, type Page } from '@playwright/test';

/** Open the app with onboarding and the daily prompts already dismissed. Fails the test on page errors. */
export async function openApp(page: Page, settings: Record<string, unknown> = {}): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
    // the production build ships a Content-Security-Policy: any violation fails the test, in every spec
    if (/Content Security Policy/i.test(m.text())) {
      try {
        expect.soft(m.text(), 'Content-Security-Policy violation').toBe('');
      } catch {
        /* reported after the test ended */
      }
    }
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

/** Put coins (or vouchers) in the wallet directly (IndexedDB ledger), then reload. */
export async function seedCoins(page: Page, amount: number, currency: 'coins' | 'vouchers' = 'coins'): Promise<void> {
  await page.evaluate(
    ([n, cur]) =>
      new Promise<void>((resolve) => {
        const r = indexedDB.open('homework-todo');
        r.onsuccess = () => {
          const tx = r.result.transaction('ledger', 'readwrite');
          tx.objectStore('ledger').put({ id: `seed-${Date.now()}`, at: new Date().toISOString(), currency: cur, amount: n, reason: 'task' });
          tx.oncomplete = () => resolve();
        };
      }),
    [amount, currency] as const,
  );
  await page.reload();
  await expect(page.locator('.shell')).toBeVisible();
}

/** Add a notecard deck straight to IndexedDB, then reload. */
export async function seedDeck(page: Page, name: string, cards: [string, string][]): Promise<void> {
  await page.evaluate(
    ([deckName, pairs]) =>
      new Promise<void>((resolve) => {
        const r = indexedDB.open('homework-todo');
        r.onsuccess = () => {
          const now = new Date().toISOString();
          const deckId = `deck-${deckName.replace(/\W+/g, '-')}`;
          const tx = r.result.transaction(['decks', 'cards'], 'readwrite');
          tx.objectStore('decks').put({ id: deckId, name: deckName, createdAt: now, updatedAt: now });
          pairs.forEach(([front, back], i) =>
            tx.objectStore('cards').put({ id: `${deckId}-${i}`, deckId, front, back, box: 1, due: now.slice(0, 10), reps: 0, lapses: 0, createdAt: now, updatedAt: now }),
          );
          tx.oncomplete = () => resolve();
        };
      }),
    [name, cards] as const,
  );
  await page.reload();
  await expect(page.locator('.shell')).toBeVisible();
}
