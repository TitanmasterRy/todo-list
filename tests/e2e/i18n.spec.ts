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

const nav = (page: Page, name: RegExp) => sidebar(page).getByRole('button', { name }).click();

test('Stats, Tools, Settings and Schoology in Spanish', async ({ page }) => {
  const errors = await openApp(page, { locale: 'es' });
  await expect(page.locator('html')).toHaveAttribute('lang', /^es/);

  // Stats, with the Friends card and the weekly review
  await nav(page, /Progreso/);
  await expect(page.getByRole('heading', { level: 1, name: 'Progreso' })).toBeVisible();
  await expect(page.getByText('Rachas, niveles, insignias y tu semana.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Compartir mi semana/ })).toBeVisible();
  await expect(page.getByText('Para esta semana, por materia')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Amigos' })).toContainText('Mi código de amistad');
  await expect(page.getByText('Primera tarea', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Repaso semanal' }).click();
  await expect(page.getByRole('dialog', { name: 'Repaso semanal' })).toContainText('Completadas por materia');
  await page.getByRole('dialog', { name: 'Repaso semanal' }).getByRole('button', { name: 'Listo' }).click();

  // Tools: the shell and a few tabs
  await nav(page, /Herramientas/);
  await expect(page.getByRole('heading', { level: 1, name: 'Herramientas' })).toBeVisible();
  const groups = page.getByRole('tablist', { name: 'Grupos de herramientas' });
  const tabs = page.getByRole('tablist', { name: 'Herramientas' });
  await groups.getByRole('tab', { name: 'Notas' }).click();
  await tabs.getByRole('tab', { name: /Calculadora de notas/ }).click();
  await expect(page.getByRole('heading', { name: 'Calculadora de notas' })).toBeVisible();
  await groups.getByRole('tab', { name: 'Calcular' }).click();
  await tabs.getByRole('tab', { name: /Conversor de unidades/ }).click();
  await page.getByRole('tab', { name: 'Temperatura' }).click();
  await page.getByLabel('Valor').fill('100');
  await expect(page.locator('.result')).toContainText('Fahrenheit');
  await expect(page.locator('.result')).toContainText('212');
  await tabs.getByRole('tab', { name: /Tabla periódica/ }).click();
  await expect(page.getByRole('button', { name: 'Hierro, Fe, número atómico 26' })).toBeVisible();
  await groups.getByRole('tab', { name: 'Estudiar' }).click();
  await tabs.getByRole('tab', { name: /Tarjetas/ }).click();
  await expect(page.getByRole('button', { name: 'Crear' })).toBeVisible();

  // Settings sections
  await openSettings(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible();
  await expect(page.getByText('Meta diaria (tareas)')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Descargar copia de seguridad' })).toBeVisible();
  await expect(page.getByText('Bloquear mis claves con una frase de contraseña')).toBeVisible();
  await expect(page.getByText('Qué va a dónde')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'suave' })).toBeVisible();

  // Schoology
  await nav(page, /Schoology/);
  await expect(page.getByText(/Tareas sincronizadas desde tu calendario de Schoology/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Conectar Schoology' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('English stays the default for Stats, Tools and Settings', async ({ page }) => {
  const errors = await openApp(page);
  await nav(page, /Stats/);
  await expect(page.getByRole('heading', { level: 1, name: 'Stats' })).toBeVisible();
  await expect(page.getByText('First Task', { exact: true })).toBeVisible();
  await nav(page, /Tools/);
  await expect(page.getByRole('tablist', { name: 'Tool groups' }).getByRole('tab', { name: 'Grades' })).toBeVisible();
  await openSettings(page);
  await expect(page.getByText('Daily goal (tasks)')).toBeVisible();
  expect(errors).toEqual([]);
});
