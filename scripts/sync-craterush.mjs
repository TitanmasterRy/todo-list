// Copies the Crate Rush rules (src/lib/caseclicker.ts) into the game page as plain JavaScript, between its
// `// logic:start` and `// logic:end` lines. Run after changing the rules: node scripts/sync-craterush.mjs
// (src/lib/caseclicker.test.ts fails while the two copies behave differently.)
import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';

const src = readFileSync(new URL('../src/lib/caseclicker.ts', import.meta.url), 'utf8');
const page = new URL('../public/games/craterush.html', import.meta.url);
const html = readFileSync(page, 'utf8');

const js = ts
  .transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, removeComments: false } })
  .outputText.replace(/^export \{\};\s*$/m, '')
  .replace(/^export /gm, '')
  .trim();

const re = /(\/\/ logic:start[^\n]*\n)[\s\S]*?(^[ \t]*\/\/ logic:end)/m;
if (!re.test(html)) {
  console.error('craterush.html has no // logic:start … // logic:end block');
  process.exit(1);
}
writeFileSync(page, html.replace(re, (_m, start, end) => `${start}${js}\n${end}`));
console.log('Updated the rules in public/games/craterush.html');
