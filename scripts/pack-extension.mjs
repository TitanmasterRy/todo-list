// Zip the browser extension (extension/) for the Chrome Web Store / Firefox Add-ons: npm run pack:extension
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { zipSync } from 'fflate';

const dir = new URL('../extension/', import.meta.url).pathname;
const files = {};
for (const name of readdirSync(dir)) if (name !== 'README.md') files[name] = new Uint8Array(readFileSync(join(dir, name)));
const { version } = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
mkdirSync('dist-extension', { recursive: true });
const out = `dist-extension/homework-todo-extension-${version}.zip`;
writeFileSync(out, zipSync(files, { level: 9 }));
console.log(`✓ ${out} (${Object.keys(files).length} files)`);
