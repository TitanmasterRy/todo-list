import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { latestSection, whatsNewAction } from './whatsnew';

describe("what's new", () => {
  it('takes the first section of the changelog', () => {
    const s = latestSection('# Changelog\n\n## Pass 2\n\n- one\n- two\n\n## Pass 1\n\n- old\n');
    expect(s).toEqual({ title: 'Pass 2', body: '- one\n- two' });
    expect(latestSection('no headings')).toBeNull();
  });
  it('reads the real changelog', () => {
    const s = latestSection(readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8'));
    expect(s?.title).toBeTruthy();
    expect(s?.body).toContain('- ');
    expect(s?.title).toBe(__CHANGELOG_HEAD__);
  });
  it('shows once per new heading, never on first run', () => {
    expect(whatsNewAction('Pass 3', undefined)).toBe('remember');
    expect(whatsNewAction('Pass 3', 'Pass 3')).toBe('none');
    expect(whatsNewAction('Pass 4', 'Pass 3')).toBe('show');
    expect(whatsNewAction('', 'Pass 3')).toBe('none');
  });
});
