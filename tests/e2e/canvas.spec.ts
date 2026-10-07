import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

const FEED_URL = 'https://myschool.instructure.com/feeds/calendars/user_AbC123.ics';
const FEED = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:event-assignment-5678',
  'DTSTART;VALUE=DATE:20991009',
  'SUMMARY:Essay 1 [ENGL 101 - Fall 2026]',
  'URL;VALUE=URI:https://myschool.instructure.com/courses/1234/assignments/5678',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:event-assignment-9012',
  'DTSTART;VALUE=DATE:20991014',
  'SUMMARY:Unit 2 Quiz [BIO 110]',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

test('Canvas feed: connect, sync assignments into courses, link back', async ({ page }) => {
  await page.route(FEED_URL, (r) => r.fulfill({ status: 200, contentType: 'text/calendar', body: FEED, headers: { 'Access-Control-Allow-Origin': '*' } }));
  await openApp(page, { autoDescribe: false });
  await page.keyboard.press('Escape');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('7');
  await page.getByRole('tablist', { name: 'Tool groups' }).getByRole('tab', { name: 'Connect' }).click();
  await page
    .getByRole('tablist', { name: 'Tools' })
    .getByRole('tab', { name: /Canvas/ })
    .click();
  await page.getByLabel('Canvas feed link').fill('https://myschool.instructure.com/courses/1');
  await expect(page.getByText(/doesn’t look like a Canvas calendar feed/)).toBeVisible();
  await page.getByLabel('Canvas feed link').fill(FEED_URL);
  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(page.getByText('Canvas: 2 new, 0 updated')).toBeVisible();
  await expect(page.getByText('2 tasks from Canvas')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('4');
  const essay = page.getByRole('group', { name: 'Essay 1' });
  await expect(essay).toContainText('ENGL 101');
  await expect(essay.getByRole('link', { name: /Canvas/ })).toHaveAttribute('href', 'https://myschool.instructure.com/courses/1234/assignments/5678');
  await expect(page.getByRole('group', { name: 'Unit 2 Quiz' })).toContainText('BIO 110');
});

test('a feed’s long-past assignments arrive done, so Today and Focus only offer current work', async ({ page }) => {
  const day = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  };
  const feed = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'UID:event-assignment-1',
    `DTSTART;VALUE=DATE:${day(-60)}`,
    'SUMMARY:Old worksheet [MATH 101]',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:event-assignment-2',
    `DTSTART;VALUE=DATE:${day(0)}`,
    'SUMMARY:Lab write-up [MATH 101]',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  await page.route(FEED_URL, (r) => r.fulfill({ status: 200, contentType: 'text/calendar', body: feed, headers: { 'Access-Control-Allow-Origin': '*' } }));
  const errors = await openApp(page, { autoDescribe: false });
  await page.goto('./?view=tools');
  await page.getByRole('tablist', { name: 'Tool groups' }).getByRole('tab', { name: 'Connect' }).click();
  await page
    .getByRole('tablist', { name: 'Tools' })
    .getByRole('tab', { name: /Canvas/ })
    .click();
  await page.getByLabel('Canvas feed link').fill(FEED_URL);
  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(page.getByText('Canvas: 2 new, 0 updated')).toBeVisible();

  await page.goto('./');
  await expect(page.locator('.task', { hasText: 'Lab write-up' })).toBeVisible();
  await expect(page.locator('.task', { hasText: 'Old worksheet' })).toHaveCount(0);
  await page.goto('./?view=focus');
  const picker = page.locator('.picker');
  await expect(picker).toContainText('Lab write-up');
  await expect(picker).not.toContainText('Old worksheet');
  expect(errors).toEqual([]);
});
