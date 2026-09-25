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
