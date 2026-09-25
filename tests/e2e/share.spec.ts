import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

test('files shared into the app become a task with the file attached', async ({ page }) => {
  await openApp(page, { autoDescribe: false });
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 20_000 });
  // what the phone's share sheet does: a multipart POST to the share target
  await page.evaluate(() => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = './share-target';
    form.enctype = 'multipart/form-data';
    const input = document.createElement('input');
    input.type = 'file';
    input.name = 'files';
    const dt = new DataTransfer();
    dt.items.add(new File(['question 1 …'], 'chem_worksheet-3.txt', { type: 'text/plain' }));
    input.files = dt.files;
    const text = document.createElement('input');
    text.name = 'text';
    text.value = 'Chem worksheet 3';
    form.append(input, text);
    document.body.append(form);
    form.submit();
  });
  const dlg = page.getByRole('dialog', { name: /Shared with Homework To-Do/ });
  await expect(dlg).toBeVisible({ timeout: 15_000 });
  await expect(dlg).toContainText('chem_worksheet-3.txt');
  await expect(dlg.getByLabel('Task')).toHaveValue('Chem worksheet 3');
  await expect(dlg.getByRole('button', { name: /Book reader/ })).toHaveCount(0); // not a PDF
  await dlg.getByRole('button', { name: /New task with this file/ }).click();
  const ed = page.getByRole('form', { name: 'Edit task' });
  await expect(ed.getByRole('link', { name: 'chem_worksheet-3.txt' })).toBeVisible();
  await expect(page).not.toHaveURL(/shared=/);
});
