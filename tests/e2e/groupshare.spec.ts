import { expect, test } from '@playwright/test';
import { addTask, openApp } from './helpers';

test('share tasks by link for a group project; a friend adds their own copy', async ({ page, browser, baseURL }) => {
  const errors = await openApp(page);
  await addTask(page, 'Lab report friday');
  await addTask(page, 'Poster draft thursday');
  await addTask(page, 'My private thing');
  await page.goto('./?view=inbox');
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  for (const title of ['Lab report', 'Poster draft']) await page.locator('.task', { hasText: title }).getByLabel('Select task').check();
  await page.getByRole('button', { name: '🔗 Share' }).click();
  const dialog = page.getByRole('dialog', { name: /Share tasks by link/ });
  await expect(dialog).toContainText('2 tasks');
  await dialog.getByLabel('List name (optional)').fill('Bio group');
  const link = await dialog.getByLabel('Copy link').inputValue();
  expect(link).toContain('#tasks=');
  expect(link).not.toContain('private');

  // a friend with their own (empty) app
  const ctx = await browser.newContext({ baseURL });
  const friend = await ctx.newPage();
  await friend.addInitScript(() => localStorage.setItem('homework-todo:settings', JSON.stringify({ onboarded: true, soundPromptShown: true })));
  await friend.goto(link.replace(/^https?:\/\/[^/]+\//, './'));
  const recv = friend.getByRole('dialog', { name: 'Bio group' });
  await expect(recv).toContainText('Lab report');
  await expect(recv).toContainText('Poster draft');
  await recv.getByRole('button', { name: 'Add 2 tasks' }).click();
  await expect(friend.locator('.toast', { hasText: 'Added 2 shared tasks' })).toBeVisible();
  expect(friend.url()).not.toContain('tasks=');
  await friend.goto('./?view=upcoming');
  await expect(friend.locator('.task', { hasText: 'Lab report' })).toBeVisible();
  // opening it again marks them as already added
  await friend.goto(link.replace(/^https?:\/\/[^/]+\//, './'));
  await expect(friend.getByRole('dialog', { name: 'Bio group' })).toContainText('already on your list');
  await ctx.close();
  expect(errors).toEqual([]);
});
