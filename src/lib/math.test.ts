import { describe, expect, it } from 'vitest';
import { ensureKatex, hasMath, renderTextWithMath, splitMath } from './math.svelte';

describe('math', () => {
  it('finds math but leaves money alone', () => {
    expect(hasMath('Solve $x^2 = 4$')).toBe(true);
    expect(hasMath('It costs $5 and $10')).toBe(false);
    expect(hasMath('Price: $ 5 $')).toBe(false);
    expect(hasMath('\\(a+b\\) and \\[c\\]')).toBe(true);
    expect(splitMath('A $x$ B $$y$$ C')).toEqual([{ text: 'A ' }, { tex: 'x', display: false }, { text: ' B ' }, { tex: 'y', display: true }, { text: ' C' }]);
    expect(splitMath('\\[\\frac12\\]')).toEqual([{ tex: '\\frac12', display: true }]);
  });
  it('escapes text and shows TeX as code until KaTeX loads, then renders it', async () => {
    expect(renderTextWithMath('<b>hi</b>\nthere')).toBe('&lt;b&gt;hi&lt;/b&gt;<br>there');
    expect(renderTextWithMath('area $\\pi r^2$')).toBe('area <code class="tex">\\pi r^2</code>');
    await ensureKatex();
    expect(renderTextWithMath('area $\\pi r^2$')).toContain('class="katex"');
    expect(renderTextWithMath('$\\href{javascript:alert(1)}{x}$')).not.toMatch(/href="javascript/); // trust: false refuses \href (the TeX only shows as text)
  });
});
