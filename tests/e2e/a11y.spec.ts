import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { addTask, openApp } from './helpers';

const VIEWS: [string, string][] = [
  ['Today', '1'],
  ['Upcoming', '2'],
  ['Courses', '3'],
  ['Inbox', '4'],
  ['Focus', '5'],
  ['Stats', '6'],
  ['Tools', '7'],
  ['Schoology', '8'],
  ['Play', '9'],
];

for (const [name, key] of VIEWS) {
  test(`${name} has no serious accessibility violations`, async ({ page }) => {
    await openApp(page);
    await addTask(page, 'Accessibility check task');
    await page.keyboard.press('Escape');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press(key);
    await page.waitForTimeout(600);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
  });
}

test('Settings has no serious accessibility violations', async ({ page }) => {
  await openApp(page);
  await page
    .getByRole('button', { name: /Settings/ })
    .first()
    .click();
  await page.waitForTimeout(600);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
});

test.describe('dark mode', () => {
  test.use({ colorScheme: 'dark' });
  for (const [name, key] of [
    ['Today', '1'],
    ['Stats', '6'],
    ['Play', '9'],
  ] as const) {
    test(`${name} (dark) has no serious accessibility violations`, async ({ page }) => {
      await openApp(page);
      await addTask(page, 'Dark mode check');
      await page.keyboard.press('Escape');
      await page.locator('body').click({ position: { x: 5, y: 5 } });
      await page.keyboard.press(key);
      await page.waitForTimeout(600);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(serious.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
    });
  }
});
