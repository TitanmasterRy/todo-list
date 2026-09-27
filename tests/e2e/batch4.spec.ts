import { expect, test, type Page } from '@playwright/test';
import { addTask, openApp } from './helpers';

function inDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
async function edit(page: Page, title: string) {
  await page.locator('.task', { hasText: title }).getByRole('button', { name: title, exact: true }).click();
  await expect(page.getByRole('form', { name: 'Edit task' })).toBeVisible();
}
async function goKey(page: Page, key: string) {
  await page.keyboard.press('Escape');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press(key);
}
async function save(page: Page) {
  await page.getByRole('button', { name: /^Save/ }).last().click();
}

test('plan it out: milestones are dated and chained before the big task', async ({ page }) => {
  await openApp(page, { autoDescribe: false });
  await addTask(page, 'Research paper');
  await goKey(page, '4');
  await edit(page, 'Research paper');
  await page.getByRole('form', { name: 'Edit task' }).getByLabel('Due date').fill(inDays(10));
  await page.getByText('🪜 Plan it out').click();
  await page.getByRole('form', { name: 'Edit task' }).getByLabel('Milestone template').selectOption('essay');
  await expect(page.getByRole('textbox', { name: 'Step 1' })).toHaveValue('Pick a topic and research');
  await page.getByRole('button', { name: 'Remove step 5' }).click();
  await page.getByRole('button', { name: 'Add 4 milestones' }).click();
  await save(page);
  const big = page.locator('.task').filter({ has: page.getByRole('button', { name: 'Research paper', exact: true }) });
  await expect(big).toContainText('after Revise and edit');
  const outline = page.getByRole('group', { name: 'Outline · Research paper', exact: true });
  await expect(outline).toContainText('🪜 Research paper');
  await expect(outline).toContainText('after Pick a topic');
  await expect(page.getByRole('group', { name: /· Research paper$/ })).toHaveCount(4);
});

test('exam prep: spaced sessions with a Study button that opens the deck', async ({ page }) => {
  await openApp(page, { autoDescribe: false });
  // a deck to study
  await goKey(page, '7');
  await page.getByRole('tablist', { name: 'Tool groups' }).getByRole('tab', { name: 'Study' }).click();
  await page
    .getByRole('tablist', { name: 'Tools' })
    .getByRole('tab', { name: /Notecards/ })
    .click();
  await page.getByLabel('Deck name').fill('Bio unit 3');
  await page.getByLabel('Deck name').press('Enter');
  await goKey(page, '4');
  await addTask(page, 'Bio test');
  await edit(page, 'Bio test');
  await page.getByRole('form', { name: 'Edit task' }).getByLabel('Type').selectOption('exam');
  await page.getByRole('form', { name: 'Edit task' }).getByLabel('Due date').fill(inDays(8));
  await page.getByText('🪜 Plan it out').click();
  await expect(page.getByRole('radio', { name: /Exam prep/ })).toHaveAttribute('aria-checked', 'true');
  const deck = page.getByRole('form', { name: 'Edit task' }).getByLabel('Deck to study');
  await deck.selectOption((await deck.locator('option', { hasText: 'Bio unit 3' }).getAttribute('value'))!);
  await page.getByRole('button', { name: 'Add 4 study sessions' }).click();
  await save(page);
  await expect(page.locator('.task', { hasText: 'Study for Bio test' })).toHaveCount(4);
  await page
    .locator('.task', { hasText: 'Study for Bio test (1/4)' })
    .getByRole('button', { name: /Study Bio unit 3/ })
    .click();
  await expect(page.getByRole('heading', { name: /Bio unit 3/ })).toBeVisible();
});

test('attachments: add a file, see it on the task, remove it', async ({ page }) => {
  const errors = await openApp(page, { autoDescribe: false });
  await addTask(page, 'Worksheet 4 today');
  await edit(page, 'Worksheet 4');
  await page.getByLabel('Attach files').setInputFiles({ name: 'worksheet.txt', mimeType: 'text/plain', buffer: Buffer.from('question 1: ...') });
  await expect(page.getByRole('link', { name: 'worksheet.txt' })).toBeVisible();
  await save(page);
  const row = page.locator('.task', { hasText: 'Worksheet 4' });
  await expect(row).toContainText('📎');
  // still there after a reload (IndexedDB)
  await page.reload();
  await edit(page, 'Worksheet 4');
  await expect(page.getByRole('link', { name: 'worksheet.txt' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove worksheet.txt' }).click();
  await expect(page.getByRole('link', { name: 'worksheet.txt' })).toHaveCount(0);
  await save(page);
  await expect(row).not.toContainText('📎');
  expect(errors).toEqual([]);
});

test('break mode pauses the streak and shows on Today', async ({ page }) => {
  await openApp(page);
  await page
    .getByRole('button', { name: /Settings/ })
    .first()
    .click();
  await page.getByLabel('Break name').fill('Fall break');
  await page.getByLabel('Break starts').fill(inDays(-1));
  await page.getByLabel('Break ends').fill(inDays(3));
  await page.getByRole('button', { name: 'Add break' }).click();
  await expect(page.getByText(/Fall break · .* \(now\)/)).toBeVisible();
  await goKey(page, '1');
  await expect(page.getByRole('status').filter({ hasText: 'Fall break' })).toContainText('streak is paused');
});

test("what's new shows once after an update, and from Settings → Help", async ({ page }) => {
  await openApp(page, { lastSeenChangelog: 'An older version' });
  await page.getByRole('button', { name: 'What’s new' }).click();
  const dlg = page.getByRole('dialog', { name: /What’s new/ });
  await expect(dlg).toBeVisible();
  await expect(dlg.locator('li').first()).toBeVisible();
  await dlg.getByRole('button', { name: 'Nice' }).click();
  await page.reload();
  await page.waitForTimeout(2500);
  await expect(page.getByText('Updated: see what’s new')).toHaveCount(0);
  await page
    .getByRole('button', { name: /Settings/ })
    .first()
    .click();
  await page.getByRole('button', { name: '✨ What’s new' }).click();
  await expect(page.getByRole('dialog', { name: /What’s new/ })).toBeVisible();
});

test('course board: move a task through To do → Doing → Done', async ({ page }) => {
  await openApp(page, { autoDescribe: false });
  await goKey(page, '3');
  await page.getByRole('button', { name: '+ New course' }).click();
  await page.getByRole('form', { name: 'New course' }).getByLabel('Name', { exact: true }).fill('Chemistry');
  await page.getByRole('form', { name: 'New course' }).getByLabel('Name', { exact: true }).press('Enter');
  await page.getByPlaceholder('Add a task to Chemistry…').fill('Titration lab');
  await page.getByPlaceholder('Add a task to Chemistry…').press('Enter');
  await page.getByRole('radio', { name: /Board/ }).click();
  const todo = page.getByRole('region', { name: /To do/ });
  const doing = page.getByRole('region', { name: /Doing/ });
  const done = page.getByRole('region', { name: /Done/ });
  await expect(todo).toContainText('Titration lab');
  await todo.getByRole('button', { name: 'Move Titration lab to Doing' }).click();
  await expect(doing).toContainText('Titration lab');
  await doing.getByRole('button', { name: 'Move Titration lab to Done' }).click();
  await expect(done).toContainText('Titration lab');
  await expect(todo).not.toContainText('Titration lab');
  // the layout choice sticks
  await page.reload();
  await goKey(page, '3');
  await page.locator('.col-title', { hasText: 'Chemistry' }).click();
  await expect(page.getByRole('radio', { name: /Board/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('region', { name: /Done/ })).toContainText('Titration lab');
});

test('print a weekly planner', async ({ page }) => {
  await openApp(page, { autoDescribe: false });
  await addTask(page, 'Spanish vocab quiz today');
  await goKey(page, '2');
  await page.getByRole('button', { name: /Print week/ }).click();
  const dlg = page.getByRole('dialog', { name: /Print a weekly planner/ });
  await expect(dlg.locator('#print-planner')).toContainText('Spanish vocab quiz');
  await dlg.getByRole('radio', { name: 'Next week' }).click();
  await expect(dlg.locator('#print-planner')).not.toContainText('Spanish vocab quiz');
  await dlg.getByRole('radio', { name: 'This week' }).click();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#print-planner')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Print', exact: true })).toBeHidden();
  const pdf = await page.pdf({ landscape: true });
  expect(pdf.byteLength).toBeGreaterThan(5000);
});

test('swipe a task right to complete it, left to snooze it (touch)', async ({ page }) => {
  const errors = await openApp(page);
  await addTask(page, 'Swipe me done today');
  await addTask(page, 'Swipe me later today');
  const swipeRow = (title: string, dx: number) =>
    page.locator('.task', { hasText: title }).evaluate((el, dx) => {
      const r = el.getBoundingClientRect();
      const y = r.top + r.height / 2;
      const x = r.left + r.width / 2;
      const ev = (type: string, cx: number) => new PointerEvent(type, { pointerType: 'touch', pointerId: 7, isPrimary: true, clientX: cx, clientY: y, bubbles: true });
      const body = el.querySelector('.body') ?? el;
      body.dispatchEvent(ev('pointerdown', x));
      for (let i = 1; i <= 8; i++) body.dispatchEvent(ev('pointermove', x + (dx * i) / 8));
      body.dispatchEvent(ev('pointerup', x + dx));
    }, dx);
  await swipeRow('Swipe me done', 200);
  await expect(page.locator('.task.done', { hasText: 'Swipe me done' })).toBeVisible();
  await swipeRow('Swipe me later', -200);
  await expect(page.locator('.toast', { hasText: /tomorrow/i })).toBeVisible();
  // a short drag does nothing
  await addTask(page, 'Barely moved today');
  await swipeRow('Barely moved', 30);
  await expect(page.locator('.task.done', { hasText: 'Barely moved' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the task editor shows what changed and when', async ({ page }) => {
  const errors = await openApp(page);
  await addTask(page, 'History essay today');
  await edit(page, 'History essay');
  const form = page.getByRole('form', { name: 'Edit task' });
  await form.getByLabel('Title', { exact: true }).fill('History essay final');
  await form.getByLabel('Estimate (min)').fill('45');
  await form.getByRole('button', { name: /^Save/ }).last().click();
  await edit(page, 'History essay final');
  await form.getByText(/History \(2 changes\)/).click();
  await expect(form.locator('.hist')).toContainText('Title: “History essay final”');
  await expect(form.locator('.hist')).toContainText(/Estimate \(min\): .* → 45/);
  expect(errors).toEqual([]);
});

test('long lists render a page at a time and load more on scroll', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const r = indexedDB.open('homework-todo');
        r.onsuccess = () => {
          const tx = r.result.transaction('tasks', 'readwrite');
          const now = new Date().toISOString();
          for (let i = 0; i < 400; i++)
            tx.objectStore('tasks').put({
              id: `bulk${i}`,
              title: `Old task ${i}`,
              tags: [],
              priority: 'normal',
              subtasks: [],
              createdAt: now,
              updatedAt: now,
              completedAt: now,
              order: i,
              deferredCount: 0,
            });
          tx.oncomplete = () => resolve();
        };
      }),
  );
  await page.goto('./?view=inbox');
  await page.getByRole('combobox', { name: /status/i }).selectOption('done');
  await expect(page.locator('.section-title .count')).toHaveText('400');
  await expect(page.locator('.task')).toHaveCount(150);
  await page.locator('.more').scrollIntoViewIfNeeded();
  await expect(page.locator('.task').nth(299)).toBeAttached();
  await page.locator('.task').last().scrollIntoViewIfNeeded();
  await expect(page.locator('.task')).toHaveCount(400);
  await expect(page.locator('.more')).toHaveCount(0);
  expect(errors).toEqual([]);
});
