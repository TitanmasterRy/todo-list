import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import initSqlJs from 'sql.js';
import { zipSync } from 'fflate';
import { openApp } from './helpers';

async function openNotecards(page: Page) {
  await page.keyboard.press('Escape');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('7');
  await page.getByRole('tablist', { name: 'Tool groups' }).getByRole('tab', { name: 'Study' }).click();
  await page
    .getByRole('tablist', { name: 'Tools' })
    .getByRole('tab', { name: /Notecards/ })
    .click();
}

test('study with Again/Hard/Good/Easy, cloze cards, Anki export', async ({ page }, info) => {
  await openApp(page);
  await openNotecards(page);
  await page.getByLabel('Deck name').fill('Biology');
  await page.getByLabel('Deck name').press('Enter');
  await page.getByLabel('Front', { exact: true }).fill('ATP');
  await page.getByLabel('Back', { exact: true }).fill('Energy currency');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByText('Fill in the blank').click();
  await page.getByPlaceholder(/mitochondria/).fill('The {{c1::nucleus}} holds {{c2::DNA}}.');
  await page.getByRole('button', { name: 'Add blanks' }).click();
  await expect(page.locator('.cards li')).toHaveCount(3);

  await page.getByRole('button', { name: /Study 3 due/ }).click();
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press(' ');
    await expect(page.getByRole('button', { name: /Good/ })).toBeEnabled();
    await expect(page.getByRole('button', { name: /Easy/ })).toContainText(/\dd/);
    await page.keyboard.press(i === 0 ? '4' : '3');
  }
  await expect(page.getByText(/Every due card cleared|Missed cards/)).toBeVisible();

  await page.getByRole('button', { name: 'Back to deck' }).click();
  await page.getByText('Anki', { exact: true }).click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export for Anki' }).click()]);
  const txt = readFileSync(await dl.path(), 'utf8');
  expect(txt).toContain('#deck:Biology');
  expect(txt).toContain('ATP\tEnergy currency');
  writeFileSync(info.outputPath('anki.txt'), txt);
});

test('imports an .apkg deck', async ({ page }, info) => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run('CREATE TABLE col (models TEXT, decks TEXT)');
  db.run('CREATE TABLE notes (id INTEGER, mid INTEGER, flds TEXT)');
  db.run('CREATE TABLE cards (id INTEGER, nid INTEGER, did INTEGER)');
  db.run('INSERT INTO col VALUES (?, ?)', [JSON.stringify({ 1: { type: 0 } }), JSON.stringify({ 5: { name: 'Spanish' } })]);
  db.run('INSERT INTO notes VALUES (1, 1, ?)', ['hola\x1fhello']);
  db.run('INSERT INTO notes VALUES (2, 1, ?)', ['gato\x1fcat']);
  db.run('INSERT INTO cards VALUES (1, 1, 5)');
  db.run('INSERT INTO cards VALUES (2, 2, 5)');
  const file = info.outputPath('spanish.apkg');
  writeFileSync(file, zipSync({ 'collection.anki2': db.export(), media: new TextEncoder().encode('{}') }));

  await openApp(page);
  await openNotecards(page);
  await page.getByLabel('Deck name').fill('Temp');
  await page.getByLabel('Deck name').press('Enter');
  await page.getByText('Anki', { exact: true }).click();
  await page.locator('input[aria-label="Anki file"]').setInputFiles(file);
  await expect(page.getByText('Imported 2 cards')).toBeVisible();
  await expect(page.locator('.cards li')).toHaveCount(2);
  await expect(page.locator('.cards')).toContainText('gato');
});
