import { expect, test, type Page } from '@playwright/test';
import { openApp } from './helpers';

const SET = {
  id: 'set1',
  title: 'Cells quiz',
  subject: 'Biology',
  difficulty: 'easy',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  questions: [
    { id: 'q1', type: 'mc', prompt: 'Powerhouse of the cell?', options: ['Nucleus', 'Mitochondria', 'Ribosome'], correct: [1], explanation: 'It makes ATP.' },
    { id: 'q2', type: 'tf', prompt: 'Plant cells have walls.', options: ['True', 'False'], correct: [0] },
    { id: 'q3', type: 'short', prompt: 'Process plants use to make food?', options: [], correct: [], answer: 'photosynthesis' },
  ],
};

async function openPractice(page: Page) {
  await page.keyboard.press('Escape');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('7');
  await page.getByRole('tablist', { name: 'Tool groups' }).getByRole('tab', { name: 'Study' }).click();
  await page
    .getByRole('tablist', { name: 'Tools' })
    .getByRole('tab', { name: /Practice test/ })
    .click();
}

test('practice test: take it, review, count an answer right, missed → notecards, history', async ({ page }) => {
  await page.addInitScript((s) => {
    if (!localStorage.getItem('homework-todo:quizsets')) localStorage.setItem('homework-todo:quizsets', JSON.stringify([s]));
  }, SET);
  await openApp(page);
  await openPractice(page);
  await page.getByRole('button', { name: 'Start' }).click();
  await page
    .getByRole('radiogroup', { name: /Powerhouse/ })
    .getByLabel('Nucleus')
    .check();
  await page.getByRole('radiogroup', { name: /walls/ }).getByLabel('True').check();
  await page.getByLabel('Answer to question 3').fill('making food from light');
  await page.getByRole('button', { name: 'Hand it in' }).click();
  await expect(page.locator('.result')).toContainText('33.3%');
  await expect(page.getByText('It makes ATP.')).toBeVisible();
  await page.getByRole('button', { name: /count it right/ }).click();
  await expect(page.locator('.result')).toContainText('66.7%');
  await page.getByRole('button', { name: /Missed → notecards/ }).click();
  await expect(page.getByText('Added 1 notecard to “Cells quiz — missed”')).toBeVisible();
  // retake: all right this time; the history shows both attempts
  await page.getByRole('button', { name: 'Retake', exact: true }).click();
  await page
    .getByRole('radiogroup', { name: /Powerhouse/ })
    .getByLabel('Mitochondria')
    .check();
  await page.getByRole('radiogroup', { name: /walls/ }).getByLabel('True').check();
  await page.getByLabel('Answer to question 3').fill('Photosynthesis');
  await page.getByRole('button', { name: 'Hand it in' }).click();
  await expect(page.locator('.result')).toContainText('100%');
  await expect(page.getByRole('figure', { name: /Scores over your last 2 attempts/ })).toBeVisible();
  await page.getByRole('button', { name: 'All tests' }).click();
  await expect(page.getByText('last 100% · best 100%')).toBeVisible();
});

test('explain my mistake with AI, save it as a notecard, and see it in the usage meter', async ({ page }) => {
  await page.addInitScript((s) => {
    if (!localStorage.getItem('homework-todo:quizsets')) localStorage.setItem('homework-todo:quizsets', JSON.stringify([s]));
  }, SET);
  await page.route('https://api.groq.com/openai/v1/chat/completions', (r) =>
    r.fulfill({
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ choices: [{ message: { content: 'The **nucleus** stores DNA; the mitochondria make ATP.' } }] }),
    }),
  );
  await openApp(page, { aiProvider: 'groq', aiKeys: { groq: 'gsk_test' } });
  await openPractice(page);
  await page.getByRole('button', { name: 'Start' }).click();
  await page
    .getByRole('radiogroup', { name: /Powerhouse/ })
    .getByLabel('Nucleus')
    .check();
  await page.getByRole('radiogroup', { name: /walls/ }).getByLabel('True').check();
  await page.getByLabel('Answer to question 3').fill('photosynthesis');
  await page.getByRole('button', { name: 'Hand it in' }).click();
  await page.getByRole('button', { name: /Explain my mistake/ }).click();
  await expect(page.locator('.why')).toContainText('the mitochondria make ATP');
  await page.getByRole('button', { name: /Save as a notecard/ }).click();
  await expect(page.getByText('Saved to “Cells quiz — missed”')).toBeVisible();
  await page
    .getByRole('button', { name: /Settings/ })
    .first()
    .click();
  await expect(page.locator('.usage')).toContainText('groq');
  await page.getByLabel('Monthly AI request limit').fill('1');
  await page.getByLabel('Monthly AI request limit').press('Tab');
  await expect(page.locator('.usage')).toContainText('1 of 1 requests used');
});
