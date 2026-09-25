// Bundle budget: fail the build when the first-load JavaScript or CSS grows past the limits.
// Lazy chunks (views, tools, casino, PDF, code editor) are not counted: they load on demand.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const BUDGET = { js: 125 * 1024, css: 20 * 1024 }; // gzipped
const dir = 'dist/assets';
const html = readFileSync('dist/index.html', 'utf8');
// entry files referenced directly by index.html
const entries = [...html.matchAll(/assets\/([^"']+\.(js|css))/g)].map((m) => m[1]);
let failed = false;
for (const kind of ['js', 'css']) {
  const files = entries.filter((f) => f.endsWith(`.${kind}`));
  const gz = files.reduce((a, f) => a + gzipSync(readFileSync(join(dir, f))).length, 0);
  const raw = files.reduce((a, f) => a + statSync(join(dir, f)).size, 0);
  const ok = gz <= BUDGET[kind];
  if (!ok) failed = true;
  console.log(`${ok ? '✓' : '✗'} first-load ${kind}: ${(gz / 1024).toFixed(1)} kB gzipped (${(raw / 1024).toFixed(0)} kB raw), budget ${(BUDGET[kind] / 1024).toFixed(0)} kB`);
}
if (!readdirSync(dir).length) failed = true;
if (failed) {
  console.error('Bundle budget exceeded. Lazy-load the new code (dynamic import) or raise the budget in scripts/check-size.mjs on purpose.');
  process.exit(1);
}
