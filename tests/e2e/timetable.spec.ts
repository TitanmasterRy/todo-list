import { expect, test, type Page } from '@playwright/test';
import { addTask, openApp } from './helpers';

async function goKey(page: Page, key: string) {
  await page.keyboard.press('Escape');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press(key);
}

test('timetable: A/B classes, what’s on now, and due next class', async ({ page }) => {
  // Monday 5 Oct 2026, 8:20 am: first period of an A day
  await page.clock.setFixedTime(new Date(2026, 9, 5, 8, 20));
  await openApp(page, { autoDescribe: false });
  await goKey(page, '3');
  await page.getByRole('button', { name: '+ New course' }).click();
  await page.getByRole('form', { name: 'New course' }).getByLabel('Name', { exact: true }).fill('Chemistry');
  await page.getByRole('form', { name: 'New course' }).getByLabel('Name', { exact: true }).press('Enter');

  await goKey(page, '7');
  await page.getByRole('tablist', { name: 'Tool groups' }).getByRole('tab', { name: 'Plan' }).click();
  await page
    .getByRole('tablist', { name: 'Tools' })
    .getByRole('tab', { name: /Timetable/ })
    .click();
  await page.getByLabel('Rotation', { exact: true }).selectOption({ label: 'A / B days' });
  await expect(page.getByText('Today is A day.')).toBeVisible();
  await page.getByRole('button', { name: '+ Class' }).click();
  await page.getByRole('group', { name: 'Rotation days' }).getByRole('button', { name: 'A', exact: true }).click();
  await page.getByLabel('Room').fill('204');
  await page.getByRole('radio', { name: 'Week' }).click();
  const monday = page.getByLabel('Monday Oct 5');
  await expect(monday).toContainText('Chemistry');
  await expect(monday).toContainText('204');
  await expect(page.getByLabel('Tuesday Oct 6')).not.toContainText('Chemistry');
  await page.waitForTimeout(600); // debounced save

  await goKey(page, '1');
  const now = page.getByRole('region', { name: 'School schedule now' });
  await expect(now).toContainText('A day');
  await expect(now).toContainText('Chemistry');
  await expect(now).toContainText('30 min left');
  await expect(now).toContainText('Next');

  // it's saved: still there after a reload
  await page.reload();
  await expect(page.getByRole('region', { name: 'School schedule now' })).toContainText('Chemistry');

  await addTask(page, 'Lab writeup');
  await page.locator('.task', { hasText: 'Lab writeup' }).getByRole('button', { name: 'Lab writeup', exact: true }).click();
  const ed = page.getByRole('form', { name: 'Edit task' });
  await ed.getByLabel('Course').selectOption({ label: 'Chemistry' });
  await ed.getByRole('button', { name: /Next class: Wed/ }).click();
  await expect(ed.getByLabel('Due date')).toHaveValue('2026-10-07');
  await expect(ed.getByLabel('Time', { exact: true })).toHaveValue('08:00');
  await page.getByRole('button', { name: 'Cancel' }).click();

  // attendance: mark absent on Today, add the catch-up task, see it in the Attendance tab
  await page
    .getByRole('group', { name: 'Attendance for this class' })
    .getByRole('button', { name: /Absent/ })
    .click();
  await expect(page.getByText('Marked absent from Chemistry')).toBeVisible();
  await page.getByRole('button', { name: 'Add catch-up task' }).click();
  await goKey(page, '4'); // due at the next class (Wednesday), so it's in the Inbox rather than Today
  await expect(page.getByRole('group', { name: /Catch up on missed Chemistry/ })).toBeVisible();
  await goKey(page, '7');
  await page
    .getByRole('tablist', { name: 'Tools' })
    .getByRole('tab', { name: /Timetable/ })
    .click();
  await page.getByRole('radio', { name: 'Attendance' }).click();
  await expect(page.locator('.att-sum')).toContainText('Chemistry');
  await expect(page.locator('.att-sum')).toContainText('0%');
  await page
    .getByRole('group', { name: 'Attendance for Chemistry on Oct 5' })
    .getByRole('button', { name: /Present/ })
    .click();
  await expect(page.locator('.att-sum')).toContainText('100%');
});
