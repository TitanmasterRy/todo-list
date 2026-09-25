import { expect, test, type Page } from '@playwright/test';
import { openApp, seedCompletions, seedDeck } from './helpers';

const SPANISH: [string, string][] = [
  ['cat', 'gato'],
  ['dog', 'perro'],
  ['cow', 'vaca'],
  ['hen', 'gallina'],
  ['pig', 'cerdo'],
  ['owl', 'búho'],
];
const answerOf = (front: string) => SPANISH.find(([f]) => f === front)![1];
const letters = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '');

async function openStudyGame(page: Page, game: RegExp, deck: string) {
  await page.goto('./?view=play');
  await page.getByRole('tab', { name: /Study games/ }).click();
  await page.getByRole('button', { name: game }).click();
  await page.getByRole('button', { name: new RegExp(deck) }).click();
}

/** The clues on screen: number, direction and clue text (the letter count stripped). */
const readClues = (page: Page) =>
  page.locator('.clue').evaluateAll((els) =>
    els.map((el) => ({
      num: el.querySelector('.cn')!.textContent!.trim(),
      dir: el.closest('section')!.querySelector('h3')!.textContent!.trim().toLowerCase(),
      clue: el
        .querySelector('.ct')!
        .textContent!.replace(/\(\d+\)\s*$/, '')
        .trim(),
    })),
  );

/** Pick a clue, put the cursor on its first square and type the answer. */
async function answer(page: Page, c: { num: string; dir: string; clue: string }, text: string) {
  await page.locator('.clue', { hasText: c.clue }).click();
  await page.getByRole('textbox', { name: new RegExp(`(^|; )${c.num} ${c.dir}, letter 1 of`) }).focus();
  await page.keyboard.type(text);
}

test('crossword: typing an answer marks its clue, solving it all keeps a best time', async ({ page }) => {
  const errors = await openApp(page);
  await seedDeck(page, 'Spanish animals', SPANISH);
  await seedDeck(page, 'Tiny', [
    ['one', 'uno'],
    ['two', 'dos'],
  ]);
  await page.goto('./?view=play');
  await page.getByRole('tab', { name: /Study games/ }).click();
  await page.getByRole('button', { name: /Crossword/ }).click();
  await expect(page.getByRole('button', { name: /Tiny/ })).toBeDisabled();
  await expect(page.getByText(/Needs at least 5 cards with a short answer/)).toBeVisible();
  await page.getByRole('button', { name: /Spanish animals/ }).click();

  await expect(page.getByRole('group', { name: 'Crossword grid' })).toBeVisible();
  const clues = await readClues(page);
  expect(clues.length).toBeGreaterThanOrEqual(3);

  // a wrong letter shows up on Check, then the right answer marks the clue solved
  const [first, ...rest] = clues;
  await answer(page, first, 'q');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.status')).toContainText('1 wrong letter');
  await expect(page.locator('.sq.wrong')).toHaveCount(1);
  await answer(page, first, letters(answerOf(first.clue)));
  await expect(page.locator('.clue', { hasText: first.clue })).toHaveClass(/solved/);
  await expect(page.locator('.sq.wrong')).toHaveCount(0);
  await expect(page.getByText(`1/${clues.length} words`)).toBeVisible();
  // the current clue follows the cursor
  await expect(page.locator('#cw-clue')).toContainText(first.clue);

  // Backspace clears, arrows move
  const firstBox = page.getByRole('textbox', { name: new RegExp(`(^|; )${first.num} ${first.dir}, letter 1 of`) });
  await firstBox.focus();
  await page.keyboard.press('Backspace');
  await expect(firstBox).toHaveValue('');
  await expect(page.locator('.clue', { hasText: first.clue })).not.toHaveClass(/solved/);
  await page.keyboard.type(letters(answerOf(first.clue))[0]);

  for (const c of rest) await answer(page, c, letters(answerOf(c.clue)));
  await expect(page.getByText(/Solved in \d+:\d\d\.\d/)).toBeVisible();
  await expect(page.getByText('New best for this deck!')).toBeVisible();
  await page.getByRole('button', { name: 'Pick another deck' }).click();
  await expect(page.getByRole('button', { name: /Spanish animals/ })).toContainText('best');
  expect(errors).toEqual([]);
});

test('crossword: reveal all ends the puzzle without a best time', async ({ page }) => {
  const errors = await openApp(page);
  await seedDeck(page, 'Spanish animals', SPANISH);
  await openStudyGame(page, /Crossword/, 'Spanish animals');
  await page.locator('.sq input').first().focus();
  await page.getByRole('button', { name: 'Reveal letter' }).click();
  await expect(page.locator('.sq.shown')).toHaveCount(1);
  await page.getByRole('button', { name: 'Reveal all' }).click();
  await expect(page.getByText('All answers revealed')).toBeVisible();
  await page.getByRole('button', { name: 'Pick another deck' }).click();
  await expect(page.getByRole('button', { name: /Spanish animals/ })).not.toContainText('best');
  expect(errors).toEqual([]);
});

test('quiz race: the first run saves a ghost, the next run races it', async ({ page }) => {
  const errors = await openApp(page);
  await seedDeck(page, 'Spanish animals', SPANISH);
  await openStudyGame(page, /Quiz race/, 'Spanish animals');
  await expect(page.getByText('No ghost yet')).toBeVisible();
  const you = page.getByRole('progressbar', { name: 'You' });
  for (let i = 0; i < SPANISH.length; i++) {
    await expect(page.getByText(`Question ${i + 1}/${SPANISH.length}`)).toBeVisible();
    const q = (await page.locator('[data-question]').textContent())!.trim();
    await page.locator('.choice', { hasText: answerOf(q) }).click();
    await expect(you).toHaveAttribute('aria-valuenow', String(i + 1));
  }
  await expect(page.getByText('First run done: your ghost is saved')).toBeVisible();
  const ghosts = await page.evaluate(() => JSON.parse(localStorage.getItem('homework-todo:race-ghosts') ?? '{}'));
  expect(ghosts['deck:deck-Spanish-animals']).toMatchObject({ n: 6 });
  expect(ghosts['deck:deck-Spanish-animals'].hits).toHaveLength(6);

  // second run: the ghost lane is there and moves on its own; answering wrong can't beat it
  await page.getByRole('button', { name: 'Race again' }).click();
  const ghost = page.getByRole('progressbar', { name: 'Ghost' });
  await expect(ghost).toBeVisible();
  await expect(ghost).not.toHaveAttribute('aria-valuenow', '0', { timeout: 10_000 });
  for (let i = 0; i < SPANISH.length; i++) {
    await expect(page.getByText(`Question ${i + 1}/${SPANISH.length}`)).toBeVisible();
    const q = (await page.locator('[data-question]').textContent())!.trim();
    const texts = await page.locator('.choice .ct').allTextContents();
    await page.keyboard.press(String(texts.findIndex((t) => t.trim() !== answerOf(q)) + 1));
    await expect(page.locator('.feedback')).toContainText('It was');
  }
  await expect(page.getByText('Your ghost wins this time')).toBeVisible();
  await page.getByRole('button', { name: 'Pick another deck' }).click();
  await expect(page.getByRole('button', { name: /Spanish animals/ })).toContainText('👻 6/6');
  expect(errors).toEqual([]);
});

test('star map: days with finished tasks light stars, days in a row are joined', async ({ page }) => {
  const errors = await openApp(page);
  const key = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const year = key(0).slice(0, 4);
  const days = Object.fromEntries(
    [
      [0, 2],
      [1, 1],
      [2, 4],
      [6, 1],
    ].map(([ago, n]) => [key(ago), n]),
  );
  await seedCompletions(page, days);
  await page.goto('./?view=play');
  await page.getByRole('tab', { name: /Star map/ }).click();
  await page.getByRole('button', { name: 'Year' }).click();
  // early January pushes some of these into last year's sky
  const inYear = Object.keys(days).filter((k) => k.startsWith(year));
  await expect(page.locator('.star')).toHaveCount(inYear.length);
  await expect(page.locator('[data-summary]')).toContainText(`${inYear.length} star`);
  await expect(page.locator(`[data-day="${key(0)}"]`)).toHaveAttribute('aria-label', /2 tasks done/);
  const joined = [1, 2].filter((ago) => key(ago).startsWith(year)).length;
  await expect(page.locator('.link')).toHaveCount(joined);

  // one tab stop on the newest star; arrows walk the lit days
  const stop = page.locator('.star[tabindex="0"]');
  await expect(stop).toHaveCount(1);
  await expect(stop).toHaveAttribute('data-day', key(0));
  await stop.focus();
  await expect(page.locator('.info')).toContainText('2 tasks done');
  await page.keyboard.press('Home');
  await expect(page.locator('.star:focus')).toHaveAttribute('data-day', inYear.sort()[0]);

  await page.getByText('Show as a table').click();
  await expect(page.getByRole('table')).toBeVisible();
  await page.getByRole('button', { name: 'Previous' }).click();
  await expect(page.locator('[data-summary]')).toContainText(`No stars in ${Number(year) - 1}`);
  expect(errors).toEqual([]);
});
