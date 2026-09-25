// WCAG contrast audit of every theme pack in light and dark: body, muted and faint text on each surface,
// and white text on the accent (buttons). Base palettes are read from app.css so this can't drift.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { accentContrast, THEMES } from './themes';

function block(css: string, selector: string): Record<string, string> {
  const i = css.indexOf(selector);
  const body = css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}
const css = readFileSync(new URL('../app.css', import.meta.url), 'utf8');
const ROOT = block(css, ':root {');
const LIGHT = { ...ROOT, ...block(css, ":root[data-theme='light'],") };
const DARK = { ...ROOT, ...block(css, ":root[data-theme='dark'],") };

function lum(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const TEXT = ['--text', '--text-muted', '--text-faint'];
const SURFACES = ['--bg', '--bg-elev', '--bg-elev-2'];

describe('theme contrast (WCAG AA 4.5:1 for text)', () => {
  for (const t of THEMES) {
    for (const mode of ['light', 'dark'] as const) {
      const vars = { ...(mode === 'light' ? LIGHT : DARK), ...t.vars, ...(mode === 'light' ? t.lightVars : t.darkVars) } as Record<string, string>;
      // resolve var(--x) references (e.g. --text-faint: var(--text-muted))
      for (const k of Object.keys(vars)) {
        const m = /^var\((--[\w-]+)\)/.exec(vars[k]);
        if (m) vars[k] = vars[m[1]];
      }
      it(`${t.name} ${mode}`, () => {
        const bad: string[] = [];
        for (const fg of TEXT)
          for (const bg of SURFACES) {
            const c = contrast(vars[fg], vars[bg]);
            if (c < 4.5) bad.push(`${fg} on ${bg}: ${c.toFixed(2)}`);
          }
        // primary buttons put white (or --accent-contrast) text on the accent
        const onAccent = accentContrast(vars['--accent']);
        const c = contrast(onAccent, vars['--accent']);
        if (c < 4.5) bad.push(`button text on --accent: ${c.toFixed(2)}`);
        expect(bad).toEqual([]);
      });
    }
  }
});
