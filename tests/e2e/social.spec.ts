import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { addTask, openApp } from './helpers';

async function goKey(page: Page, key: string) {
  await page.keyboard.press('Escape');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press(key);
}
const seconds = (mmss: string) => mmss.split(':').reduce((a, p) => a * 60 + Number(p), 0);

test('study room: a second device opening the link sees the same phase and time left', async ({ page, browser }) => {
  const errors = await openApp(page);
  await goKey(page, '5');
  await page.getByRole('button', { name: '👥 Study room' }).click();
  const create = page.getByRole('form', { name: 'Create a study room' });
  await create.getByLabel('Room name').fill('Bio crew');
  await create.getByLabel('Focus (min)').fill('30');
  await create.getByRole('button', { name: 'Create room' }).click();
  const room = page.getByRole('region', { name: 'Study room' });
  await expect(room.locator('[data-phase="work"]')).toContainText('Bio crew');
  const link = await room.getByLabel('Room link').inputValue();
  expect(link).toMatch(/#room=[\w-]+$/);

  // another device: a fresh browser profile that opens the link
  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  const otherErrors = await openApp(other);
  await other.goto(link);
  const room2 = other.getByRole('region', { name: 'Study room' });
  await expect(room2.locator('.live')).toContainText('Bio crew');
  await expect(other.getByRole('heading', { name: 'Focus', exact: true })).toBeVisible();
  await expect(other).not.toHaveURL(/#room=/); // the code is taken out of the address bar

  const [a, b] = await Promise.all(
    [room.locator('.live'), room2.locator('.live')].map(async (l) => ({
      phase: await l.getAttribute('data-phase'),
      ends: Number(await l.getAttribute('data-ends-at')),
      left: seconds((await l.getByLabel('Time left').textContent()) ?? ''),
    })),
  );
  expect(b.phase).toBe('work');
  expect(b.phase).toBe(a.phase);
  expect(Math.abs(a.ends - b.ends)).toBeLessThanOrEqual(1000);
  expect(Math.abs(a.left - b.left)).toBeLessThanOrEqual(1);
  expect(b.left).toBeGreaterThan(29 * 60);
  await expect(room2).toContainText('round 1');

  // it survives a reload, and leaving forgets it
  await other.reload();
  await goKey(other, '5');
  await expect(other.getByRole('region', { name: 'Study room' }).locator('.live')).toContainText('Bio crew');
  await other.getByRole('button', { name: 'Leave room' }).click();
  await expect(other.getByRole('region', { name: 'Study room' })).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(otherErrors).toEqual([]);
  await ctx.close();
});

test('friends: a friend code round-trip adds them to the leaderboard', async ({ page, browser }) => {
  const errors = await openApp(page);
  await addTask(page, 'Warm-up task');
  await page.locator('.task', { hasText: 'Warm-up task' }).getByRole('checkbox').first().click();
  await goKey(page, '6');
  const friendsA = page.getByRole('region', { name: 'Friends' });
  await friendsA.getByLabel('Your name').fill('Ana');
  await friendsA.getByLabel('Your name').press('Tab');
  await friendsA.getByLabel('Your emoji').fill('🦊');
  await friendsA.getByLabel('Your emoji').press('Tab');
  const code = await friendsA.getByLabel('My friend code').inputValue();
  expect(code).toMatch(/^HWF1\.[\w-]+$/);

  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  const otherErrors = await openApp(other);
  await goKey(other, '6');
  const friendsB = other.getByRole('region', { name: 'Friends' });
  await friendsB.getByLabel("Paste a friend's code").fill(code);
  await friendsB.getByRole('button', { name: 'Add friend' }).click();
  const board = friendsB.getByRole('table', { name: 'Friends leaderboard' });
  const ana = board.getByRole('row').filter({ hasText: 'Ana' });
  await expect(ana).toContainText('🦊 Ana');
  await expect(ana).toContainText('just now');
  // Ana finished a task this week, so she's first
  await expect(board.getByRole('row').nth(1)).toContainText('Ana');
  await expect(board.getByRole('row').nth(2)).toContainText('(you)');
  // the same code again is an update, not a second row; your own code is refused
  await friendsB.getByLabel("Paste a friend's code").fill(code);
  await friendsB.getByRole('button', { name: 'Add friend' }).click();
  await expect(board.getByRole('row').filter({ hasText: 'Ana' })).toHaveCount(1);
  await friendsB.getByLabel("Paste a friend's code").fill(await friendsB.getByLabel('My friend code').inputValue());
  await friendsB.getByRole('button', { name: 'Add friend' }).click();
  await expect(other.getByText("That's your own code")).toBeVisible();

  // a friend link opens Stats and adds them too
  const ctx3 = await browser.newContext();
  const third = await ctx3.newPage();
  await openApp(third);
  await third.goto(`./#friend=${code}`);
  await expect(third.getByRole('table', { name: 'Friends leaderboard' })).toContainText('🦊 Ana');
  expect(errors).toEqual([]);
  expect(otherErrors).toEqual([]);
  await ctx.close();
  await ctx3.close();
});

test('class mode: publish a class list as a file, then a student subscribes to its link', async ({ page, browser }) => {
  const errors = await openApp(page, { autoDescribe: false });
  await goKey(page, '3');
  await page.getByRole('button', { name: '+ New course' }).click();
  await page.getByRole('form', { name: 'New course' }).getByLabel('Name', { exact: true }).fill('Biology');
  await page.getByRole('form', { name: 'New course' }).getByLabel('Name', { exact: true }).press('Enter');
  await goKey(page, '4');
  await addTask(page, 'Lab report #biology tomorrow');
  await addTask(page, 'Cell quiz #biology tomorrow');
  await goKey(page, '7');
  await page.getByRole('tablist', { name: 'Tool groups' }).getByRole('tab', { name: 'Connect' }).click();
  await page
    .getByRole('tablist', { name: 'Tools' })
    .getByRole('tab', { name: /Class mode/ })
    .click();
  const publish = page.getByRole('region', { name: 'Publish a class list' });
  await publish.getByLabel('Teacher name (optional)').fill('Ms. Rivera');
  await expect(publish).toContainText('2 assignments will be published.');
  const [dl] = await Promise.all([page.waitForEvent('download'), publish.getByRole('button', { name: 'Download class list (.json)' }).click()]);
  expect(dl.suggestedFilename()).toBe('biology-class-list.json');
  const json = readFileSync((await dl.path())!, 'utf8');
  const list = JSON.parse(json) as { hwtodoClass: number; course: string; teacher: string; items: { title: string; due: string }[] };
  expect(list).toMatchObject({ hwtodoClass: 1, course: 'Biology', teacher: 'Ms. Rivera' });
  expect(list.items.map((i) => i.title).sort()).toEqual(['Cell quiz', 'Lab report']);
  expect(json).not.toMatch(/score|priority|completed|order/);

  // a student in a fresh browser: the teacher hosts the file as a gist (mocked here) and shares the app link
  const raw = 'https://gist.githubusercontent.com/msrivera/0123456789abcdef0123/raw/homework-todo-class.json';
  let body = json;
  const ctx = await browser.newContext();
  const student = await ctx.newPage();
  await student.route(raw, (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body }));
  const studentErrors = await openApp(student, { autoDescribe: false });
  await student.goto(`./#class=${encodeURIComponent(raw)}`);
  const sub = student.getByRole('region', { name: 'Subscribe to a class' });
  await expect(sub).toContainText('Someone shared a class list with you');
  await expect(sub.getByLabel('Class list link')).toHaveValue(raw);
  await sub.getByRole('button', { name: 'Subscribe' }).click();
  await expect(student.getByText('2 new assignments from Biology')).toBeVisible();
  const subs = sub.getByRole('list', { name: 'Class subscriptions' });
  await expect(subs).toContainText('Biology');
  await expect(subs).toContainText('Ms. Rivera');

  // the teacher adds an assignment and re-publishes: Refresh brings it in, without duplicates
  const next = JSON.parse(json) as { items: unknown[] };
  next.items.push({ id: 't_new', title: 'Unit test', due: list.items[0].due, type: 'exam' });
  body = JSON.stringify(next);
  await subs.getByRole('button', { name: 'Refresh' }).click();
  await expect(student.getByText('1 new assignment from Biology')).toBeVisible();
  await subs.getByRole('button', { name: 'Open course' }).click();
  await expect(student.getByRole('heading', { name: /Biology/ })).toBeVisible();
  for (const title of ['Lab report', 'Cell quiz', 'Unit test']) await expect(student.locator('.task', { hasText: title })).toHaveCount(1);

  // hostile content is refused
  body = '<!doctype html><script>alert(1)</script>';
  await goKey(student, '7');
  await student.getByRole('region', { name: 'Subscribe to a class' }).getByRole('button', { name: 'Refresh' }).click();
  await expect(student.getByRole('region', { name: 'Subscribe to a class' })).toContainText('not a class list');
  expect(errors).toEqual([]);
  expect(studentErrors).toEqual([]);
  await ctx.close();
});
