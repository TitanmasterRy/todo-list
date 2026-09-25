import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

async function openTool(page: import('@playwright/test').Page, group: string, name: RegExp) {
  await page.keyboard.press('Escape');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('7');
  await page.getByRole('tablist', { name: 'Tool groups' }).getByRole('tab', { name: group }).click();
  await page.getByRole('tablist', { name: 'Tools' }).getByRole('tab', { name }).click();
}

test('essay tools count words and flag fillers', async ({ page }) => {
  await openApp(page);
  await openTool(page, 'Study', /Essay tools/);
  await page.getByLabel('Essay text').fill('The mitochondria is really the powerhouse of the cell. It is very very important.');
  await expect(page.locator('.stats')).toContainText('14');
  await expect(page.locator('.flags p', { hasText: 'Filler words' })).toContainText('very ×2');
});

test('unit converter', async ({ page }) => {
  await openApp(page);
  await openTool(page, 'Compute', /Unit converter/);
  await page.getByRole('tab', { name: 'Temperature' }).click();
  await page.getByLabel('Value').fill('100');
  await expect(page.locator('.result')).toContainText('212');
});

test('citation lookup by DOI and a works-cited list', async ({ page }) => {
  await page.route('https://api.crossref.org/**', (route) =>
    route.fulfill({
      json: {
        message: {
          type: 'journal-article',
          title: ['Cells and Stuff'],
          author: [{ given: 'Jane', family: 'Doe' }],
          'container-title': ['Journal of Biology'],
          issued: { 'date-parts': [[2020]] },
          volume: '12',
          issue: '3',
          page: '45-67',
          DOI: '10.1234/jb',
        },
      },
    }),
  );
  await openApp(page);
  await openTool(page, 'Study', /Citations/);
  await page.getByLabel('DOI, ISBN or URL').fill('10.1234/jb');
  await page.getByRole('button', { name: 'Look up' }).click();
  await expect(page.locator('.preview')).toContainText('Doe, Jane. “Cells and Stuff.” Journal of Biology, vol. 12, no. 3, 2020, pp. 45–67.');
  await page.getByRole('button', { name: 'Add to list' }).click();
  await page.getByRole('radio', { name: 'APA 7' }).click();
  await expect(page.locator('.cites')).toContainText('Doe, J. (2020). Cells and Stuff. Journal of Biology, 12(3), 45–67.');
});
