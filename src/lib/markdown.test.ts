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
