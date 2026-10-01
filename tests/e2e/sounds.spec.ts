import { expect, test } from '@playwright/test';
import { addTask, openApp } from './helpers';

async function openSettings(page: import('@playwright/test').Page) {
  await page.goto('./?view=settings');
  await expect(page.locator('.shell')).toBeVisible();
}

test('sound settings: switch, volume, seven packs, categories, chime and the try-it board', async ({ page }) => {
  const errors = await openApp(page);
  await openSettings(page);
  const section = page.locator('section', { has: page.getByRole('heading', { name: 'Sounds', exact: true }) });
  await section.getByLabel('Sounds', { exact: true }).check();
  await expect(section.getByRole('radio')).toHaveCount(7);
  await section.getByRole('radio', { name: /chime/ }).click();
  await expect(section.getByRole('radio', { name: /chime/ })).toHaveAttribute('aria-checked', 'true');
  await section.getByLabel('Volume').fill('35');
  await expect(section).toContainText('35%');
  await section.getByLabel('When the timer ends').selectOption('gong');
  await section.getByRole('button', { name: 'Try them' }).click();
  for (const name of ['Complete', 'Coins', 'Level up', 'Timer end']) await section.getByRole('button', { name, exact: true }).click();
  await section.getByLabel(/Rewards/).uncheck();
  // it all landed in the saved settings
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('homework-todo:settings') ?? '{}'));
  expect(saved.soundsEnabled).toBe(true);
  expect(saved.soundPack).toBe('chime');
  expect(saved.soundVolume).toBe(35);
  expect(saved.timerChime).toBe('gong');
  expect(saved.soundRewards).toBe(false);
  expect(errors).toEqual([]);
});

test('sounds play along with the app without errors', async ({ page }) => {
  const errors = await openApp(page, { soundsEnabled: true, soundPack: 'arcade' });
  await addTask(page, 'Noisy task today');
  const row = page.locator('.task', { hasText: 'Noisy task' });
  await row.getByRole('checkbox').click();
  await page.keyboard.press('Control+z');
  await row.hover();
  await row.getByRole('button', { name: 'Snooze' }).first().click();
  await page.getByRole('menuitem', { name: /Tomorrow/ }).click();
  await page.goto('./?view=focus');
  await expect(page.locator('.shell')).toBeVisible();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  expect(errors).toEqual([]);
});

test('focus ambience: pick a bed, play, change volume, stop; follows the timer when asked', async ({ page }) => {
  const errors = await openApp(page);
  await page.goto('./?view=focus');
  await expect(page.locator('.shell')).toBeVisible();
  const amb = page.getByRole('region', { name: 'Ambience' });
  await amb.getByRole('radio', { name: /Fireplace/ }).click();
  await amb.getByRole('button', { name: /Play/ }).click();
  await expect(amb.getByRole('button', { name: /Stop/ })).toBeVisible();
  await amb.getByLabel('Ambience volume').fill('60');
  await amb.getByRole('button', { name: /Stop/ }).click();
  await expect(amb.getByRole('button', { name: /Play/ })).toBeVisible();
  await amb.getByLabel('Start with the timer').check();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(amb.getByRole('button', { name: /Stop/ })).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(amb.getByRole('button', { name: /Play/ })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('homework-todo:settings') ?? '{}'));
  expect(saved.ambienceKind).toBe('fire');
  expect(saved.ambienceVolume).toBe(60);
  expect(saved.ambienceAuto).toBe(true);
  expect(errors).toEqual([]);
});
