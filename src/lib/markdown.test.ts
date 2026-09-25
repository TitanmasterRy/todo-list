import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('escapes html', () => {
    expect(renderMarkdown('<script>x</script>')).toBe('<p>&lt;script&gt;x&lt;/script&gt;</p>');
  });
  it('renders inline styles and lists', () => {
    const html = renderMarkdown('# Title\n\nRead **ch 4** and `eq 2`\n\n- a\n- b\n\n1. one');
    expect(html).toContain('<h3>Title</h3>');
    expect(html).toContain('<strong>ch 4</strong>');
    expect(html).toContain('<code>eq 2</code>');
    expect(html).toContain('<ul>\n<li>a</li>\n<li>b</li>\n</ul>');
    expect(html).toContain('<ol>\n<li>one</li>\n</ol>');
  });
  it('links safely', () => {
    expect(renderMarkdown('[x](https://a.b)')).toContain('<a href="https://a.b" target="_blank" rel="noopener noreferrer">x</a>');
    expect(renderMarkdown('[x](javascript:alert(1))')).not.toContain('<a');
  });
});

describe('math in markdown', () => {
  it('keeps TeX away from markdown and escaping', async () => {
    const { ensureKatex } = await import('./math.svelte');
    expect(renderMarkdown('Let $a_1 * b_2$ be _small_')).toBe('<p>Let <code class="tex">a_1 * b_2</code> be <em>small</em></p>');
    await ensureKatex();
    const html = renderMarkdown('# Area\n\n$$\\pi r^2$$\n\n- side $s^2$');
    expect(html).toContain('<h3>Area</h3>');
    expect(html).toContain('katex-display');
    expect(html).toMatch(/<li>side <span class="katex">/);
    expect(renderMarkdown('costs $5 and $10')).toBe('<p>costs $5 and $10</p>');
  });
});
