import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { allSections, latestSection, unseenCount, whatsNewAction } from './whatsnew';

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
  it('lists every section and counts the ones a device missed', () => {
    const md = '# Changelog\n\n## Pass 3\n\n- c\n\n## Pass 2\n\n- b\n\n## Pass 1\n\n- a\n';
    const all = allSections(md);
    expect(all.map((s) => s.title)).toEqual(['Pass 3', 'Pass 2', 'Pass 1']);
    expect(all[2].body).toBe('- a');
    expect(unseenCount(all, 'Pass 1')).toBe(2);
    expect(unseenCount(all, 'Pass 3')).toBe(0);
    expect(unseenCount(all, 'Renamed')).toBe(1);
    expect(unseenCount(all, undefined)).toBe(0);
    expect(allSections(readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8')).length).toBeGreaterThan(5);
  });
});
