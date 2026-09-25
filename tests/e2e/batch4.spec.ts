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
