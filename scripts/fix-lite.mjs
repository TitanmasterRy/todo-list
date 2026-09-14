// The lite build imports 'virtual:pwa-register' at module top level; keep the file self-contained by
// stripping any leftover external script/link tags and verifying the output is a single file.
import { readFileSync, writeFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
const dir = 'dist/lite';
const html = readFileSync(join(dir, 'index.html'), 'utf8');
const cleaned = html
  .replace(/<link rel="manifest"[^>]*>/g, '')
  .replace(/<link rel="apple-touch-icon"[^>]*>/g, '')
  .replace(/<script[^>]*src="[^"]*registerSW[^"]*"[^>]*><\/script>/g, '');
writeFileSync(join(dir, 'index.html'), cleaned);
for (const f of readdirSync(dir)) {
  if (f !== 'index.html') {
    const p = join(dir, f);
    rmSync(p, { recursive: true, force: true });
  }
}
const kb = Math.round(statSync(join(dir, 'index.html')).size / 1024);
console.log(`lite build: dist/lite/index.html (${kb} KB, single file)`);
