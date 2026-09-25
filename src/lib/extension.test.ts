// The browser extension in extension/ is plain files; check the manifest points at files that exist.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dir = new URL('../../extension/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', dir), 'utf8'));

describe('browser extension', () => {
  it('is a valid MV3 manifest whose files exist', () => {
    expect(manifest.manifest_version).toBe(3);
    const files = [manifest.action.default_popup, manifest.background.service_worker, manifest.options_page, ...Object.values(manifest.icons as Record<string, string>)];
    for (const f of files) expect(existsSync(new URL(f, dir)), f).toBe(true);
    for (const html of ['popup.html', 'options.html']) {
      for (const [, src] of readFileSync(new URL(html, dir), 'utf8').matchAll(/<script src="([^"]+)"/g)) expect(existsSync(new URL(src, dir)), src).toBe(true);
    }
    expect(manifest.permissions).toEqual(['activeTab', 'contextMenus', 'storage']); // nothing broad like <all_urls>
  });
  it('opens the app with the share-target params the app reads', () => {
    const shared = readFileSync(new URL('shared.js', dir), 'utf8');
    expect(shared).toContain("searchParams.set('title'");
    expect(shared).toContain("searchParams.set('url'");
    const app = readFileSync(new URL('../../src/App.svelte', import.meta.url), 'utf8');
    expect(app).toMatch(/params\.get\('title'\)/);
    expect(app).toMatch(/params\.get\('url'\)/);
  });
});
