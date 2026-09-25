import { expect, test, type Page } from '@playwright/test';
import { addTask, openApp } from './helpers';

async function edit(page: Page, title: string) {
  await page.locator('.task', { hasText: title }).getByRole('button', { name: title }).click();
  await expect(page.getByRole('form', { name: 'Edit task' })).toBeVisible();
}
async function save(page: Page) {
  await page.getByRole('button', { name: /^Save/ }).last().click();
}

test('a task can wait on another; What now skips it', async ({ page }) => {
  await openApp(page);
  await addTask(page, 'Outline essay today');
  await addTask(page, 'Draft essay today !urgent');
  await edit(page, 'Draft essay');
  const pick = page.getByLabel('Task that must be done first');
  await pick.selectOption((await pick.locator('option', { hasText: 'Outline essay' }).getAttribute('value'))!);
  await page.getByRole('button', { name: 'Add', exact: true }).last().click();
  await save(page);
  const draft = page.locator('.task', { hasText: 'Draft essay' });
  await expect(draft).toContainText('after Outline essay');
  await page.getByRole('button', { name: /What now/ }).click();
  await expect(page.getByRole('region', { name: 'Suggested next task' })).toContainText('Outline essay');
  await page
    .locator('.task')
    .filter({ has: page.getByRole('button', { name: 'Outline essay', exact: true }) })
    .getByRole('checkbox')
    .click();
  await expect(draft).not.toContainText('after Outline essay');
});

test('reminders fire as an in-app toast', async ({ page }) => {
  await openApp(page);
  await addTask(page, 'Call lab partner today');
  await edit(page, 'Call lab partner');
  const now = new Date();
  const local = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  await page.getByLabel('Remind me at').fill(local);
  await page.getByRole('button', { name: 'Add time' }).click();
  await save(page);
  await expect(page.locator('.task', { hasText: 'Call lab partner' })).toContainText('🔔');
  await page.reload(); // the reminder check runs shortly after load, then every minute
  await expect(page.getByText('Reminder: Call lab partner')).toBeVisible({ timeout: 10_000 });
});

test('task timer starts and stops; time spent can be entered', async ({ page }) => {
  await openApp(page);
  await addTask(page, 'Timed worksheet today ~30m');
  const row = page.locator('.task', { hasText: 'Timed worksheet' });
  await row.hover();
  await row.getByRole('button', { name: 'Start timer' }).click();
  await expect(row.getByRole('button', { name: 'Stop timer' })).toHaveAttribute('aria-pressed', 'true');
  await row.getByRole('button', { name: 'Stop timer' }).click();
  await edit(page, 'Timed worksheet');
  await page.getByLabel('Time spent (min)').fill('20');
  await save(page);
  await expect(row).toContainText('20m / 30m');
});

test('saved lists appear in the sidebar', async ({ page }) => {
  await openApp(page);
  await addTask(page, 'Bio exam type:exam in 5 days');
  await addTask(page, 'Random chore');
  await page.keyboard.press('Escape');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('4');
  await page.getByRole('button', { name: /Save as list/ }).click();
  await page.getByRole('button', { name: /Exams in the next 14 days/ }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Exams in the next 14 days/ })).toBeVisible();
  await expect(page.locator('.task', { hasText: 'Bio exam' })).toBeVisible();
  await expect(page.locator('.task', { hasText: 'Random chore' })).toHaveCount(0);
  await page.keyboard.press('1');
  await page
    .locator('.sidebar')
    .getByRole('button', { name: /Exams in the next 14 days/ })
    .click();
  await expect(page.locator('.task', { hasText: 'Bio exam' })).toBeVisible();
});

test('every 2nd Tuesday, and skipping an occurrence', async ({ page }) => {
  await openApp(page);
  await addTask(page, 'Club meeting every 2nd tue');
  await page.keyboard.press('Escape');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('4');
  await edit(page, 'Club meeting');
  await expect(page.getByText('Every 2nd Tuesday')).toBeVisible();
  const before = await page.getByLabel('Due date').inputValue();
  await page.getByRole('button', { name: 'Skip this one' }).click();
  await edit(page, 'Club meeting');
  const after = await page.getByLabel('Due date').inputValue();
  expect(after > before).toBe(true);
  expect(new Date(after + 'T12:00').getDay()).toBe(2);
});
