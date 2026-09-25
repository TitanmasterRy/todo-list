import { expect, test, type Page } from '@playwright/test';
import { addTask, openApp } from './helpers';

const sidebar = (page: Page) => page.locator('.sidebar');

async function openSettings(page: Page) {
  await sidebar(page)
    .getByRole('button', { name: /Settings|Ajustes/ })
    .click();
  await expect(page.locator('#lang')).toBeVisible();
}

/** The saved task with this title, straight from IndexedDB. */
function savedTask(page: Page, title: string) {
  return page.evaluate(
    (t) =>
      new Promise<{ dueAt?: string; priority?: string } | undefined>((resolve) => {
        const r = indexedDB.open('homework-todo');
        r.onsuccess = () => {
          const all = r.result.transaction('tasks').objectStore('tasks').getAll();
          all.onsuccess = () => resolve((all.result as { title: string; dueAt?: string; priority?: string }[]).find((x) => x.title === t));
        };
      }),
    title,
  );
}

test('switch to Español, add a task in Spanish, and switch back', async ({ page }) => {
  const errors = await openApp(page);
  await openSettings(page);
  await page.locator('#lang').selectOption('es');
  await expect(page.locator('html')).toHaveAttribute('lang', /^es/);
  await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible();
  for (const label of ['Hoy', 'Próximas', 'Materias', 'Bandeja', 'Enfoque']) await expect(sidebar(page)).toContainText(label);

  await sidebar(page).getByRole('button', { name: /Hoy/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Hoy' })).toBeVisible();
  await expect(page.locator('.page-head .sub')).toHaveText(/^(lunes|martes|miércoles|jueves|viernes|sábado|domingo), \d+ \S+$/);
  await expect(page.getByText('Para hoy', { exact: true })).toBeVisible();

  // the quick-add preview reads the Spanish date, time and priority
  const box = page.locator('[data-quick-add]').first();
  await box.fill('Leer capítulo 3 mañana a las 5 !alta');
  await expect(page.locator('.preview .chip.due')).toHaveText(/Mañana 5\sp\.\sm\./);
  await box.press('Enter');
  await expect(page.locator('.toast', { hasText: 'Añadida: “Leer capítulo 3”' })).toBeVisible();

  const task = await savedTask(page, 'Leer capítulo 3');
  expect(task?.priority).toBe('high');
  const due = new Date(task!.dueAt!);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  expect([due.getFullYear(), due.getMonth(), due.getDate(), due.getHours(), due.getMinutes()]).toEqual([tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 17, 0]);

  // Upcoming shows it under tomorrow, with Spanish labels
  await sidebar(page)
    .getByRole('button', { name: /Próximas/ })
    .click();
  const row = page.locator('.task', { hasText: 'Leer capítulo 3' });
  await expect(row).toContainText(/Mañana 5\sp\.\sm\./);
  await expect(row).toContainText('Alta');
  await expect(page.locator('.section-title.day').nth(1)).toContainText(/^Mañana · /);

  // and back to English
  await openSettings(page);
  await page.locator('#lang').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', /^en/);
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await expect(sidebar(page)).toContainText('Upcoming');
  await sidebar(page)
    .getByRole('button', { name: /Upcoming/ })
    .click();
  await expect(row).toContainText('Tomorrow 5pm');
  expect(errors).toEqual([]);
});

test.describe('Auto language', () => {
  test.use({ locale: 'es-MX' });
  test('follows the browser language', async ({ page }) => {
    const errors = await openApp(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'es-MX');
    await expect(page.getByRole('heading', { level: 1, name: 'Hoy' })).toBeVisible();
    await addTask(page, 'Ensayo el viernes');
    await sidebar(page)
      .getByRole('button', { name: /Próximas/ })
      .click();
    await expect(page.locator('.task', { hasText: 'Ensayo' })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test('right-to-left layout puts the sidebar on the right', async ({ page }) => {
  const errors = await openApp(page, { forceRtl: true });
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const width = page.viewportSize()!.width;
  const nav = (await sidebar(page).boundingBox())!;
  expect(nav.x + nav.width).toBeGreaterThan(width - 2);
  expect(nav.x).toBeGreaterThan(width / 2);
  const main = (await page.locator('main').boundingBox())!;
  expect(main.x + main.width).toBeLessThanOrEqual(nav.x + 1);
  // and the switch in Settings turns it off again
  await openSettings(page);
  await page.getByLabel(/Right-to-left layout/).uncheck();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  expect((await sidebar(page).boundingBox())!.x).toBeLessThan(1);
  expect(errors).toEqual([]);
});

test('right-to-left phone layout has no horizontal scroll @phone', async ({ page }) => {
  const errors = await openApp(page, { forceRtl: true, locale: 'es' });
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await addTask(page, 'Una tarea con un título bastante largo que debería ajustarse bien en una pantalla pequeña #historia !alta ~45m');
  await expect(page.locator('.task', { hasText: 'Una tarea' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
